'use strict';
const { pool } = require('../config/db');

async function listByUser(userId, client = pool) {
  const { rows } = await client.query(`SELECT id, TO_CHAR(score_date,'YYYY-MM-DD') AS date, value FROM scores WHERE user_id=$1 ORDER BY score_date DESC`, [userId]);
  return rows;
}

async function lockUser(client, userId) {
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [userId]);
}

function scoreRowSql() { return `id, TO_CHAR(score_date,'YYYY-MM-DD') AS date, value`; }

async function insertAndTrim(userId, { value, date }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockUser(client,userId);
    const insert = await client.query(`INSERT INTO scores (user_id,score_date,value) VALUES ($1,$2,$3) RETURNING id, TO_CHAR(score_date,'YYYY-MM-DD') AS date, value`, [userId,date,value]);
    const inserted=insert.rows[0];
    const evicted=await client.query(`DELETE FROM scores s WHERE s.user_id=$1 AND s.id IN (SELECT id FROM scores WHERE user_id=$1 ORDER BY score_date DESC, id DESC OFFSET 5) RETURNING id, score_date, value`, [userId]);
    for(const row of evicted.rows) await client.query(`INSERT INTO score_audit(score_id,user_id,action,score_date,value,reason) VALUES ($1,$2,'evicted',$3,$4,'latest-five-retention')`, [row.id,userId,row.score_date,row.value]);
    await client.query(`INSERT INTO score_audit(score_id,user_id,action,score_date,value,reason) VALUES ($1,$2,'inserted',$3,$4,'score-created')`, [inserted.id,userId,date,value]);
    const retained=await client.query(`SELECT ${scoreRowSql()} FROM scores WHERE id=$1`, [inserted.id]);
    await client.query('COMMIT');
    return { score: retained.rows[0] || inserted, retained: Boolean(retained.rows[0]), evicted: evicted.rows.length };
  } catch(e){await client.query('ROLLBACK');throw e;} finally{client.release();}
}

async function updateOwnedAndTrim(userId, scoreId, { value, date }) {
  const client=await pool.connect();
  try{
    await client.query('BEGIN'); await lockUser(client,userId);
    const duplicate=await client.query(`SELECT 1 FROM scores WHERE user_id=$1 AND score_date=$2 AND id<>$3`,[userId,date,scoreId]);
    if(duplicate.rowCount) { const e=new Error('Another score already exists for this date'); e.code='DUPLICATE_DATE'; e.status=400; throw e; }
    const updated=await client.query(`UPDATE scores SET value=$1,score_date=$2 WHERE id=$3 AND user_id=$4 RETURNING ${scoreRowSql()}`,[value,date,scoreId,userId]);
    if(!updated.rowCount){await client.query('ROLLBACK');return null;}
    const evicted=await client.query(`DELETE FROM scores s WHERE s.user_id=$1 AND s.id IN (SELECT id FROM scores WHERE user_id=$1 ORDER BY score_date DESC, id DESC OFFSET 5) RETURNING id,score_date,value`,[userId]);
    for(const row of evicted.rows) await client.query(`INSERT INTO score_audit(score_id,user_id,action,score_date,value,reason) VALUES ($1,$2,'evicted',$3,$4,'latest-five-retention')`,[row.id,userId,row.score_date,row.value]);
    await client.query(`INSERT INTO score_audit(score_id,user_id,action,score_date,value,reason) VALUES ($1,$2,'updated',$3,$4,'score-edited')`,[scoreId,userId,date,value]);
    const retained=await client.query(`SELECT ${scoreRowSql()} FROM scores WHERE id=$1`,[scoreId]);
    await client.query('COMMIT');
    return {score: retained.rows[0]||updated.rows[0], retained:Boolean(retained.rows[0]), evicted:evicted.rows.length};
  }catch(e){if(e.code!=='DUPLICATE_DATE')await client.query('ROLLBACK');else await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function deleteOwned(userId,scoreId){
  const client=await pool.connect();
  try{await client.query('BEGIN');await lockUser(client,userId);const rows=await client.query(`DELETE FROM scores WHERE id=$1 AND user_id=$2 RETURNING id,score_date,value`,[scoreId,userId]);if(!rows.rowCount){await client.query('ROLLBACK');return false;}await client.query(`INSERT INTO score_audit(score_id,user_id,action,score_date,value,reason) VALUES ($1,$2,'deleted',$3,$4,'score-deleted')`,[scoreId,userId,rows.rows[0].score_date,rows.rows[0].value]);await client.query('COMMIT');return true;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function findOwned(userId,scoreId){const {rows}=await pool.query(`SELECT ${scoreRowSql()} FROM scores WHERE id=$1 AND user_id=$2`,[scoreId,userId]);return rows[0]||null;}

async function insertAdmin(userId,input){return updateCreateForAdmin(userId,input,null);}
async function updateCreateForAdmin(userId,{value,date},scoreId){
  return scoreId ? updateOwnedAndTrim(userId,scoreId,{value,date}) : insertAndTrim(userId,{value,date});
}
async function deleteAdmin(userId,scoreId){return deleteOwned(userId,scoreId);}

async function findEntitledUser(userId){const {rows}=await pool.query(`SELECT 1 FROM subscriptions WHERE user_id=$1 AND status='active' AND (current_period_end IS NULL OR current_period_end > now()) LIMIT 1`,[userId]);return Boolean(rows[0]);}

module.exports={listByUser,insertAndTrim,updateOwnedAndTrim,deleteOwned,findOwned,insertAdmin,updateCreateForAdmin,deleteAdmin,findEntitledUser};
