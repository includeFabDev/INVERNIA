import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

export function getSupabaseClient() {
  const missing = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
    .filter((key) => !env[key] || !String(env[key]).trim());

  if (missing.length > 0) {
    throw new Error(
      `Missing required Supabase environment variables: ${missing.join(', ')}. ` +
      'Configure the backend .env before starting INVERNIA.'
    );
  }

  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

