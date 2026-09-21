'use strict';
const s=require('../services/charityService');const r=require('../repositories/charityRepository');
async function get(req,res,next){try{res.json(await s.adminGet(req.params.id));}catch(e){next(e);}}
async function events(req,res,next){try{res.json({events:await r.eventsForCharity(req.params.id)});}catch(e){next(e);}}
async function createEvent(req,res,next){try{res.status(201).json(await r.createEvent(req.params.id,req.body));}catch(e){next(e);}}
async function updateEvent(req,res,next){try{const x=await r.updateEvent(req.params.eventId,req.body);if(!x)return res.status(404).json({error:'Event not found'});res.json(x);}catch(e){next(e);}}
async function removeEvent(req,res,next){try{if(!await r.removeEvent(req.params.eventId))return res.status(404).json({error:'Event not found'});res.status(204).send();}catch(e){next(e);}}
async function media(req,res,next){try{res.json({media:await r.mediaForCharity(req.params.id)});}catch(e){next(e);}}
async function createMedia(req,res,next){try{res.status(201).json(await r.createMedia(req.params.id,req.body));}catch(e){next(e);}}
async function removeMedia(req,res,next){try{if(!await r.removeMedia(req.params.mediaId))return res.status(404).json({error:'Media not found'});res.status(204).send();}catch(e){next(e);}}
module.exports={get,events,createEvent,updateEvent,removeEvent,media,createMedia,removeMedia};
