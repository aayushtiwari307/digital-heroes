'use strict';
const scoreRepo=require('../repositories/scoreRepository');
const {validateScoreInput,ScoreValidationError}=require('../domain/scoreRules');
async function listScores(userId){const all=await scoreRepo.listByUser(userId);return {all,current:all,drawEligible:all.length===5};}
async function addScore(userId,input){const v=validateScoreInput(input);try{const r=await scoreRepo.insertAndTrim(userId,v);return {...r.score,retained:r.retained,evicted:r.evicted};}catch(e){if(e.code==='23505')throw new ScoreValidationError('A score already exists for this date — edit or delete it instead','DUPLICATE_DATE');throw e;}}
async function editScore(userId,scoreId,input){const v=validateScoreInput(input);try{const r=await scoreRepo.updateOwnedAndTrim(userId,scoreId,v);if(!r){const e=new Error('Score not found');e.status=404;throw e;}return {...r.score,retained:r.retained,evicted:r.evicted};}catch(e){if(e.code==='23505'||e.code==='DUPLICATE_DATE')throw new ScoreValidationError('Another score already exists for this date','DUPLICATE_DATE');throw e;}}
async function deleteScore(userId,scoreId){const ok=await scoreRepo.deleteOwned(userId,scoreId);if(!ok){const e=new Error('Score not found');e.status=404;throw e;}}
module.exports={listScores,addScore,editScore,deleteScore};
