'use strict';
const s=require('../services/winnerService');
async function listMine(req,res,next){try{res.json({winnings:await s.listMyWinnings(req.user.id)});}catch(e){next(e);}}
async function uploadProof(req,res,next){try{res.status(201).json(await s.uploadProof(req.user.id,req.params.id,req.file));}catch(e){next(e);}}
async function getProof(req,res,next){try{res.json(await s.getProofSignedUrl(req.params.id,req.user));}catch(e){next(e);}}
module.exports={listMine,uploadProof,getProof};
