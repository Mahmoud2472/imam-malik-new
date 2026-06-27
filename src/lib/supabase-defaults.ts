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

export const DEFAULT_SUPABASE_URL = 
  (import.meta.env?.VITE_SUPABASE_URL as string) || 
  (import.meta.env?.NEXT_PUBLIC_SUPABASE_URL as string) || 
  "";

export const DEFAULT_SUPABASE_ANON_KEY = 
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || 
  (import.meta.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string) || 
  "";

export const DEFAULT_PAYSTACK_PUBLIC_KEY = 
  (import.meta.env?.VITE_PAYSTACK_PUBLIC_KEY as string) || 
  "pk_live_322d4bde836a684b28f791049b8c3997742c8985";
