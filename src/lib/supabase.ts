import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMsg = 'Supabase environment variables (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY) are missing. If you have deployed to Vercel, please add them in your Project Settings > Environment Variables.';
  console.error(errorMsg);
  if (typeof window !== 'undefined') {
    // Show a helpful error on the screen instead of just a white page
    window.addEventListener('DOMContentLoaded', () => {
      const root = document.getElementById('root');
      if (root) {
        root.innerHTML = `<div style="padding: 20px; color: #721c24; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; font-family: sans-serif; margin: 20px;">
          <h2 style="margin-top: 0;">Missing Configuration</h2>
          <p>${errorMsg}</p>
        </div>`;
      }
    });
  }
}
