'use strict';
const adminRepo=require('../repositories/adminRepository');
const subService=require('../services/subscriptionService');
const scoreService=require('../services/scoreService');
async function listUsers(req,res,next){try{res.json({users:await adminRepo.listUsers()});}catch(e){next(e);}}
async function getUser(req,res,next){try{const u=await adminRepo.getUserDetail(req.params.id);if(!u)return res.status(404).json({error:'User not found'});res.json(u);}catch(e){next(e);}}
async function updateUser(req,res,next){try{const u=await adminRepo.updateUserProfile(req.params.id,req.body);if(!u)return res.status(404).json({error:'User not found'});res.json(u);}catch(e){next(e);}}
async function setRole(req,res,next){try{const u=await adminRepo.setUserRole(req.params.id,req.body.role);if(!u)return res.status(404).json({error:'User not found'});res.json(u);}catch(e){next(e);}}
async function cancelSubscription(req,res,next){try{res.status(202).json(await subService.adminCancelSubscription(req.params.id));}catch(e){next(e);}}
async function subscriptions(req,res,next){try{res.json({subscriptions:await adminRepo.listSubscriptions()});}catch(e){next(e);}}
async function listUserScores(req,res,next){try{res.json(await adminRepo.listUserScores(req.params.id));}catch(e){next(e);}}
async function updateUserScore(req,res,next){try{const x=await scoreService.editScore(req.params.id,req.params.scoreId,req.body);res.json(x);}catch(e){next(e);}}
async function deleteUserScore(req,res,next){try{await scoreService.deleteScore(req.params.id,req.params.scoreId);res.status(204).send();}catch(e){next(e);}}
async function reports(req,res,next){try{res.json(await adminRepo.reportsSummary());}catch(e){next(e);}}
async function config(req,res,next){try{res.json(await adminRepo.getConfig());}catch(e){next(e);}}
async function updateConfig(req,res,next){try{const pct=Number(req.body.poolContributionPct);if(!Number.isInteger(pct)||pct<0||pct>100)return res.status(400).json({error:'poolContributionPct must be 0-100'});res.json(await adminRepo.updateConfig(pct));}catch(e){next(e);}}
module.exports={listUsers,getUser,updateUser,setRole,cancelSubscription,subscriptions,listUserScores,updateUserScore,deleteUserScore,reports,config,updateConfig};
