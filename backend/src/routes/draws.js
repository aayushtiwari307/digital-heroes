'use strict';
const express=require('express');const c=require('../controllers/drawController');const {optionalAuth}=require('../middleware/optionalAuth');const r=express.Router();r.use(optionalAuth);r.get('/',c.publicList);r.get('/:id',c.publicGet);module.exports=r;
