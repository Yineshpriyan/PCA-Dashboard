import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Only initialize if keys are present to prevent fatal crash on module load
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Bypass cross-tab navigator.locks API to prevent "Lock was released because another request stole it"
        // when multiple tabs access the dashboard concurrently
        lock: async (_name, _acquireTimeout, fn) => {
          return await fn();
        },
      }
    })
  : null as any;

// Secondary client specifically for admin signup to prevent logging out the current super_admin session
export const authSignUpClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    })
  : null as any;

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing. Please add them in your Project Settings > Environment Variables or .env file.';
  console.error(errorMsg);
}
