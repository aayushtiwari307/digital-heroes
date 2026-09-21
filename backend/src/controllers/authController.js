'use strict';
const authService = require('../services/authService');
async function signup(req,res,next){ try{res.status(201).json(await authService.signup(req.body));}catch(e){next(e);} }
async function login(req,res,next){ try{res.status(200).json(await authService.login(req.body));}catch(e){next(e);} }
async function refresh(req,res,next){ try{res.status(200).json(await authService.refresh(req.body.refreshToken));}catch(e){next(e);} }
async function logout(req,res,next){ try{await authService.logout(req.body.refreshToken);res.status(204).send();}catch(e){next(e);} }
async function me(req,res){res.json({user:req.user});}
module.exports={signup,login,refresh,logout,me};
