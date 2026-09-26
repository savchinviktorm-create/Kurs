import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env';

let client;

export function getSupabaseAdmin() {
  if (!client) {
    client = createClient(
      requireEnv('SUPABASE_URL'),
      requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { 'X-Client-Info': 'technology-changes-miniapp-server' } }
      }
    );
  }
  return client;
}
