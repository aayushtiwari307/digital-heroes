'use strict';
const drawService=require('../services/drawService');
async function simulate(req,res,next){try{res.json(await drawService.simulateDraw(req.body.month,req.body.strategy||'random'));}catch(e){next(e);}}
async function publish(req,res,next){try{res.json(await drawService.publishDraw(req.params.id));}catch(e){next(e);}}
async function get(req,res,next){try{res.json(await drawService.getDraw(req.params.id));}catch(e){next(e);}}
async function publicList(req,res,next){try{res.json({draws:await drawService.listPublicDraws(req.user?.id||null)});}catch(e){next(e);}}
async function publicGet(req,res,next){try{res.json(await drawService.getPublicDraw(req.params.id,req.user?.id||null));}catch(e){next(e);}}
module.exports={simulate,publish,get,publicList,publicGet};
