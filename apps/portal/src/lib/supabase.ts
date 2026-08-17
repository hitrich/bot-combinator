import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

export const portalConfigured = Boolean(supabaseUrl && publishableKey);
export const demoMode =
  import.meta.env.VITE_PORTAL_DEMO_MODE === 'true' || (import.meta.env.DEV && !portalConfigured);

export const supabase: SupabaseClient<Database> | null = portalConfigured
  ? createClient<Database>(supabaseUrl, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : null;

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new Error('The portal has not been connected to Supabase.');
  return supabase;
}
