'use strict';
const {stripe}=require('../config/stripe');
const {pool}=require('../config/db');
const subRepo=require('../repositories/subscriptionRepository');
const charityRepo=require('../repositories/charityRepository');
const {frontendOrigin}=require('../config/env');
class SubscriptionError extends Error{constructor(message,code='INVALID_INPUT',status=400){super(message);this.code=code;this.status=status;}}
function monthFromUnix(unix){return unix?new Date(unix*1000).toISOString().slice(0,7):null;}
function periodMs(unix){return unix?new Date(unix*1000):null;}
async function createCheckoutSession(user,{planId,charityId,charityPct}){
  const client=await pool.connect();
  let locked=false;
  try{
    const lock=await client.query(`SELECT pg_try_advisory_lock(hashtextextended('checkout:' || $1, 17)) AS locked`,[user.id]);
    locked=Boolean(lock.rows[0]?.locked);
    if(!locked) throw new SubscriptionError('A subscription checkout is already being created for this account','CHECKOUT_IN_PROGRESS',409);
    const current=await subRepo.findEntitledByUser(user.id);
    if(current) throw new SubscriptionError('You already have an active subscription. Manage it instead of creating another.','SUBSCRIPTION_EXISTS',409);
    const plan=await subRepo.findPlan(planId); if(!plan) throw new SubscriptionError('Unknown plan','PLAN_NOT_FOUND',404);
    const charity=await charityRepo.findById(charityId); if(!charity) throw new SubscriptionError('Unknown charity','CHARITY_NOT_FOUND',404);
    const pct=charityPct===undefined?charity.min_pct:Number(charityPct);
    if(!Number.isInteger(pct)||pct<charity.min_pct||pct>100) throw new SubscriptionError(`Charity contribution must be between ${charity.min_pct}% and 100%`,'INVALID_CHARITY_PCT');
    const poolPctSetting=await subRepo.getSetting('pool_contribution_pct');
    const configuredPoolPct=Number(poolPctSetting);
    const poolPct=Number.isInteger(configuredPoolPct)?configuredPoolPct:20;
    if(poolPct<0||poolPct>100)throw new SubscriptionError('Pool contribution setting must be between 0% and 100%','INVALID_POOL_PCT');
    if(pct+poolPct>100)throw new SubscriptionError('Charity contribution plus prize-pool contribution cannot exceed 100%','INVALID_ALLOCATION_PCT');
    const metadata={userId:user.id,planId:plan.id,charityId:charity.id,charityPct:String(pct),poolPct:String(Number.isFinite(poolPct)?poolPct:20)};
    const session=await stripe.checkout.sessions.create({mode:'subscription',customer_email:user.email,line_items:[{price_data:{currency:plan.currency.toLowerCase(),unit_amount:plan.price_minor,recurring:{interval:plan.interval},product_data:{name:`Digital Heroes — ${plan.name}`}},quantity:1}],metadata,subscription_data:{metadata},success_url:`${frontendOrigin()}/dashboard?checkout=success`,cancel_url:`${frontendOrigin()}/subscription?checkout=cancelled`});
    return {url:session.url,sessionId:session.id};
  }finally{
    if(locked){try{await client.query(`SELECT pg_advisory_unlock(hashtextextended('checkout:' || $1, 17))`,[user.id]);}catch(_){/* connection close releases the lock */}}
    client.release();
  }
}
async function getPlans(){return subRepo.listPlans();}
async function getMySubscription(userId){return subRepo.findByUser(userId);}
async function cancelMySubscription(userId){return adminCancelSubscription(userId);}
async function handleWebhookEvent(event){const client=await pool.connect();try{await client.query('BEGIN');if(!(await subRepo.claimStripeEvent(client,event.id,event.type))){await client.query('COMMIT');return {alreadyProcessed:true};}switch(event.type){case'checkout.session.completed':await handleCheckoutCompleted(client,event.data.object);break;case'invoice.paid':await handleInvoicePaid(client,event.data.object);break;case'customer.subscription.updated':await handleSubscriptionUpdated(client,event.data.object);break;case'customer.subscription.deleted':await handleSubscriptionDeleted(client,event.data.object);break;case'invoice.payment_failed':await handlePaymentFailed(client,event.data.object);break;default:break;}await client.query('COMMIT');return {alreadyProcessed:false};}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}}
async function handleCheckoutCompleted(client,session){const m=session.metadata||{};if(!m.userId||!m.planId||!m.charityId||!session.subscription)return;const plan=await subRepo.findPlan(m.planId,client);if(!plan)throw new SubscriptionError('Plan not found for checkout metadata','PLAN_NOT_FOUND',500);const charityPct=Number(m.charityPct);const configured=Number(m.poolPct);const poolPct=Number.isInteger(configured)?configured:20;if(!Number.isInteger(charityPct)||charityPct<10||charityPct>100)throw new SubscriptionError('Invalid charity contribution percentage','INVALID_CHARITY_PCT');if(poolPct<0||poolPct>100)throw new SubscriptionError('Pool contribution setting must be between 0% and 100%','INVALID_POOL_PCT');if(charityPct+poolPct>100)throw new SubscriptionError('Charity contribution plus prize-pool contribution cannot exceed 100%','INVALID_ALLOCATION_PCT');const subscription=await subRepo.upsertFromCheckout(client,{userId:m.userId,planId:m.planId,charityId:m.charityId,charityPct,poolPctSnapshot:poolPct,stripeCustomerId:session.customer,stripeSubscriptionId:session.subscription,currentPeriodStart:null,currentPeriodEnd:null});await subRepo.insertHistory(client,subscription.id,'activated',{via:'checkout.session.completed',checkout_session_id:session.id});}
async function handleInvoicePaid(client,invoice){
  const stripeSubscriptionId=typeof invoice.subscription==='string'?invoice.subscription:invoice.subscription?.id;
  if(!stripeSubscriptionId)return;
  let subscription=await subRepo.findByStripeSubscriptionId(stripeSubscriptionId,client);
  if(!subscription){
    const remote=await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const meta=remote.metadata||{};
    if(!meta.userId||!meta.planId||!meta.charityId||meta.charityPct===undefined)return;
    const poolPctSetting=await subRepo.getSetting('pool_contribution_pct',client);
    const poolPct=Number.isFinite(Number(meta.poolPct))?Number(meta.poolPct):(Number(poolPctSetting)||20);
    subscription=await subRepo.upsertFromCheckout(client,{userId:meta.userId,planId:meta.planId,charityId:meta.charityId,charityPct:Number(meta.charityPct),poolPctSnapshot:poolPct,stripeCustomerId:remote.customer,stripeSubscriptionId:remote.id,currentPeriodStart:periodMs(remote.current_period_start),currentPeriodEnd:periodMs(remote.current_period_end)});
    await subRepo.insertHistory(client,subscription.id,'activated',{via:'invoice.paid-before-checkout',stripe_status:remote.status});
  }
  const plan=await subRepo.findPlan(subscription.plan_id,client);
  const startUnix=invoice.period?.start || invoice.lines?.data?.[0]?.period?.start || remotePeriod(subscription.current_period_start);
  const endUnix=invoice.period?.end || invoice.lines?.data?.[0]?.period?.end;
  const start=periodMs(startUnix); const end=periodMs(endUnix);
  const period=monthFromUnix(startUnix) || (start?start.toISOString().slice(0,7):null);
  if(!plan||!period)throw new SubscriptionError('Stripe invoice did not include usable billing period','INVALID_INVOICE',500);
  await subRepo.updatePeriodAndStatus(client,stripeSubscriptionId,{status:'active',currentPeriodStart:start,currentPeriodEnd:end});
  const gross=plan.interval==='year'?Math.round(plan.price_minor/12):plan.price_minor;
  const charity=Math.floor(gross*subscription.charity_pct/100);
  const poolMinor=Math.floor(gross*subscription.pool_pct_snapshot/100);
  await subRepo.insertContribution(client,{subscriptionId:subscription.id,billingPeriod:period,grossMinor:gross,charityMinor:charity,poolMinor,charityId:subscription.charity_id,charityPct:subscription.charity_pct,poolPct:subscription.pool_pct_snapshot,allocationBasis:plan.interval==='year'?'annual-monthly-equivalent':'stripe-invoice',stripeInvoiceId:invoice.id});
  await subRepo.insertHistory(client,subscription.id,'invoice_paid',{invoice_id:invoice.id,billing_period:period,period_start:invoice.period?.start||null,period_end:invoice.period?.end||null});
} 
function remotePeriod(value){return value?Math.floor(new Date(value).getTime()/1000):null;}
async function handleSubscriptionUpdated(client,s){const status=s.status==='active'?'active':s.status==='canceled'?'cancelled':'lapsed';const updated=await subRepo.updatePeriodAndStatus(client,s.id,{status,currentPeriodStart:periodMs(s.current_period_start),currentPeriodEnd:periodMs(s.current_period_end)});if(updated)await subRepo.insertHistory(client,updated.id,'updated',{stripeStatus:s.status,current_period_start:s.current_period_start||null,current_period_end:s.current_period_end||null});}
async function handleSubscriptionDeleted(client,s){const updated=await subRepo.updatePeriodAndStatus(client,s.id,{status:'cancelled'});if(updated)await subRepo.insertHistory(client,updated.id,'cancelled',{stripe_event:'customer.subscription.deleted'});}
async function handlePaymentFailed(client,invoice){const id=typeof invoice.subscription==='string'?invoice.subscription:invoice.subscription?.id;if(!id)return;const updated=await subRepo.updatePeriodAndStatus(client,id,{status:'lapsed',currentPeriodStart:periodMs(invoice.period?.start),currentPeriodEnd:periodMs(invoice.period?.end)});if(updated)await subRepo.insertHistory(client,updated.id,'payment_failed',{invoice_id:invoice.id||null});}
async function adminCancelSubscription(userId){const current=await subRepo.findEntitledByUser(userId);if(!current){const e=new Error('No active subscription found for this user');e.status=404;e.code='SUBSCRIPTION_NOT_FOUND';throw e;}if(!current.stripe_subscription_id){throw new SubscriptionError('Subscription is missing its Stripe id','STRIPE_SUBSCRIPTION_MISSING',409);}const cancelled=await stripe.subscriptions.cancel(current.stripe_subscription_id);return {cancellationRequested:true,stripeSubscriptionId:cancelled.id,status:cancelled.status};}
module.exports={createCheckoutSession,getPlans,getMySubscription,cancelMySubscription,handleWebhookEvent,adminCancelSubscription,SubscriptionError};
