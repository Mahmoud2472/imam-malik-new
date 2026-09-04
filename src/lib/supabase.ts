import { createClient } from '@supabase/supabase-js';
import { safeStorage } from './safeStorage';
import { DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from './supabase-defaults';
import { addDebugLog } from './debug';

// Run a one-time healing check on startup to release users whose browsers got stuck in automatic mock mode
try {
  if (safeStorage.getItem('imsc_force_mock_supabase_healed') !== 'true') {
    // If the mock flag is active but NOT manually overridden, clear it to attempt a fresh connection
    if (safeStorage.getItem('imsc_force_mock_supabase') === 'true' && safeStorage.getItem('imsc_manual_mock_supabase') !== 'true') {
      safeStorage.removeItem('imsc_force_mock_supabase');
    }
    safeStorage.setItem('imsc_force_mock_supabase_healed', 'true');
  }
} catch (e) {
  console.warn("Could not perform supabase client startup healing:", e);
}

// Read configuration from browser local storage OR environment OR code-level defaults
let rawSupabaseUrl = 
  safeStorage.getItem('imsc_custom_supabase_url') || 
  import.meta.env.VITE_SUPABASE_URL || 
  DEFAULT_SUPABASE_URL || 
  '';

rawSupabaseUrl = rawSupabaseUrl.trim();

if (rawSupabaseUrl && !rawSupabaseUrl.startsWith('http://') && !rawSupabaseUrl.startsWith('https://')) {
  rawSupabaseUrl = 'https://' + rawSupabaseUrl;
}

while (rawSupabaseUrl.endsWith('/')) {
  rawSupabaseUrl = rawSupabaseUrl.slice(0, -1);
}

if (rawSupabaseUrl.endsWith('/rest/v1')) {
  rawSupabaseUrl = rawSupabaseUrl.slice(0, -8);
}

const supabaseUrl = rawSupabaseUrl;
const supabaseAnonKey = (safeStorage.getItem('imsc_custom_supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY || '').trim();

const environmentHasCredentials = !!(
  supabaseUrl && 
  supabaseAnonKey && 
  (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://')) && 
  supabaseUrl !== 'https://your-project.supabase.co' && 
  !supabaseUrl.includes('placeholder')
);

export const isSupabaseConfigured = environmentHasCredentials && safeStorage.getItem('imsc_force_mock_supabase') !== 'true';

// Log initialization details
addDebugLog('Database', `Initializing. Configured: ${isSupabaseConfigured} (Mock Mode: ${!isSupabaseConfigured})`, isSupabaseConfigured ? 'success' : 'warn');

// Initialize local schema if using mock mode
const initializeLocalStorageSchema = () => {
  const profileKey = 'imsc_supabase_mock_profiles';
  let currentProfiles = [];
  try {
    currentProfiles = JSON.parse(safeStorage.getItem(profileKey) || '[]');
  } catch (e) {
    currentProfiles = [];
  }
  
  // Wipe any sample student or teacher profiles from local storage
  if (Array.isArray(currentProfiles)) {
    currentProfiles = currentProfiles.filter((p: any) => 
      p && p.role === 'admin' && p.email !== 'student@school.com' && p.email !== 'teacher@school.com'
    );
  } else {
    currentProfiles = [];
  }

  if (currentProfiles.length === 0) {
    const defaultProfiles = [
      { id: 'admin-system-id', email: 'admin@school.com', role: 'admin', displayName: 'School Administrator' }
    ];
    safeStorage.setItem(profileKey, JSON.stringify(defaultProfiles));
  } else {
    safeStorage.setItem(profileKey, JSON.stringify(currentProfiles));
  }
};

if (!isSupabaseConfigured) {
  initializeLocalStorageSchema();
}

const getMockData = (table: string): any[] => {
  const data = safeStorage.getItem(`imsc_supabase_mock_${table}`);
  if (!data) return [];
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
};

const saveMockData = (table: string, data: any[]) => {
  safeStorage.setItem(`imsc_supabase_mock_${table}`, JSON.stringify(data));
  try {
    window.dispatchEvent(new CustomEvent('supabase-mock-change', { detail: { table } }));
  } catch (e) {}
};

// --- CLIENT-SIDE MOCK CLIENT GENERATOR ---
const generateMockSupabaseClient = () => {
  const listeners: Set<any> = new Set();

  const getLocalStorageData = async (
    table: string, 
    filters: any[], 
    orderField: string | null, 
    orderDirection: 'asc' | 'desc', 
    limitCount: number | null
  ) => {
    let rows = getMockData(table);
    
    if (table === 'fees' && rows.length === 0) {
      rows = [
        { id: 'fee-1', name: '1st Term School Fees (Tuition)', amount: 12000, description: 'Termly tuition fee for 1st, 2nd, and 3rd term' },
        { id: 'fee-2', name: 'College Development Levy (3-Year)', amount: 3000, description: 'Payable ONCE throughout the entire 3-year study period' },
        { id: 'fee-3', name: 'Admission & Prospectus Fee', amount: 1000, description: 'Mandatory registration fee for new applicants' }
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
  };

  const saveLocalStorageData = async (table: string, payloadArray: any[]) => {
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
  };

  const updateLocalStorageData = async (table: string, filters: any[], updates: any) => {
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
  };

  const deleteLocalStorageData = async (table: string, filters: any[]) => {
    let rows = getMockData(table);
    rows = rows.filter(r => {
      let matches = true;
      filters.forEach(f => {
        if (f.op === '==') {
          if (r[f.colName] !== f.val) matches = false;
        } else if (f.op === '!=') {
          if (r[f.colName] === f.val) matches = false;
        }
      });
      return !matches;
    });
    saveMockData(table, rows);
    return { error: null };
  };

  return {
    auth: {
      signUp: async ({ email, password, options }: any) => {
        console.log('[Mock Supabase Auth] Registering:', email);
        const userUuid = 'mock-user-' + Math.floor(Math.random() * 1000000);
        const meta = options?.data || {};
        let role = meta.role || 'applicant';
        const emailLower = email.toLowerCase();
        if (emailLower.includes('admin')) role = 'admin';
        else if (emailLower.includes('teacher')) role = 'teacher';
        else if (emailLower.includes('student')) role = 'student';

        const profilePayload = {
          id: userUuid,
          email,
          role,
          displayName: meta.displayName || email.split('@')[0],
          createdAt: new Date().toISOString()
        };

        const profiles = getMockData('profiles');
        profiles.push(profilePayload);
        saveMockData('profiles', profiles);

        const mockUser = { id: userUuid, email, user_metadata: meta };
        const session = { user: mockUser, access_token: 'mock-token' };

        safeStorage.setItem('imsc_active_user_id', userUuid);
        return { data: { user: mockUser, session }, error: null };
      },
      signInWithPassword: async ({ email, password }: any) => {
        console.log('[Mock Supabase Auth] Signing in:', email);
        const emailLower = (email || '').toLowerCase().trim();
        if (emailLower === 'admin@school.com') {
          if (password !== 'admin123') {
            return { data: { user: null, session: null }, error: { message: 'Invalid administrator password. Password must be admin123.' } };
          }
        }
        const profiles = getMockData('profiles');
        let profile = profiles.find(p => p.email?.toLowerCase().trim() === emailLower);

        if (!profile) {
          let role = 'applicant';
          if (emailLower === 'admin@school.com' && password === 'admin123') role = 'admin';
          else if (emailLower.includes('teacher')) role = 'teacher';
          else if (emailLower.includes('student')) role = 'student';

          profile = {
            id: 'mock-user-' + Math.floor(Math.random() * 1000000),
            email,
            role,
            displayName: email.split('@')[0],
            createdAt: new Date().toISOString()
          };
          profiles.push(profile);
          saveMockData('profiles', profiles);
        }

        const mockUser = {
          id: profile.id,
          email,
          user_metadata: { displayName: profile.displayName }
        };

        const session = { user: mockUser, access_token: 'mock-token' };
        safeStorage.setItem('imsc_active_user_id', profile.id);
        return { data: { user: mockUser, session }, error: null };
      },
      signOut: async () => {
        safeStorage.removeItem('imsc_active_user_id');
        return { error: null };
      },
      getSession: async () => {
        const activeUserId = safeStorage.getItem('imsc_active_user_id');
        if (!activeUserId) return { data: { session: null }, error: null };

        const profiles = getMockData('profiles');
        const profile = profiles.find(p => p.id === activeUserId);
        if (!profile) return { data: { session: null }, error: null };

        return {
          data: {
            session: {
              user: { id: profile.id, email: profile.email, user_metadata: { displayName: profile.displayName } },
              access_token: 'mock-token'
            }
          },
          error: null
        };
      },
      onAuthStateChange: (callback: any) => {
        listeners.add(callback);
        const activeUserId = safeStorage.getItem('imsc_active_user_id');
        if (activeUserId) {
          const profiles = getMockData('profiles');
          const profile = profiles.find(p => p.id === activeUserId);
          if (profile) {
            callback('SIGNED_IN', {
              user: { id: profile.id, email: profile.email, user_metadata: { displayName: profile.displayName } },
              access_token: 'mock-token'
            });
          } else {
            callback('SIGNED_OUT', null);
          }
        } else {
          callback('SIGNED_OUT', null);
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
          const res = await getLocalStorageData(table, filters, orderField, orderDirection, limitCount);
          return { data: res[0] || null, error: res.length ? null : { message: 'Row not found' } };
        },
        then: (onfulfilled?: any, onrejected?: any) => {
          return getLocalStorageData(table, filters, orderField, orderDirection, limitCount)
            .then(res => ({ data: res, error: null }))
            .then(onfulfilled, onrejected);
        },
        catch: (onrejected?: any) => {
          return getLocalStorageData(table, filters, orderField, orderDirection, limitCount)
            .then(res => ({ data: res, error: null }))
            .catch(onrejected);
        },
        finally: (onfinally?: any) => {
          return getLocalStorageData(table, filters, orderField, orderDirection, limitCount)
            .then(res => ({ data: res, error: null }))
            .finally(onfinally);
        }
      };

      (chain as any).then = chain.then;
      (chain as any).catch = chain.catch;
      (chain as any).finally = chain.finally;

      return {
        ...chain,
        insert: (input: any) => {
          const payloadArray = Array.isArray(input) ? input : [input];
          const insertChain = {
            select: () => {
              return {
                single: async () => {
                  const res = await saveLocalStorageData(table, payloadArray);
                  return { data: res[0], error: null };
                },
                then: (onfulfilled?: any, onrejected?: any) => {
                  return saveLocalStorageData(table, payloadArray)
                    .then(res => ({ data: res, error: null }))
                    .then(onfulfilled, onrejected);
                },
                catch: (onrejected?: any) => {
                  return saveLocalStorageData(table, payloadArray)
                    .then(res => ({ data: res, error: null }))
                    .catch(onrejected);
                },
                finally: (onfinally?: any) => {
                  return saveLocalStorageData(table, payloadArray)
                    .then(res => ({ data: res, error: null }))
                    .finally(onfinally);
                }
              };
            },
            then: (onfulfilled?: any, onrejected?: any) => {
              return saveLocalStorageData(table, payloadArray)
                .then(res => ({ data: res, error: null }))
                .then(onfulfilled, onrejected);
            },
            catch: (onrejected?: any) => {
              return saveLocalStorageData(table, payloadArray)
                .then(res => ({ data: res, error: null }))
                .catch(onrejected);
            },
            finally: (onfinally?: any) => {
              return saveLocalStorageData(table, payloadArray)
                .then(res => ({ data: res, error: null }))
                .finally(onfinally);
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
                  const res = await saveLocalStorageData(table, payloadArray);
                  return { data: res[0], error: null };
                },
                then: (onfulfilled?: any, onrejected?: any) => {
                  return saveLocalStorageData(table, payloadArray)
                    .then(res => ({ data: res, error: null }))
                    .then(onfulfilled, onrejected);
                },
                catch: (onrejected?: any) => {
                  return saveLocalStorageData(table, payloadArray)
                    .then(res => ({ data: res, error: null }))
                    .catch(onrejected);
                },
                finally: (onfinally?: any) => {
                  return saveLocalStorageData(table, payloadArray)
                    .then(res => ({ data: res, error: null }))
                    .finally(onfinally);
                }
              };
            },
            then: (onfulfilled?: any, onrejected?: any) => {
              return saveLocalStorageData(table, payloadArray)
                .then(res => ({ data: res, error: null }))
                .then(onfulfilled, onrejected);
            },
            catch: (onrejected?: any) => {
              return saveLocalStorageData(table, payloadArray)
                .then(res => ({ data: res, error: null }))
                .catch(onrejected);
            },
            finally: (onfinally?: any) => {
              return saveLocalStorageData(table, payloadArray)
                .then(res => ({ data: res, error: null }))
                .finally(onfinally);
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
            neq: (colName: string, val: any) => {
              filters.push({ colName, op: '!=', val });
              return updateChain;
            },
            then: (onfulfilled?: any, onrejected?: any) => {
              return updateLocalStorageData(table, filters, updates)
                .then(res => ({ data: res, error: null }))
                .then(onfulfilled, onrejected);
            },
            catch: (onrejected?: any) => {
              return updateLocalStorageData(table, filters, updates)
                .then(res => ({ data: res, error: null }))
                .catch(onrejected);
            },
            finally: (onfinally?: any) => {
              return updateLocalStorageData(table, filters, updates)
                .then(res => ({ data: res, error: null }))
                .finally(onfinally);
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
            neq: (colName: string, val: any) => {
              filters.push({ colName, op: '!=', val });
              return deleteChain;
            },
            then: (onfulfilled?: any, onrejected?: any) => {
              return deleteLocalStorageData(table, filters)
                .then(res => ({ data: [], error: res.error }))
                .then(onfulfilled, onrejected);
            },
            catch: (onrejected?: any) => {
              return deleteLocalStorageData(table, filters)
                .then(res => ({ data: [], error: res.error }))
                .catch(onrejected);
            },
            finally: (onfinally?: any) => {
              return deleteLocalStorageData(table, filters)
                .then(res => ({ data: [], error: res.error }))
                .finally(onfinally);
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
      let active = true;
      let channelListeners: Array<{ event: string; filter: any; callback: any }> = [];

      const handleMockChange = (e: any) => {
        if (!active) return;
        channelListeners.forEach(l => {
          if (l.event === 'postgres_changes') {
            const filterTable = l.filter?.table;
            if (e.detail?.table === filterTable) {
              const rows = getMockData(filterTable);
              const mockPayload = {
                new: rows[rows.length - 1] || {},
                errors: null
              };
              l.callback(mockPayload);
            }
          }
        });
      };

      try {
        window.addEventListener('supabase-mock-change', handleMockChange);
      } catch (err) {}

      const dummyChannel = {
        on: (event: string, filter: any, callback: any) => {
          channelListeners.push({ event, filter, callback });
          return dummyChannel;
        },
        subscribe: () => {
          return dummyChannel;
        },
        unsubscribe: async () => {
          active = false;
          try {
            window.removeEventListener('supabase-mock-change', handleMockChange);
          } catch (err) {}
          return { error: null };
        }
      };
      return dummyChannel;
    },

    removeChannel: async (channel: any) => {
      if (channel && typeof channel.unsubscribe === 'function') {
        await channel.unsubscribe();
      }
      return { error: null };
    }
  };
};

let useMock = !isSupabaseConfigured;

const forceFallbackToMock = (reason: string) => {
  addDebugLog('Database Failover', `Connection issue detected: "${reason}". Automatically routing database queries to Offline Mock Sandbox.`, 'error');
  if (!useMock) {
    console.warn(`[Supabase Auto-Healer] Connection issue detected: ${reason}. Dynamically routing database queries to the Offline Mock Sandbox to prevent application crash.`);
    // Note: We intentionally DO NOT persist the 'imsc_force_mock_supabase' key to localStorage during automated session failover.
    // This allows page-refreshing or reconnecting to try the live database again naturally, instead of locking users into offline mode.
    useMock = true;
    try {
      window.dispatchEvent(new CustomEvent('supabase-failover', { detail: { reason } }));
    } catch (e) {}
  }
};

function makeSelfHealingClient(actual: any, mock: any): any {
  const handler = {
    get(target: any, prop: string, receiver: any): any {
      if (useMock) {
        return Reflect.get(mock, prop, mock);
      }

      // Intercept 'then' property access to catch errors when the query is executed
      if (prop === 'then') {
        return function(onfulfilled: any, onrejected: any) {
          try {
            const realThen = actual ? Reflect.get(actual, 'then', actual) : undefined;
            if (typeof realThen !== 'function') {
              if (mock && typeof mock.then === 'function') {
                return mock.then(onfulfilled, onrejected);
              }
              const val = onfulfilled ? onfulfilled(actual || mock) : (actual || mock);
              return Promise.resolve(val);
            }
            
            const promise = Promise.resolve(realThen.call(actual));
            return promise.then(
              (resolved: any) => {
                if (resolved && resolved.error) {
                  const errMsg = String(resolved.error.message || resolved.error);
                  forceFallbackToMock(errMsg);
                  if (mock && typeof mock.then === 'function') {
                    return mock.then(onfulfilled, onrejected);
                  }
                }
                return onfulfilled ? onfulfilled(resolved) : resolved;
              },
              (rejectedErr: any) => {
                const errMsg = String(rejectedErr?.message || rejectedErr);
                forceFallbackToMock(errMsg);
                if (mock && typeof mock.then === 'function') {
                  return mock.then(onfulfilled, onrejected);
                }
                if (onrejected) return onrejected(rejectedErr);
                throw rejectedErr;
              }
            );
          } catch (err) {
            const errMsg = String(err instanceof Error ? err.message : err);
            forceFallbackToMock(errMsg);
            if (mock && typeof mock.then === 'function') {
              return mock.then(onfulfilled, onrejected);
            }
            if (onrejected) return onrejected(err);
            throw err;
          }
        };
      }

      // Intercept 'catch' property access
      if (prop === 'catch') {
        return function(onrejected: any) {
          const thenFn = receiver.then;
          if (typeof thenFn === 'function') {
            return thenFn.call(receiver, undefined, onrejected);
          }
          if (mock && typeof mock.catch === 'function') {
            return mock.catch(onrejected);
          }
          return Promise.resolve(actual || mock).catch(onrejected);
        };
      }

      // Intercept 'finally' property access
      if (prop === 'finally') {
        return function(onfinally: any) {
          const thenFn = receiver.then;
          if (typeof thenFn === 'function') {
            return Promise.resolve(receiver).finally(onfinally);
          }
          if (mock && typeof mock.finally === 'function') {
            return mock.finally(onfinally);
          }
          return Promise.resolve(actual || mock).finally(onfinally);
        };
      }

      let value;
      try {
        value = actual ? Reflect.get(actual, prop, actual) : undefined;
      } catch (err) {
        forceFallbackToMock(err instanceof Error ? err.message : String(err));
        return Reflect.get(mock, prop, mock);
      }

      if (value === undefined) {
        return Reflect.get(mock, prop, mock);
      }

      if (typeof value === 'function') {
        return function(this: any, ...args: any[]) {
          try {
            const result = value.apply(this === receiver ? actual : this, args);
            
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

export const supabase = makeSelfHealingClient(rawActualClient, mockClient);
