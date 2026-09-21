'use strict';
const charityRepo=require('../repositories/charityRepository');
class CharityValidationError extends Error{constructor(message,code='INVALID_INPUT'){super(message);this.code=code;this.status=400;}}
function validate(input={}){if(!input.name||!String(input.name).trim())throw new CharityValidationError('Charity name is required');if(input.minPct!==undefined&&(!Number.isInteger(Number(input.minPct))||Number(input.minPct)<10||Number(input.minPct)>100))throw new CharityValidationError('Minimum contribution % must be between 10 and 100');if(input.images!==undefined&&!Array.isArray(input.images))throw new CharityValidationError('images must be an array');}
async function listCharities(search){return charityRepo.list({search});}
async function getCharity(id){const c=await charityRepo.findById(id);if(!c){const e=new Error('Charity not found');e.status=404;throw e;}const [events,media]=await Promise.all([charityRepo.eventsForCharity(id),charityRepo.mediaForCharity(id)]);return {...c,events,media};}
async function createCharity(input){validate(input);return charityRepo.create(input);}
async function updateCharity(id,input){validate({name:input.name??'existing',minPct:input.minPct,images:input.images});const c=await charityRepo.update(id,{...input,minPct:input.minPct===undefined?undefined:Number(input.minPct)});if(!c){const e=new Error('Charity not found');e.status=404;throw e;}return c;}
async function deleteCharity(id){const c=await charityRepo.deactivate(id);if(!c){const e=new Error('Charity not found');e.status=404;throw e;}return c;}
async function adminGet(id){const c=await charityRepo.findAdminById(id);if(!c){const e=new Error('Charity not found');e.status=404;throw e;}const [events,media]=await Promise.all([charityRepo.eventsForCharity(id),charityRepo.mediaForCharity(id)]);return {...c,events,media};}
module.exports={listCharities,getCharity,createCharity,updateCharity,deleteCharity,adminGet,validate,CharityValidationError};
