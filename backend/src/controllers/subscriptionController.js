'use strict';
const {stripe}=require('../config/stripe');
const subscriptionService=require('../services/subscriptionService');
const {validateProductionEnv}=require('../config/env');
async function plans(req,res,next){try{res.json({plans:await subscriptionService.getPlans()});}catch(e){next(e);}}
async function checkout(req,res,next){try{res.json(await subscriptionService.createCheckoutSession(req.user,req.body));}catch(e){next(e);}}
async function mySubscription(req,res,next){try{res.json({subscription:await subscriptionService.getMySubscription(req.user.id)});}catch(e){next(e);}}
async function cancel(req,res,next){try{res.status(202).json(await subscriptionService.cancelMySubscription(req.user.id));}catch(e){next(e);}}
async function stripeWebhook(req,res,next){const signature=req.headers['stripe-signature'];validateProductionEnv();const secret=process.env.STRIPE_WEBHOOK_SECRET||'whsec_test_secret_for_dev';let event;try{event=stripe.webhooks.constructEvent(req.body,signature,secret);}catch(e){return res.status(400).json({error:`Webhook signature verification failed: ${e.message}`});}try{const result=await subscriptionService.handleWebhookEvent(event);res.json({received:true,alreadyProcessed:result.alreadyProcessed});}catch(e){next(e);}}
module.exports={plans,checkout,mySubscription,cancel,stripeWebhook};
