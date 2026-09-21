'use strict';

require('dotenv').config();

const { Pool } = require('pg');
const { validateProductionEnv } = require('./env');
validateProductionEnv();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/digital_heroes_test';
const pool = new Pool({ connectionString });

module.exports = { pool };

