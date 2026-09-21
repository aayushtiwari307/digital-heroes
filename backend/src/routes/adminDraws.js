'use strict';
const express=require('express');const c=require('../controllers/drawController');const {requireAuth,requireRole}=require('../middleware/auth');const r=express.Router();r.use(requireAuth,requireRole('admin'));r.post('/simulate',c.simulate);r.post('/:id/publish',c.publish);r.get('/:id',c.get);module.exports=r;
