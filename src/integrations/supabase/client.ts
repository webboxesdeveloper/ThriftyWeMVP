import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

// Migrate session from sessionStorage to localStorage if it exists
// This ensures users stay logged in after the storage change
// Only run once on app initialization to avoid performance issues
try {
  const migrationKey = 'sb_session_migrated_v2';
  if (!localStorage.getItem(migrationKey)) {
    const sessionStorageKeys = Object.keys(sessionStorage);
    const supabaseKeys = sessionStorageKeys.filter(key => key.startsWith('sb-'));
    
    if (supabaseKeys.length > 0) {
      supabaseKeys.forEach(key => {
        try {
          const value = sessionStorage.getItem(key);
          if (value && !localStorage.getItem(key)) {
            localStorage.setItem(key, value);
          }
        } catch (e) {
          // Ignore individual key migration errors
        }
      });
    }
    
    // Mark migration as complete
    localStorage.setItem(migrationKey, 'true');
  }
} catch (error) {
  // Migration failed, continue anyway - silently fail
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage, // Use localStorage instead of sessionStorage to persist across redirects
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Prevent auto-signin from URL params
  }
});