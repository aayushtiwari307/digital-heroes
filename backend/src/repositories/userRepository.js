'use strict';
const {pool}=require('../config/db');
async function createUser({email,passwordHash,role='subscriber'}){const {rows}=await pool.query(`INSERT INTO users(email,password_hash,role) VALUES($1,$2,$3) RETURNING id,email,role,created_at`,[email,passwordHash,role]);return rows[0];}
async function findByEmail(email){const {rows}=await pool.query(`SELECT id,email,password_hash,role FROM users WHERE email=$1`,[email]);return rows[0]||null;}
async function findById(id){const {rows}=await pool.query(`SELECT id,email,role,created_at FROM users WHERE id=$1`,[id]);return rows[0]||null;}
module.exports={createUser,findByEmail,findById};
