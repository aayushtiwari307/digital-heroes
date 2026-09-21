'use strict';
const s=require('../services/charityService');
async function list(req,res,next){try{res.json({charities:await s.listCharities(req.query.search)});}catch(e){next(e);}}
async function get(req,res,next){try{res.json(await s.getCharity(req.params.id));}catch(e){next(e);}}
async function create(req,res,next){try{res.status(201).json(await s.createCharity(req.body));}catch(e){next(e);}}
async function update(req,res,next){try{res.json(await s.updateCharity(req.params.id,req.body));}catch(e){next(e);}}
async function remove(req,res,next){try{await s.deleteCharity(req.params.id);res.status(204).send();}catch(e){next(e);}}
module.exports={list,get,create,update,remove};
