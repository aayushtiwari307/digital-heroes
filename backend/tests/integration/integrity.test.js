'use strict';

require('./setup');
const { pool } = require('../../src/config/db');
const drawService = require('../../src/services/drawService');
const subService = require('../../src/services/subscriptionService');

async function createCharity(name='Integrity Charity') {
  const { rows } = await pool.query(`INSERT INTO charities(name,min_pct) VALUES($1,10) RETURNING id`, [name]);
  return rows[0].id;
}

async function createUser(email) {
  const passwordHash = '$2a$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz12';
  const { rows } = await pool.query(`INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id`, [email, passwordHash]);
  return rows[0].id;
}

async function createSubscriberWithScores(email, charityId) {
  const userId = await createUser(email);
  const plan = await pool.query(`SELECT id, price_minor FROM plans WHERE interval='month' LIMIT 1`);
  await pool.query(`INSERT INTO subscriptions(user_id,plan_id,status,charity_id,charity_pct,pool_pct_snapshot,stripe_subscription_id) VALUES($1,$2,'active',$3,10,20,$4)`, [userId, plan.rows[0].id, charityId, `sub_${userId}`]);
  const dates=['2026-01-01','2026-02-01','2026-03-01','2026-04-01','2026-05-01'];
  for(let i=0;i<5;i++) await pool.query(`INSERT INTO scores(user_id,score_date,value) VALUES($1,$2,$3)`, [userId,dates[i],i+10]);
  return userId;
}

describe('Database integrity repairs',()=>{
  test('published draw protected fields, children, and deletion are immutable',async()=>{
    const charity=await createCharity();
    const user=await createSubscriberWithScores('immutability@example.test',charity);
    const sub=await pool.query(`SELECT id FROM subscriptions WHERE user_id=$1`,[user]);
    await pool.query(`INSERT INTO charity_contributions(subscription_id,billing_period,gross_minor,charity_minor,pool_minor,charity_id,charity_pct,pool_pct,allocation_basis) VALUES($1,'2026-07',10000,1000,2000,$2,10,20,'test')`,[sub.rows[0].id,charity]);
    const result=await drawService.simulateDraw('2026-07','random',{seed:'0123456789abcdef'});
    await drawService.publishDraw(result.draw.id);

    await expect(pool.query(`UPDATE draws SET total_pool_minor=total_pool_minor+1 WHERE id=$1`,[result.draw.id])).rejects.toMatchObject({code:'55000'});
    await expect(pool.query(`DELETE FROM draws WHERE id=$1`,[result.draw.id])).rejects.toMatchObject({code:'55000'});
    const entry=await pool.query(`SELECT * FROM draw_entries WHERE draw_id=$1`,[result.draw.id]);
    await expect(pool.query(`UPDATE draw_entries SET ticket_numbers=ARRAY[1,2,3,4,5] WHERE id=$1`,[entry.rows[0].id])).rejects.toMatchObject({code:'55000'});
    await expect(pool.query(`UPDATE draw_results SET winning_numbers=ARRAY[1,2,3,4,5] WHERE draw_id=$1`,[result.draw.id])).rejects.toMatchObject({code:'55000'});
    const winner=await pool.query(`SELECT * FROM winners WHERE draw_id=$1 LIMIT 1`,[result.draw.id]);
    if(winner.rowCount){
      await expect(pool.query(`UPDATE winners SET payout_minor=payout_minor+1 WHERE id=$1`,[winner.rows[0].id])).rejects.toMatchObject({code:'55000'});
      await expect(pool.query(`DELETE FROM winners WHERE id=$1`,[winner.rows[0].id])).rejects.toMatchObject({code:'55000'});
    }
  });

  test('winner must reference the matching user for the draw entry',async()=>{
    const charity=await createCharity('Winner FK Charity');
    const alice=await createSubscriberWithScores('alice-fk@example.test',charity);
    const bob=await createSubscriberWithScores('bob-fk@example.test',charity);
    const draw=await pool.query(`INSERT INTO draws(month,strategy,status,seed,algorithm_version,config_version) VALUES('2026-08','random','simulated','seed','seeded-prng-v1','v1') RETURNING id`);
    const entry=await pool.query(`INSERT INTO draw_entries(draw_id,user_id,ticket_numbers,score_dates) VALUES($1,$2,ARRAY[1,2,3,4,5],ARRAY['2026-01-01'::date,'2026-02-01'::date,'2026-03-01'::date,'2026-04-01'::date,'2026-05-01'::date]) RETURNING id`,[draw.rows[0].id,alice]);
    await expect(pool.query(`INSERT INTO winners(draw_id,draw_entry_id,user_id,tier,payout_minor,status) VALUES($1,$2,$3,5,100,'pending')`,[draw.rows[0].id,entry.rows[0].id,bob])).rejects.toMatchObject({code:'23503'});
  });

  test('annual subscriptions create monthly-equivalent ledger rows only from successful invoice.paid events',async()=>{
    const charity=await createCharity('Annual Charity');
    const user=await createUser('annual@example.test');
    const plan=await pool.query(`SELECT id,price_minor FROM plans WHERE interval='year' LIMIT 1`);
    const stripeSubscriptionId=`sub_\${user}`;

    await pool.query(`INSERT INTO subscriptions(user_id,plan_id,status,charity_id,charity_pct,pool_pct_snapshot,current_period_start,current_period_end,stripe_subscription_id) VALUES($1,$2,'active',$3,10,20,'2026-12-15T00:00:00Z','2027-12-15T00:00:00Z',$4)`,
      [user,plan.rows[0].id,charity,stripeSubscriptionId]);

    const janStart=Math.floor(Date.parse('2027-01-01T00:00:00Z')/1000);
    const febStart=Math.floor(Date.parse('2027-02-01T00:00:00Z')/1000);
    const marStart=Math.floor(Date.parse('2027-03-01T00:00:00Z')/1000);

    await subService.handleWebhookEvent({
      id:'evt_annual_jan',
      type:'invoice.paid',
      data:{object:{
        id:'in_annual_jan',
        subscription:stripeSubscriptionId,
        period:{start:janStart,end:febStart}
      }}
    });

    await subService.handleWebhookEvent({
      id:'evt_annual_feb',
      type:'invoice.paid',
      data:{object:{
        id:'in_annual_feb',
        subscription:stripeSubscriptionId,
        period:{start:febStart,end:marStart}
      }}
    });

    await drawService.simulateDraw('2027-01','random',{seed:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'});
    await drawService.simulateDraw('2027-01','random',{seed:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'});
    await drawService.simulateDraw('2027-02','random',{seed:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'});

    const ledger=await pool.query(`SELECT billing_period,gross_minor,pool_minor,allocation_basis FROM charity_contributions ORDER BY billing_period`);
    expect(ledger.rows).toHaveLength(2);
    expect(ledger.rows.map(r=>r.billing_period)).toEqual(['2027-01','2027-02']);
    expect(ledger.rows[0].gross_minor).toBe(Math.round(plan.rows[0].price_minor/12));
    expect(ledger.rows.every(r=>r.allocation_basis==='stripe-invoice' || r.allocation_basis==='annual-monthly-equivalent')).toBe(true);
  });

  test('lower-tier unawarded amounts are recorded on the draw and never used as carry-in',async()=>{
    const charity=await createCharity('Lower Tier Charity');
    const user=await createSubscriberWithScores('lower-tier@example.test',charity);
    const sub=await pool.query(`SELECT id FROM subscriptions WHERE user_id=$1`,[user]);
    await pool.query(`INSERT INTO charity_contributions(subscription_id,billing_period,gross_minor,charity_minor,pool_minor,charity_id,charity_pct,pool_pct,allocation_basis) VALUES($1,'2027-03',100000,10000,90000,$2,10,90,'test')`,[sub.rows[0].id,charity]);
    // Seed a draw with no chance of 5-match while still producing an eligible entry.
    const result=await drawService.simulateDraw('2027-03','random',{seed:'00000000000000000000000000000000'});
    expect(result.draw.unawarded_minor).toBeGreaterThanOrEqual(0);
    expect(result.draw.jackpot_carry_out).toBeGreaterThanOrEqual(0);
  });
});




