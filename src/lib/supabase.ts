import { createClient } from '@supabase/supabase-js';
import { safeStorage } from './safeStorage';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from './supabase-defaults';
import { db, auth } from './firebase';

// Read configuration from browser local storage OR environment OR code-level defaults
let rawSupabaseUrl = 
  safeStorage.getItem('imsc_custom_supabase_url') || 
  import.meta.env.VITE_SUPABASE_URL || 
  DEFAULT_SUPABASE_URL || 
  '';

rawSupabaseUrl = rawSupabaseUrl.trim();

// If rawSupabaseUrl is specified but has no protocol, auto-prepend https://
if (rawSupabaseUrl && !rawSupabaseUrl.startsWith('http://') && !rawSupabaseUrl.startsWith('https://')) {
  rawSupabaseUrl = 'https://' + rawSupabaseUrl;
}

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
  safeStorage.getItem('imsc_custom_supabase_anon_key') || 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  DEFAULT_SUPABASE_ANON_KEY || 
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
  // We use real Firebase Auth and Firestore when Supabase is not configured
  const listeners: Set<any> = new Set();

  // Helper for Firestore queries and caching
  const getFirebaseData = async (
    table: string, 
    filters: any[], 
    orderField: string | null, 
    orderDirection: 'asc' | 'desc', 
    limitCount: number | null
  ) => {
    try {
      const { collection, getDocs, query, where, orderBy, limit, doc, getDoc } = await import('firebase/firestore');

      // Check single doc query by id
      const idFilter = filters.find(f => f.colName === 'id' && f.op === '==');
      if (idFilter) {
        const docRef = doc(db, table, idFilter.val);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          return [{ id: docSnap.id, ...docSnap.data() }];
        } else {
          return [];
        }
      }

      const qConstraints: any[] = [];
      filters.forEach(f => {
        qConstraints.push(where(f.colName, f.op, f.val));
      });

      if (orderField) {
        qConstraints.push(orderBy(orderField, orderDirection));
      }
      if (limitCount !== null) {
        qConstraints.push(limit(limitCount));
      }

      const q = query(collection(db, table), ...qConstraints);
      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map(docObj => ({ id: docObj.id, ...docObj.data() }));

      // Fallbacks if Firestore returns empty
      if (docs.length === 0) {
        if (table === 'fees') {
          return [
            { id: 'fee-1', name: 'Admission & Prospectus Fee', amount: 1000, description: 'Mandatory registration fee for new applicants' },
            { id: 'fee-2', name: '1st Term School Fees', amount: 35000, description: 'Tuition and learning materials' },
            { id: 'fee-3', name: 'School Uniform Pack', amount: 10000, description: 'Custom college uniform and sportswear' }
          ];
        }
        if (table === 'config') {
          return [
            {
              id: 'admission_settings',
              netlifyFormUrl: 'https://formbold.com/s/9mBJY',
              useExternalForm: false,
              paystackPublicKey: 'pk_live_322d4bde836a684b28f791049b8c3997742c8985',
              admissionFeeAmount: 1000,
              updatedAt: new Date().toISOString()
            }
          ];
        }
      }

      return docs;
    } catch (err) {
      console.warn(`Firestore read fallback for table ${table} failed, using local storage.`, err);
      // Local storage fallback
      let rows = getMockData(table);
      filters.forEach(f => {
        if (f.op === '==') {
          rows = rows.filter(r => r[f.colName] === f.val);
        } else if (f.op === '!=') {
          rows = rows.filter(r => r[f.colName] !== f.val);
        }
      });
      if (orderField) {
        rows = [...rows].sort((a, b) => {
          if (a[orderField] < b[orderField]) return orderDirection === 'asc' ? -1 : 1;
          if (a[orderField] > b[orderField]) return orderDirection === 'asc' ? 1 : -1;
          return 0;
        });
      }
      if (limitCount !== null) {
        rows = rows.slice(0, limitCount);
      }
      return rows;
    }
  };

  const saveFirebaseData = async (table: string, payloadArray: any[]) => {
    try {
      const { doc, setDoc } = await import('firebase/firestore');

      const savedRows = [];
      for (const item of payloadArray) {
        const id = item.id || 'rec-' + Math.floor(Math.random() * 10000000);
        const docRef = doc(db, table, id);
        const payload = {
          id,
          created_at: new Date().toISOString(),
          ...item
        };
        await setDoc(docRef, payload, { merge: true });
        savedRows.push(payload);
      }
      return savedRows;
    } catch (err) {
      console.warn(`Firestore write fallback for table ${table} failed, using local storage.`, err);
      // Local storage write
      let rows = getMockData(table);
      const savedRows: any[] = [];
      payloadArray.forEach(item => {
        const id = item.id || 'rec-' + Math.floor(Math.random() * 10000000);
        const payload = {
          id,
          created_at: new Date().toISOString(),
          ...item
        };
        const idx = rows.findIndex(r => r.id === id);
        if (idx > -1) {
          rows[idx] = { ...rows[idx], ...payload };
        } else {
          rows.push(payload);
        }
        savedRows.push(payload);
      });
      saveMockData(table, rows);
      return savedRows;
    }
  };

  const updateFirebaseData = async (table: string, filters: any[], updates: any) => {
    try {
      const { doc, updateDoc, collection, getDocs, query, where } = await import('firebase/firestore');

      const idFilter = filters.find(f => f.colName === 'id' && f.op === '==');
      if (idFilter) {
        const docRef = doc(db, table, idFilter.val);
        await updateDoc(docRef, {
          ...updates,
          updated_at: new Date().toISOString()
        });
        return [{ id: idFilter.val, ...updates }];
      }

      const qConstraints = filters.map(f => where(f.colName, f.op, f.val));
      const q = query(collection(db, table), ...qConstraints);
      const snapshot = await getDocs(q);
      const updatedRows = [];
      for (const docObj of snapshot.docs) {
        const docRef = doc(db, table, docObj.id);
        await updateDoc(docRef, {
          ...updates,
          updated_at: new Date().toISOString()
        });
        updatedRows.push({ id: docObj.id, ...docObj.data(), ...updates });
      }
      return updatedRows;
    } catch (err) {
      console.warn(`Firestore update fallback for table ${table} failed, using local storage.`, err);
      // Local storage update
      let rows = getMockData(table);
      const updatedRows: any[] = [];
      rows = rows.map(r => {
        let matches = true;
        filters.forEach(f => {
          if (f.op === '==') {
            if (r[f.colName] !== f.val) matches = false;
          } else if (f.op === '!=') {
            if (r[f.colName] === f.val) matches = false;
          }
        });
        if (matches) {
          const updated = { ...r, ...updates, updated_at: new Date().toISOString() };
          updatedRows.push(updated);
          return updated;
        }
        return r;
      });
      saveMockData(table, rows);
      return updatedRows;
    }
  };

  const deleteFirebaseData = async (table: string, filters: any[]) => {
    try {
      const { doc, deleteDoc, collection, getDocs, query, where } = await import('firebase/firestore');

      const idFilter = filters.find(f => f.colName === 'id' && f.op === '==');
      if (idFilter) {
        const docRef = doc(db, table, idFilter.val);
        await deleteDoc(docRef);
        return { error: null };
      }

      const qConstraints = filters.map(f => where(f.colName, f.op, f.val));
      const q = query(collection(db, table), ...qConstraints);
      const snapshot = await getDocs(q);
      for (const docObj of snapshot.docs) {
        const docRef = doc(db, table, docObj.id);
        await deleteDoc(docRef);
      }
      return { error: null };
    } catch (err: any) {
      console.error(`Error deleting from table ${table}:`, err);
      return { error: err };
    }
  };

  return {
    auth: {
      signUp: async ({ email, password, options }: any) => {
        console.log('[Firebase Auth Proxy] Registering:', email);
        try {
          const { createUserWithEmailAndPassword } = await import('firebase/auth');
          const { doc, setDoc } = await import('firebase/firestore');

          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          const meta = options?.data || {};
          let role = meta.role || 'applicant';
          const emailLower = email.toLowerCase();
          if (emailLower.includes('admin')) {
            role = 'admin';
          } else if (emailLower.includes('teacher')) {
            role = 'teacher';
          } else if (emailLower.includes('student')) {
            role = 'student';
          }

          const profilePayload = {
            id: user.uid,
            email,
            role,
            displayName: meta.displayName || email.split('@')[0],
            createdAt: new Date().toISOString()
          };

          // Store profile in both 'profiles' and 'users' collections for firestore.rules and compatibility
          await setDoc(doc(db, 'profiles', user.uid), profilePayload);
          await setDoc(doc(db, 'users', user.uid), profilePayload);

          const mockUser = { id: user.uid, email, user_metadata: meta };
          const session = { user: mockUser, access_token: 'firebase-token' };

          safeStorage.setItem('imsc_active_user_id', user.uid);
          return { data: { user: mockUser, session }, error: null };
        } catch (err: any) {
          console.error("Firebase signUp proxy failure:", err);
          return { data: { user: null }, error: err };
        }
      },
      signInWithPassword: async ({ email, password }: any) => {
        console.log('[Firebase Auth Proxy] Signing in:', email);
        try {
          const { signInWithEmailAndPassword } = await import('firebase/auth');
          const { doc, getDoc, setDoc } = await import('firebase/firestore');

          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          // Fetch or auto-provision profile
          let profileDoc = await getDoc(doc(db, 'profiles', user.uid));
          let profile = profileDoc.data();

          if (!profile) {
            let role = 'applicant';
            const emailLower = email.toLowerCase();
            if (emailLower.includes('admin')) {
              role = 'admin';
            } else if (emailLower.includes('teacher')) {
              role = 'teacher';
            } else if (emailLower.includes('student')) {
              role = 'student';
            }

            profile = {
              id: user.uid,
              email,
              role,
              displayName: email.split('@')[0],
              createdAt: new Date().toISOString()
            };

            await setDoc(doc(db, 'profiles', user.uid), profile);
            await setDoc(doc(db, 'users', user.uid), profile);
          }

          const mockUser = {
            id: user.uid,
            email: user.email,
            user_metadata: { displayName: profile.displayName || user.displayName }
          };

          const session = { user: mockUser, access_token: 'firebase-token' };
          safeStorage.setItem('imsc_active_user_id', user.uid);
          return { data: { user: mockUser, session }, error: null };
        } catch (err: any) {
          console.error("Firebase signInWithPassword proxy failure:", err);
          return { data: { user: null }, error: err };
        }
      },
      signOut: async () => {
        console.log('[Firebase Auth Proxy] Signing out...');
        try {
          const { signOut: fbSignOut } = await import('firebase/auth');
          await fbSignOut(auth);
          safeStorage.removeItem('imsc_active_user_id');
          return { error: null };
        } catch (err: any) {
          console.error("Firebase signOut proxy failure:", err);
          return { error: err };
        }
      },
      getSession: async () => {
        try {
          const { doc, getDoc } = await import('firebase/firestore');
          const user = auth.currentUser;
          if (!user) {
            return { data: { session: null }, error: null };
          }

          let displayName = user.displayName || user.email?.split('@')[0] || '';
          try {
            const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
            if (profileDoc.exists()) {
              displayName = profileDoc.data().displayName || displayName;
            }
          } catch (e) {
            // Suppress secondary read error
          }

          return {
            data: {
              session: {
                user: { id: user.uid, email: user.email, user_metadata: { displayName } },
                access_token: 'firebase-token'
              }
            },
            error: null
          };
        } catch (err: any) {
          return { data: { session: null }, error: err };
        }
      },
      onAuthStateChange: (callback: any) => {
        listeners.add(callback);
        let unsubscribeFirebase: any = null;

        // Subscribe to real Firebase auth
        import('firebase/auth').then(({ onAuthStateChanged }) => {
          unsubscribeFirebase = onAuthStateChanged(auth, async (user) => {
            if (user) {
              let displayName = user.displayName || user.email?.split('@')[0] || '';
              try {
                const { doc, getDoc } = await import('firebase/firestore');
                const profileDoc = await getDoc(doc(db, 'profiles', user.uid));
                if (profileDoc.exists()) {
                  displayName = profileDoc.data().displayName || displayName;
                }
              } catch (e) {
                // Suppress profile fetch error
              }

              const mockUser = {
                id: user.uid,
                email: user.email,
                user_metadata: { displayName }
              };
              const session = { user: mockUser, access_token: 'firebase-token' };
              safeStorage.setItem('imsc_active_user_id', user.uid);
              callback('SIGNED_IN', session);
            } else {
              safeStorage.removeItem('imsc_active_user_id');
              callback('SIGNED_OUT', null);
            }
          });
        });

        return {
          data: {
            subscription: {
              unsubscribe: () => {
                listeners.delete(callback);
                if (unsubscribeFirebase) unsubscribeFirebase();
              }
            }
          }
        };
      }
    },

    from: (table: string) => {
      let filters: Array<{ colName: string; op: '==' | '!='; val: any }> = [];
      let orderField: string | null = null;
      let orderDirection: 'asc' | 'desc' = 'asc';
      let limitCount: number | null = null;

      const chain = {
        select: (columns: string = '*') => {
          return chain;
        },
        eq: (colName: string, val: any) => {
          filters.push({ colName, op: '==', val });
          return chain;
        },
        neq: (colName: string, val: any) => {
          filters.push({ colName, op: '!=', val });
          return chain;
        },
        order: (colName: string, { ascending } = { ascending: true }) => {
          orderField = colName;
          orderDirection = ascending ? 'asc' : 'desc';
          return chain;
        },
        limit: (count: number) => {
          limitCount = count;
          return chain;
        },
        single: async () => {
          const res = await getFirebaseData(table, filters, orderField, orderDirection, limitCount);
          return { data: res[0] || null, error: res.length ? null : { message: 'Row not found' } };
        },
        then: (onfulfilled: any) => {
          return getFirebaseData(table, filters, orderField, orderDirection, limitCount)
            .then(res => ({ data: res, error: null }))
            .then(onfulfilled);
        }
      };

      // Set promise-like behavior on chain
      (chain as any).then = (onfulfilled: any) => {
        return getFirebaseData(table, filters, orderField, orderDirection, limitCount)
          .then(res => ({ data: res, error: null }))
          .then(onfulfilled);
      };

      return {
        ...chain,
        insert: (input: any) => {
          const payloadArray = Array.isArray(input) ? input : [input];
          const insertChain = {
            select: () => {
              return {
                single: async () => {
                  const res = await saveFirebaseData(table, payloadArray);
                  return { data: res[0], error: null };
                },
                then: (onfulfilled: any) => {
                  return saveFirebaseData(table, payloadArray)
                    .then(res => ({ data: res, error: null }))
                    .then(onfulfilled);
                }
              };
            },
            then: (onfulfilled: any) => {
              return saveFirebaseData(table, payloadArray)
                .then(res => ({ data: res, error: null }))
                .then(onfulfilled);
            }
          };
          return insertChain as any;
        },
        upsert: (input: any) => {
          const payloadArray = Array.isArray(input) ? input : [input];
          const upsertChain = {
            select: () => {
              return {
                single: async () => {
                  const res = await saveFirebaseData(table, payloadArray);
                  return { data: res[0], error: null };
                },
                then: (onfulfilled: any) => {
                  return saveFirebaseData(table, payloadArray)
                    .then(res => ({ data: res, error: null }))
                    .then(onfulfilled);
                }
              };
            },
            then: (onfulfilled: any) => {
              return saveFirebaseData(table, payloadArray)
                .then(res => ({ data: res, error: null }))
                .then(onfulfilled);
            }
          };
          return upsertChain as any;
        },
        update: (updates: any) => {
          const updateChain = {
            eq: (colName: string, val: any) => {
              filters.push({ colName, op: '==', val });
              return updateChain;
            },
            then: (onfulfilled: any) => {
              return updateFirebaseData(table, filters, updates)
                .then(res => ({ data: res, error: null }))
                .then(onfulfilled);
            }
          };
          return updateChain as any;
        },
        delete: () => {
          const deleteChain = {
            eq: (colName: string, val: any) => {
              filters.push({ colName, op: '==', val });
              return deleteChain;
            },
            then: (onfulfilled: any) => {
              return deleteFirebaseData(table, filters)
                .then(res => ({ data: [], error: res.error }))
                .then(onfulfilled);
            }
          };
          return deleteChain as any;
        }
      } as any;
    },

    storage: {
      from: (bucket: string) => {
        return {
          upload: async (filePath: string, file: any, options?: any) => {
            console.log(`[Mock Supabase Storage] Uploading file to bucket "${bucket}" at: "${filePath}"`);
            const url = URL.createObjectURL(file instanceof Blob ? file : new Blob([file]));
            return { data: { path: filePath, url }, error: null };
          },
          getPublicUrl: (filePath: string) => {
            return { data: { publicUrl: `https://pwhmpxqszgixvdwjqusn.supabase.co/storage/v1/object/public/${bucket}/${filePath}` } };
          }
        };
      }
    },

    rpc: async (functionName: string, args?: any) => {
      console.log(`[Mock Supabase RPC] Executing RPC: ${functionName}`, args);
      return { data: { success: true }, error: null };
    },

    channel: (channelName: string) => {
      console.log(`[Mock Supabase Channel] Subscribing to: ${channelName}`);
      const dummyChannel = {
        on: (event: string, filter: any, callback: any) => {
          return dummyChannel;
        },
        subscribe: () => {
          return dummyChannel;
        },
        unsubscribe: async () => {
          return { error: null };
        }
      };
      return dummyChannel;
    },

    removeChannel: async (channel: any) => {
      return { error: null };
    }
  };
};

// Auto-healing state tracker
let useMock = !isSupabaseConfigured;

// Helper to switch to mock mode dynamically and save state
const forceFallbackToMock = (reason: string) => {
  if (!useMock) {
    console.warn(`[Supabase Auto-Healer] Connection issue detected: ${reason}. Dynamically routing database queries to the Offline Mock Sandbox to prevent application crash.`);
    try {
      safeStorage.setItem('imsc_force_mock_supabase', 'true');
    } catch (e) {
      // safeStorage write error
    }
    useMock = true;
    try {
      window.dispatchEvent(new CustomEvent('supabase-failover', { detail: { reason } }));
    } catch (e) {}
  }
};

function makeSelfHealingClient(actual: any, mock: any): any {
  const handler = {
    get(target: any, prop: string, receiver: any): any {
      // If we are currently in mock mode, route directly to mock
      if (useMock) {
        return Reflect.get(mock, prop, mock);
      }

      // Otherwise, try to read the property from the actual client
      let value;
      try {
        value = Reflect.get(actual, prop, actual);
      } catch (err) {
        forceFallbackToMock(err instanceof Error ? err.message : String(err));
        return Reflect.get(mock, prop, mock);
      }

      // If the property is a function, wrap it to catch promise rejections and thrown errors
      if (typeof value === 'function') {
        return function(this: any, ...args: any[]) {
          try {
            const result = value.apply(this === receiver ? actual : this, args);
            
            // If it's a promise, catch rejection
            if (result instanceof Promise) {
              return result.then(
                (resolved) => {
                  if (resolved && resolved.error) {
                    const errMsg = String(resolved.error.message || resolved.error);
                    if (
                      errMsg.includes('fetch') || 
                      errMsg.includes('Network') || 
                      errMsg.includes('failed') || 
                      errMsg.includes('connection') ||
                      errMsg.includes('TypeError')
                    ) {
                      forceFallbackToMock(errMsg);
                      // Fallback and run on the mock client instead
                      const mockFunc = Reflect.get(mock, prop, mock);
                      if (typeof mockFunc === 'function') {
                        return mockFunc.apply(mock, args);
                      }
                    }
                  }
                  return resolved;
                },
                (rejectedErr) => {
                  const errMsg = String(rejectedErr?.message || rejectedErr);
                  forceFallbackToMock(errMsg);
                  const mockFunc = Reflect.get(mock, prop, mock);
                  if (typeof mockFunc === 'function') {
                    return mockFunc.apply(mock, args);
                  }
                  throw rejectedErr;
                }
              );
            }
            
            // If it returns a chainable object, wrap that chain as well
            if (result && typeof result === 'object') {
              const mockChain = Reflect.get(mock, prop, mock)?.apply(mock, args) || result;
              return makeSelfHealingClient(result, mockChain);
            }

            return result;
          } catch (syncErr) {
            const errMsg = String(syncErr instanceof Error ? syncErr.message : syncErr);
            forceFallbackToMock(errMsg);
            const mockFunc = Reflect.get(mock, prop, mock);
            if (typeof mockFunc === 'function') {
              return mockFunc.apply(mock, args);
            }
            throw syncErr;
          }
        };
      }

      // If the property is an object (like auth, storage), wrap recursively
      if (value && typeof value === 'object') {
        return makeSelfHealingClient(value, Reflect.get(mock, prop, mock) || value);
      }

      return value;
    }
  };

  return new Proxy(actual || mock, handler);
}

const rawActualClient = isSupabaseConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
const mockClient = generateMockSupabaseClient() as any;

// Export actual or gracefully mocked client with self-healing capabilities
export const supabase = makeSelfHealingClient(rawActualClient, mockClient);
