'use strict';
const express=require('express');const c=require('../controllers/subscriptionController');const {requireAuth}=require('../middleware/auth');const r=express.Router();r.get('/plans',c.plans);r.use(requireAuth);r.post('/checkout',c.checkout);r.get('/me',c.mySubscription);r.post('/cancel',c.cancel);module.exports=r;
