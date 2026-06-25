import { createClient } from '@supabase/supabase-js';
import { safeStorage } from './safeStorage';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from './supabase-defaults';

// Read configuration from environment OR code-level defaults OR localStorage fallbacks
let rawSupabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  DEFAULT_SUPABASE_URL || 
  safeStorage.getItem('imsc_custom_supabase_url') || 
  '';

rawSupabaseUrl = rawSupabaseUrl.trim();

// Remove any trailing slashes repeatedly
while (rawSupabaseUrl.endsWith('/')) {
  rawSupabaseUrl = rawSupabaseUrl.slice(0, -1);
}

// Remove trailing /rest/v1 if present
if (rawSupabaseUrl.endsWith('/rest/v1')) {
  rawSupabaseUrl = rawSupabaseUrl.slice(0, -8);
}

// Strip trailing slashes again just in case
while (rawSupabaseUrl.endsWith('/')) {
  rawSupabaseUrl = rawSupabaseUrl.slice(0, -1);
}

const supabaseUrl = rawSupabaseUrl;

const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  DEFAULT_SUPABASE_ANON_KEY || 
  safeStorage.getItem('imsc_custom_supabase_anon_key') || 
  ''
).trim();

// Detect if environment credentials are mechanically present
const environmentHasCredentials = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')) &&
  supabaseUrl !== 'https://your-project.supabase.co' && 
  !supabaseUrl.includes('placeholder')
);

// Allow user to manually trigger or auto-fallback to simulated mock client safely
export const isSupabaseConfigured = environmentHasCredentials && safeStorage.getItem('imsc_force_mock_supabase') !== 'true';

// --- LOCAL STORAGE DATA SEEDERS ---
const initializeLocalStorageSchema = () => {
  // If there's an existing fees mock data, let's fix it to 1000!
  const feesKey = 'imsc_supabase_mock_fees';
  const existingFeesStr = safeStorage.getItem(feesKey);
  if (existingFeesStr) {
    try {
      const existingFees = JSON.parse(existingFeesStr);
      let updated = false;
      const mappedFees = existingFees.map((f: any) => {
        if (f.id === 'fee-1' && (f.amount === 5000 || f.name?.toLowerCase().includes('admission'))) {
          updated = true;
          return { ...f, name: 'Admission & Prospectus Fee', amount: 1000 };
        }
        return f;
      });
      if (updated || !existingFees.some((f: any) => f.id === 'fee-1')) {
        safeStorage.setItem(feesKey, JSON.stringify(mappedFees));
      }
    } catch (e) {
      // Ignore
    }
  }

  // Force admission fee amount in localstorage to 1000
  safeStorage.setItem('imsc_admission_fee_amount', '1000');

  // If there's an old cached key, replace it with the live key
  const cachedPaystackKey = safeStorage.getItem('imsc_paystack_public_key');
  if (!cachedPaystackKey || cachedPaystackKey.includes('pk_test_d30e527d704ba348eb46cf4619d8bd075ca825db')) {
    safeStorage.setItem('imsc_paystack_public_key', 'pk_live_322d4bde836a684b28f791049b8c3997742c8985');
  }

  const tables = [
    'profiles', 'students', 'applicants', 'payments', 
    'teachers', 'results', 'fees', 'announcements', 'gallery', 'config'
  ];
  
  tables.forEach(table => {
    const key = `imsc_supabase_mock_${table}`;
    if (!safeStorage.getItem(key)) {
      safeStorage.setItem(key, JSON.stringify([]));
    }
  });

  // Seed default admin and teacher accounts for testing if missing
  const profileKey = 'imsc_supabase_mock_profiles';
  let currentProfiles = [];
  try {
    currentProfiles = JSON.parse(safeStorage.getItem(profileKey) || '[]');
  } catch (e) {
    console.warn("Corrupt profiles detected in mock storage. Resetting schema...", e);
    currentProfiles = [];
  }
  
  if (!Array.isArray(currentProfiles) || currentProfiles.length === 0) {
    const defaultProfiles = [
      { id: 'mock-admin-id', email: 'admin@school.com', role: 'admin', displayName: 'School Admin' },
      { id: 'mock-teacher-id', email: 'teacher@school.com', role: 'teacher', displayName: 'Mr. Okonjo' },
      { id: 'mock-student-id', email: 'student@school.com', role: 'student', displayName: 'Abubakar Ibrahim' }
    ];
    safeStorage.setItem(profileKey, JSON.stringify(defaultProfiles));
  }
};

if (!isSupabaseConfigured) {
  initializeLocalStorageSchema();
}

// Helper to interact with Mock database
const getMockData = (table: string): any[] => {
  const data = safeStorage.getItem(`imsc_supabase_mock_${table}`);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`Error parsing mock table data for "${table}":`, err);
    return [];
  }
};

const saveMockData = (table: string, data: any[]) => {
  safeStorage.setItem(`imsc_supabase_mock_${table}`, JSON.stringify(data));
};

// --- CLIENT-SIDE MOCK CLIENT GENERATOR ---
const generateMockSupabaseClient = () => {
  const listeners: Set<any> = new Set();
  
  const triggerAuthChange = (event: string, session: any) => {
    listeners.forEach(cb => {
      try {
        cb(event, session);
      } catch (err) {
        console.error("Error invoking mock auth listener:", err);
      }
    });
  };

  return {
    auth: {
      signUp: async ({ email, password, options }: any) => {
        console.log('[Mock Supabase Auth] Registering user:', email);
        const profiles = getMockData('profiles');
        
        // Prevent duplicate register email in mock mode
        if (profiles.some(p => p.email === email)) {
          return { data: { user: null }, error: { message: 'User already exists' } };
        }

        const mockId = 'usr-' + Math.floor(Math.random() * 1000000);
        let role = 'applicant';
        const emailLower = email.toLowerCase();
        if (emailLower.includes('admin')) {
          role = 'admin';
        } else if (emailLower.includes('teacher')) {
          role = 'teacher';
        } else if (emailLower.includes('student')) {
          role = 'student';
        }

        const meta = options?.data || {};
        const newProfile = {
          id: mockId,
          email,
          role,
          displayName: meta.displayName || email.split('@')[0],
          createdAt: new Date().toISOString()
        };

        profiles.push(newProfile);
        saveMockData('profiles', profiles);

        const mockUser = {
          id: mockId,
          email,
          user_metadata: meta
        };

        const session = {
          user: mockUser,
          access_token: 'mock-token'
        };

        safeStorage.setItem('imsc_active_user_id', mockId);
        
        // Notify subscription listeners of sign up
        setTimeout(() => triggerAuthChange('SIGNED_IN', session), 0);

        return { data: { user: mockUser, session }, error: null };
      },
      signInWithPassword: async ({ email, password }: any) => {
        console.log('[Mock Supabase Auth] Logging in:', email);
        const profiles = getMockData('profiles');
        let userProfile = profiles.find(p => p.email === email);
        
        if (!userProfile) {
          console.log('[Mock Supabase Auth] Auto-registering user on new device:', email);
          const mockId = 'usr-' + Math.floor(Math.random() * 1000000);
          let role = 'applicant';
          const emailLower = email.toLowerCase();
          if (emailLower.includes('admin')) {
            role = 'admin';
          } else if (emailLower.includes('teacher')) {
            role = 'teacher';
          } else if (emailLower.includes('student')) {
            role = 'student';
          }

          userProfile = {
            id: mockId,
            email,
            role,
            displayName: email.split('@')[0],
            createdAt: new Date().toISOString()
          };

          profiles.push(userProfile);
          saveMockData('profiles', profiles);
        }

        const mockUser = {
          id: userProfile.id,
          email: userProfile.email,
          user_metadata: { displayName: userProfile.displayName }
        };

        const session = {
          user: mockUser,
          access_token: 'mock-token'
        };

        safeStorage.setItem('imsc_active_user_id', userProfile.id);

        setTimeout(() => triggerAuthChange('SIGNED_IN', session), 0);

        return { data: { user: mockUser, session }, error: null };
      },
      signOut: async () => {
        console.log('[Mock Supabase Auth] Logged out.');
        safeStorage.removeItem('imsc_active_user_id');
        setTimeout(() => triggerAuthChange('SIGNED_OUT', null), 0);
        return { error: null };
      },
      getSession: async () => {
        const activeUserId = safeStorage.getItem('imsc_active_user_id');
        if (!activeUserId) return { data: { session: null }, error: null };
        const profiles = getMockData('profiles');
        const userProfile = profiles.find(p => p.id === activeUserId);
        if (!userProfile) return { data: { session: null }, error: null };

        return {
          data: {
            session: {
              user: { id: userProfile.id, email: userProfile.email, user_metadata: { displayName: userProfile.displayName } },
              access_token: 'mock-token'
            }
          },
          error: null
        };
      },
      onAuthStateChange: (callback: any) => {
        listeners.add(callback);
        
        // Initial trigger
        const activeUserId = safeStorage.getItem('imsc_active_user_id');
        if (activeUserId) {
          const profiles = getMockData('profiles');
          const userProfile = profiles.find(p => p.id === activeUserId);
          if (userProfile) {
            const mockUser = {
              id: userProfile.id,
              email: userProfile.email,
              user_metadata: { displayName: userProfile.displayName }
            };
            const session = { user: mockUser, access_token: 'mock-token' };
            setTimeout(() => callback('SIGNED_IN', session), 0);
          } else {
            setTimeout(() => callback('SIGNED_OUT', null), 0);
          }
        } else {
          setTimeout(() => callback('SIGNED_OUT', null), 0);
        }

        return { 
          data: { 
            subscription: { 
              unsubscribe: () => { 
                listeners.delete(callback); 
              } 
            } 
          } 
        };
      }
    },
    
    from: (table: string) => {
      return {
        select: (columns: string = '*') => {
          let rows = getMockData(table);
          if (table === 'fees' && rows.length === 0) {
            rows = [
              { id: 'fee-1', name: 'Admission & Prospectus Fee', amount: 5000, description: 'Mandatory registration fee for new applicants' }
            ];
            saveMockData('fees', rows);
          }
          if (table === 'config' && rows.length === 0) {
            rows = [
              {
                id: 'admission_settings',
                netlifyFormUrl: 'https://formbold.com/s/9mBJY',
                useExternalForm: false,
                paystackPublicKey: 'pk_live_322d4bde836a684b28f791049b8c3997742c8985',
                admissionFeeAmount: 1000,
                updatedAt: new Date().toISOString()
              }
            ];
            saveMockData('config', rows);
          }
          
          const chain = {
            eq: (colName: string, val: any) => {
              rows = rows.filter(r => r[colName] === val);
              return chain;
            },
            neq: (colName: string, val: any) => {
              rows = rows.filter(r => r[colName] !== val);
              return chain;
            },
            order: (colName: string, { ascending } = { ascending: true }) => {
              rows = [...rows].sort((a, b) => {
                if (a[colName] < b[colName]) return ascending ? -1 : 1;
                if (a[colName] > b[colName]) return ascending ? 1 : -1;
                return 0;
              });
              return chain;
            },
            limit: (count: number) => {
              rows = rows.slice(0, count);
              return chain;
            },
            single: async () => {
              return { data: rows[0] || null, error: rows.length ? null : { message: 'Row not found' } };
            },
            then: (onfulfilled: any) => {
              return Promise.resolve({ data: rows, error: null }).then(onfulfilled);
            }
          };

          // Mimic Promise compatibility
          (chain as any).then = (onfulfilled: any) => {
            return Promise.resolve({ data: rows, error: null }).then(onfulfilled);
          };

          return chain as any;
        },
        
        insert: (input: any) => {
          let rows = getMockData(table);
          const payloadArray = Array.isArray(input) ? input : [input];
          
          const newRows = payloadArray.map(item => {
            return {
              id: item.id || 'rec-' + Math.floor(Math.random() * 10000000),
              created_at: new Date().toISOString(),
              ...item
            };
          });

          newRows.forEach(newRow => {
            const index = rows.findIndex(r => r.id === newRow.id);
            if (index > -1) {
              rows[index] = { ...rows[index], ...newRow };
            } else {
              rows.push(newRow);
            }
          });

          saveMockData(table, rows);

          const chain = {
            select: () => {
              return {
                single: async () => ({ data: newRows[0], error: null }),
                then: (onfulfilled: any) => Promise.resolve({ data: newRows, error: null }).then(onfulfilled)
              } as any;
            },
            then: (onfulfilled: any) => Promise.resolve({ data: newRows, error: null }).then(onfulfilled)
          };

          return chain as any;
        },

        upsert: (input: any) => {
          let rows = getMockData(table);
          const payloadArray = Array.isArray(input) ? input : [input];
          
          const newRows = payloadArray.map(item => {
            return {
              id: item.id || 'rec-' + Math.floor(Math.random() * 10000000),
              created_at: new Date().toISOString(),
              ...item
            };
          });

          newRows.forEach(newRow => {
            const index = rows.findIndex(r => r.id === newRow.id);
            if (index > -1) {
              rows[index] = { ...rows[index], ...newRow, updated_at: new Date().toISOString() };
            } else {
              rows.push(newRow);
            }
          });

          saveMockData(table, rows);

          const chain = {
            select: () => {
              return {
                single: async () => ({ data: newRows[0], error: null }),
                then: (onfulfilled: any) => Promise.resolve({ data: newRows, error: null }).then(onfulfilled)
              } as any;
            },
            then: (onfulfilled: any) => Promise.resolve({ data: newRows, error: null }).then(onfulfilled)
          };

          return chain as any;
        },

        update: (updates: any) => {
          let rows = getMockData(table);
          let targetFilter: { col: string; val: any } | null = null;

          const chain = {
            eq: (colName: string, val: any) => {
              targetFilter = { col: colName, val };
              
              // Apply update immediately
              if (targetFilter) {
                rows = rows.map(r => {
                  if (r[targetFilter!.col] === targetFilter!.val) {
                    return { ...r, ...updates, updated_at: new Date().toISOString() };
                  }
                  return r;
                });
                saveMockData(table, rows);
              }
              return chain;
            },
            select: () => {
              const matched = targetFilter ? rows.filter(r => r[targetFilter!.col] === targetFilter!.val) : [];
              return {
                single: async () => ({ data: matched[0] || null, error: null }),
                then: (onfulfilled: any) => Promise.resolve({ data: matched, error: null }).then(onfulfilled)
              } as any;
            },
            then: (onfulfilled: any) => {
              const matched = targetFilter ? rows.filter(r => r[targetFilter!.col] === targetFilter!.val) : [];
              return Promise.resolve({ data: matched, error: null }).then(onfulfilled);
            }
          };

          return chain as any;
        },

        delete: () => {
          let rows = getMockData(table);
          
          const chain = {
            eq: (colName: string, val: any) => {
              const beforeCount = rows.length;
              rows = rows.filter(r => r[colName] !== val);
              saveMockData(table, rows);
              return chain;
            },
            then: (onfulfilled: any) => {
              return Promise.resolve({ data: [], error: null }).then(onfulfilled);
            }
          };

          return chain as any;
        }
      };
    },

    storage: {
      from: (bucket: string) => {
        return {
          upload: async (filePath: string, file: any, options?: any) => {
            console.log(`[Mock Supabase Storage] Uploading file to bucket "${bucket}" at: "${filePath}"`);
            
            // Create a pseudo base64 or URL
            const url = URL.createObjectURL(file instanceof Blob ? file : new Blob([file]));
            return { data: { path: filePath, url }, error: null };
          },
          getPublicUrl: (filePath: string) => {
            // Check if it's already an active object URL
            return { data: { publicUrl: `https://pwhmpxqszgixvdwjqusn.supabase.co/storage/v1/object/public/${bucket}/${filePath}` } };
          }
        };
      }
    },

    rpc: async (functionName: string, args?: any) => {
      console.log(`[Mock Supabase RPC] Executing RPC: ${functionName}`, args);
      return { data: { success: true }, error: null };
    }
  };
};

// Export actual or gracefully mocked client
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : (generateMockSupabaseClient() as any);
