import process from 'node:process';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bgRed: '\x1b[41m',
};

console.log(`\n${colors.bright}${colors.cyan}====================================================${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}      NETLIFY DEPLOYMENT ENVIRONMENT VERIFICATION     ${colors.reset}`);
console.log(`${colors.bright}${colors.cyan}====================================================${colors.reset}\n`);

// Determine context
const isNetlify = !!process.env.NETLIFY;
console.log(`Build Environment: ${isNetlify ? `${colors.green}Netlify CI` : `${colors.yellow}Local/Other`}${colors.reset}\n`);

const checks = [
  {
    name: 'Supabase URL',
    keys: ['VITE_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'],
    required: true,
    description: 'Used to connect to your Supabase backend instance.',
    validate: (val) => typeof val === 'string' && val.trim().length > 0
  },
  {
    name: 'Supabase Anon Key',
    keys: ['VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'],
    required: true,
    description: 'The public API key for your Supabase project.',
    validate: (val) => typeof val === 'string' && val.trim().length > 0
  },
  {
    name: 'Paystack Public Key',
    keys: ['VITE_PAYSTACK_PUBLIC_KEY'],
    required: false,
    description: 'Used to initialize secure Paystack payment gateway widgets.',
    validate: (val) => typeof val === 'string' && val.trim().length > 0
  }
];

let hasErrors = false;
let hasWarnings = false;

const results = [];

for (const check of checks) {
  let foundKey = null;
  let value = null;
  
  for (const key of check.keys) {
    if (process.env[key]) {
      let rawVal = process.env[key].trim();
      // Strip wrapping quotes if any
      if ((rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"))) {
        rawVal = rawVal.slice(1, -1).trim();
      }
      if (rawVal) {
        foundKey = key;
        value = rawVal;
        break;
      }
    }
  }

  if (value) {
    const isValid = check.validate ? check.validate(value) : true;
    if (isValid) {
      results.push({
        status: 'SUCCESS',
        name: check.name,
        keyUsed: foundKey,
        message: `Configured via ${foundKey}`
      });
    } else {
      results.push({
        status: 'WARNING',
        name: check.name,
        keyUsed: foundKey,
        message: `Value of ${foundKey} exists but failed basic pattern validation (e.g., prefix or format)`
      });
      hasWarnings = true;
    }
  } else {
    if (check.required) {
      results.push({
        status: 'ERROR',
        name: check.name,
        keysChecked: check.keys,
        message: `Missing required variable. Checked: ${check.keys.join(', ')}`
      });
      hasErrors = true;
    } else {
      results.push({
        status: 'OPTIONAL_MISSING',
        name: check.name,
        keysChecked: check.keys,
        message: `Optional variable not configured. Default/fallback value will be used.`
      });
      hasWarnings = true;
    }
  }
}

// Print results table
console.log(`${colors.bright}Verification Summary:${colors.reset}`);
console.log(`----------------------------------------------------`);
for (const res of results) {
  let statusText = '';
  if (res.status === 'SUCCESS') {
    statusText = `${colors.green}[PASS]${colors.reset}`;
  } else if (res.status === 'ERROR') {
    statusText = `${colors.red}[FAIL]${colors.reset}`;
  } else if (res.status === 'WARNING') {
    statusText = `${colors.yellow}[WARN]${colors.reset}`;
  } else {
    statusText = `${colors.yellow}[INFO]${colors.reset}`;
  }
  
  console.log(`${statusText} ${colors.bright}${res.name}${colors.reset}`);
  console.log(`       Status:  ${res.message}`);
  console.log(`----------------------------------------------------`);
}

if (hasErrors) {
  console.log(`\n${colors.bright}${colors.bgRed} DEPLOYMENT CHECK FAILED ${colors.reset}\n`);
  console.log(`${colors.bright}How to fix this error in Netlify:${colors.reset}`);
  console.log(`1. Go to your Netlify Dashboard.`);
  console.log(`2. Navigate to: ${colors.bright}Site settings > Build & deploy > Environment > Environment variables${colors.reset}.`);
  console.log(`3. Add the following keys with their respective values from your Supabase Dashboard:`);
  console.log(`   - ${colors.cyan}NEXT_PUBLIC_SUPABASE_URL${colors.reset}  (e.g., https://your-project.supabase.co)`);
  console.log(`   - ${colors.cyan}NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY${colors.reset}  (your anon/public key)`);
  console.log(`4. Trigger a new deploy!`);
  console.log(`\n${colors.bright}${colors.red}Error: Build halted because required environment configuration is missing.${colors.reset}\n`);
  process.exit(1);
} else {
  console.log(`\n${colors.bright}${colors.green}✓ ALL REQUIRED ENVIRONMENT VARIABLES VERIFIED SUCCESSFULLY!${colors.reset}`);
  if (hasWarnings) {
    console.log(`${colors.yellow}Note: Some optional variables or warnings were noted, but they will not block the build.${colors.reset}`);
  }
  console.log(`Proceeding to build...\n`);
  process.exit(0);
}
