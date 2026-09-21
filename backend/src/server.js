'use strict';
require('dotenv').config();
const {validateProductionEnv}=require('./config/env');validateProductionEnv();
const {createApp}=require('./app');
const app=createApp();const PORT=process.env.PORT||4000;app.listen(PORT,()=>console.log(`Digital Heroes API listening on :${PORT}`));
