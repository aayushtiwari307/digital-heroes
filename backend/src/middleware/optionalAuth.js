'use strict';
const {verifyAccessToken}=require('../utils/jwt');
const userRepo=require('../repositories/userRepository');
async function optionalAuth(req,res,next){try{const header=req.headers.authorization||'';const [scheme,token]=header.split(' ');if(scheme==='Bearer'&&token){try{const p=verifyAccessToken(token);const u=await userRepo.findById(p.sub);if(u)req.user=u;}catch(_){}}next();}catch(e){next(e);}}
module.exports={optionalAuth};
