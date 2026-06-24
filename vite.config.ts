import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  
  // 1. Detect Supabase URL
  let supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
  if (!supabaseUrl) {
    const urlKey = Object.keys(env).find(k => {
      const val = env[k] || '';
      return val.startsWith('https://') && val.includes('.supabase.co');
    });
    if (urlKey) {
      supabaseUrl = env[urlKey];
    }
  }

  // 2. Detect Supabase Anon/Publishable Key
  let supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
  if (!supabaseAnonKey) {
    const keyKey = Object.keys(env).find(k => {
      const val = env[k] || '';
      return val.startsWith('sb_publishable_') || (val.startsWith('eyJ') && val.length > 50);
    });
    if (keyKey) {
      supabaseAnonKey = env[keyKey];
    }
  }

  // 3. Detect Paystack Public Key
  let paystackPublicKey = env.VITE_PAYSTACK_PUBLIC_KEY || env.PAYSTACK_PUBLIC_KEY || '';
  if (!paystackPublicKey) {
    const payKey = Object.keys(env).find(k => {
      const val = env[k] || '';
      return (val.startsWith('pk_live_') || val.startsWith('pk_test_')) && !val.includes('placeholder');
    });
    if (payKey) {
      paystackPublicKey = env[payKey];
    }
  }

  console.log('Auto-detected environment settings:', {
    hasSupabaseUrl: !!supabaseUrl,
    hasSupabaseKey: !!supabaseAnonKey,
    hasPaystackKey: !!paystackPublicKey
  });

  const filteredKeys = Object.keys(env).filter(k => 
    !k.startsWith('npm_') && 
    !k.startsWith('PATH') && 
    !k.startsWith('NODE_') && 
    !k.startsWith('DEBIAN_') && 
    !k.startsWith('SHLVL') && 
    !k.startsWith('HOME') && 
    !k.startsWith('LANG') && 
    !k.startsWith('GCP_') && 
    !k.startsWith('CLOUD_')
  );
  console.log('--- ALL SYSTEM ENV KEYS DETECTED ---');
  console.log(JSON.stringify(filteredKeys));
  console.log('------------------------------------');

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.gemini || ''),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
      'import.meta.env.VITE_PAYSTACK_PUBLIC_KEY': JSON.stringify(paystackPublicKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'firebase/app': path.resolve(__dirname, './src/lib/firebase-mock.ts'),
        'firebase/auth': path.resolve(__dirname, './src/lib/firebase-mock.ts'),
        'firebase/firestore': path.resolve(__dirname, './src/lib/firebase-mock.ts'),
        'firebase/storage': path.resolve(__dirname, './src/lib/firebase-mock.ts'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
