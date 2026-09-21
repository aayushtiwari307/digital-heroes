'use strict';
const express=require('express');const c=require('../controllers/subscriptionController');const r=express.Router();r.post('/stripe',express.raw({type:'application/json'}),c.stripeWebhook);module.exports=r;
