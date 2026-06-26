/**
 * DEFAULT SUPABASE CONNECTION CREDENTIALS
 * 
 * To make the school portal run out-of-the-box for all parents, students, and teachers on any device,
 * you can define your production Supabase database credentials here.
 * 
 * If these are left blank, the application will attempt to read from:
 * 1. Your hosting environment variables (e.g., Netlify settings)
 * 2. Or fallback to local browser-specific configuration (which is only visible to the admin who set it up).
 */

// These defaults are intentionally empty. Provide credentials via Netlify environment variables:
// NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, VITE_PAYSTACK_PUBLIC_KEY
export const DEFAULT_SUPABASE_URL = "";
export const DEFAULT_SUPABASE_ANON_KEY = "";
export const DEFAULT_PAYSTACK_PUBLIC_KEY = "";
