'use strict';

const { createClient } = require('@supabase/supabase-js');
const { validateProductionEnv } = require('./env');
validateProductionEnv();

const url = process.env.SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';
const supabase = createClient(url, serviceRoleKey);
const BUCKET = 'winner-proofs';

async function uploadPrivateFile(path, buffer, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

async function getSignedUrl(path, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

module.exports = { uploadPrivateFile, getSignedUrl, BUCKET };
