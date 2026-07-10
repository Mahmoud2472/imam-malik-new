import { supabase } from './supabase';

// Helper to clean payloads for Supabase (remove undefined, replace serverTimestamp)
function cleanPayload(data: any): any {
  if (!data) return data;
  if (typeof data !== 'object') return data;

  const result = { ...data };
  for (const key of Object.keys(result)) {
    const val = result[key];
    if (val && typeof val === 'object' && val._methodName === 'serverTimestamp') {
      result[key] = new Date().toISOString();
    } else if (val === undefined) {
      delete result[key];
    } else if (Array.isArray(val)) {
      result[key] = val.map(item => cleanPayload(item));
    } else if (val !== null && typeof val === 'object') {
      result[key] = cleanPayload(val);
    }
  }
  return result;
}

// ------------------- firebase/app -------------------
export function initializeApp() {
  console.log('[Supabase Shim] Firebase App Initialized');
  return { name: '[Supabase Shim App]' };
}

// ------------------- firebase/auth -------------------
export type User = any;

class MockGoogleAuthProvider {
  static PROVIDER_ID = 'google.com';
  static credentialFromResult(result: any) {
    return { accessToken: 'mock-google-token' };
  }
  addScope(scope: string) {
    return this;
  }
}
export { MockGoogleAuthProvider as GoogleAuthProvider };

export function getAuth(_app?: any) {
  return {
    get currentUser() {
      // Synchronously retrieve some basic user info from active local storage if needed
      const activeUserId = localStorage.getItem('imsc_active_user_id');
      if (!activeUserId) return null;
      return {
        uid: activeUserId,
        id: activeUserId,
        email: localStorage.getItem('imsc_active_user_email') || 'user@school.com',
        displayName: localStorage.getItem('imsc_active_user_display_name') || 'User'
      };
    },
    onAuthStateChanged: (callback: any) => {
      // Trigger callback with current user initially
      const activeUserId = localStorage.getItem('imsc_active_user_id');
      if (activeUserId) {
        callback({
          uid: activeUserId,
          id: activeUserId,
          email: localStorage.getItem('imsc_active_user_email') || 'user@school.com',
          displayName: localStorage.getItem('imsc_active_user_display_name') || 'User'
        });
      } else {
        callback(null);
      }

      // Listen to Supabase auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          localStorage.setItem('imsc_active_user_id', session.user.id);
          localStorage.setItem('imsc_active_user_email', session.user.email || '');
          localStorage.setItem('imsc_active_user_display_name', session.user.user_metadata?.displayName || '');
          callback({
            uid: session.user.id,
            id: session.user.id,
            email: session.user.email,
            displayName: session.user.user_metadata?.displayName || session.user.email?.split('@')[0]
          });
        } else {
          localStorage.removeItem('imsc_active_user_id');
          localStorage.removeItem('imsc_active_user_email');
          localStorage.removeItem('imsc_active_user_display_name');
          callback(null);
        }
      });

      return () => {
        if (subscription && typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
      };
    }
  };
}

export async function signInWithPopup(authInstance: any, provider: any) {
  console.log('[Supabase Shim] signInWithPopup using provider:', provider);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });
  if (error) throw error;
  return { user: authInstance.currentUser };
}

export function onAuthStateChanged(authInstance: any, callback: any) {
  return authInstance.onAuthStateChanged(callback);
}

export async function signOut(_authInstance?: any) {
  console.log('[Supabase Shim] Signing out...');
  const { error } = await supabase.auth.signOut();
  localStorage.removeItem('imsc_active_user_id');
  localStorage.removeItem('imsc_active_user_email');
  localStorage.removeItem('imsc_active_user_display_name');
  if (error) throw error;
}

// ------------------- firebase/firestore -------------------
export function getFirestore(_app?: any) {
  return { type: 'supabase-firestore-shim' };
}

export function collection(db: any, pathName: string) {
  return { type: 'collection', path: pathName };
}

export function doc(dbOrCollection: any, ...pathSegments: string[]) {
  let path = '';
  if (typeof dbOrCollection === 'string') {
    path = dbOrCollection + '/' + pathSegments.join('/');
  } else if (dbOrCollection.type === 'collection') {
    path = dbOrCollection.path + '/' + pathSegments.join('/');
  } else {
    // db is passed
    path = pathSegments.join('/');
  }
  const id = path.split('/').pop() || 'doc-' + Math.floor(Math.random() * 10000000);
  return { type: 'document-reference', path, id };
}

export function serverTimestamp() {
  return { _methodName: 'serverTimestamp' };
}

export function query(colRef: any, ...queries: any[]) {
  return { type: 'query', collection: colRef, constraints: queries };
}

export function where(field: string, op: string, value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: string = 'asc') {
  return { type: 'orderBy', field, direction };
}

export function limit(count: number) {
  return { type: 'limit', count };
}

// Internal translator from Firestore query representation to Supabase JS Client call
async function executeSupabaseQuery(q: any) {
  const isQuery = q?.type === 'query';
  const collectionRef = isQuery ? q.collection : q;
  const table = collectionRef.path;

  let queryBuilder = supabase.from(table).select('*');

  const constraints = isQuery ? q.constraints : [];
  for (const c of constraints) {
    if (c.type === 'where') {
      const { field, op, value } = c;
      if (op === '==') {
        queryBuilder = queryBuilder.eq(field, value);
      } else if (op === '!=') {
        queryBuilder = queryBuilder.neq(field, value);
      } else if (op === '>') {
        queryBuilder = queryBuilder.gt(field, value);
      } else if (op === '>=') {
        queryBuilder = queryBuilder.gte(field, value);
      } else if (op === '<') {
        queryBuilder = queryBuilder.lt(field, value);
      } else if (op === '<=') {
        queryBuilder = queryBuilder.lte(field, value);
      } else if (op === 'in') {
        queryBuilder = queryBuilder.in(field, value);
      } else if (op === 'array-contains') {
        queryBuilder = queryBuilder.contains(field, [value]);
      }
    } else if (c.type === 'orderBy') {
      const { field, direction } = c;
      queryBuilder = queryBuilder.order(field, { ascending: direction !== 'desc' });
    } else if (c.type === 'limit') {
      queryBuilder = queryBuilder.limit(c.count);
    }
  }

  const { data, error } = await queryBuilder;
  if (error) {
    console.error(`[Supabase Shim] Error executing query on table "${table}":`, error);
    throw error;
  }
  return data || [];
}

export async function getDocs(q: any) {
  const data = await executeSupabaseQuery(q);
  const docs = data.map((item: any) => ({
    id: item.id,
    data: () => item,
    exists: () => true
  }));
  return {
    empty: docs.length === 0,
    size: docs.length,
    docs
  };
}

export async function getDoc(docRef: any) {
  const segments = docRef.path.split('/');
  const table = segments[0];
  const docId = segments[1];

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('id', docId)
    .single();

  if (error || !data) {
    return {
      exists: () => false,
      id: docId,
      data: () => null
    };
  }

  return {
    exists: () => true,
    id: docId,
    data: () => data
  };
}

export const getDocFromServer = getDoc;

export async function setDoc(docRef: any, data: any, options?: any) {
  const segments = docRef.path.split('/');
  const table = segments[0];
  const docId = segments[1];
  const cleanData = cleanPayload(data);

  const { error } = await supabase.from(table).upsert({ id: docId, ...cleanData });
  if (error) throw error;
}

export async function addDoc(collectionRef: any, data: any) {
  const table = collectionRef.path;
  const id = 'rec-' + Math.floor(Math.random() * 10000000);
  const cleanData = cleanPayload(data);

  const { error } = await supabase.from(table).insert({ id, ...cleanData });
  if (error) throw error;

  return { id };
}

export async function updateDoc(docRef: any, data: any) {
  const segments = docRef.path.split('/');
  const table = segments[0];
  const docId = segments[1];
  const cleanData = cleanPayload(data);

  const { error } = await supabase.from(table).update(cleanData).eq('id', docId);
  if (error) throw error;
}

export async function deleteDoc(docRef: any) {
  const segments = docRef.path.split('/');
  const table = segments[0];
  const docId = segments[1];

  const { error } = await supabase.from(table).delete().eq('id', docId);
  if (error) throw error;
}

export function onSnapshot(q: any, onNext: (snapshot: any) => void, onError?: (error: any) => void) {
  const isDoc = q?.type === 'document-reference';
  const isQuery = q?.type === 'query';
  const collectionRef = isDoc ? null : (isQuery ? q.collection : q);
  const table = isDoc ? q.path.split('/')[0] : collectionRef.path;
  const docId = isDoc ? q.path.split('/')[1] : null;

  let active = true;
  let channel: any = null;

  const runQuery = async () => {
    if (!active) return;
    try {
      if (isDoc) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .eq('id', docId)
          .single();
        if (!active) return;

        onNext({
          exists: () => !!data,
          id: docId,
          data: () => data || null
        });
      } else {
        const data = await executeSupabaseQuery(q);
        if (!active) return;
        onNext({
          empty: data.length === 0,
          docs: data.map((item: any) => ({
            id: item.id,
            data: () => item,
            exists: () => true
          }))
        });
      }
    } catch (err) {
      if (onError) onError(err);
    }
  };

  runQuery();

  const filter = isDoc ? `id=eq.${docId}` : undefined;
  channel = supabase
    .channel(`on-snapshot-${table}-${docId || 'all'}-${Math.floor(Math.random() * 1000000)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
      runQuery();
    })
    .subscribe();

  const handleMockChange = (e: any) => {
    if (e.detail?.table === table) {
      runQuery();
    }
  };
  try {
    window.addEventListener('supabase-mock-change', handleMockChange);
  } catch (err) {}

  return () => {
    active = false;
    try {
      window.removeEventListener('supabase-mock-change', handleMockChange);
    } catch (err) {}
    if (channel) {
      supabase.removeChannel(channel);
    }
  };
}

export function writeBatch(db: any) {
  const operations: (() => Promise<void>)[] = [];
  return {
    set: (docRef: any, data: any, options?: any) => {
      operations.push(() => setDoc(docRef, data, options));
    },
    update: (docRef: any, data: any) => {
      operations.push(() => updateDoc(docRef, data));
    },
    delete: (docRef: any) => {
      operations.push(() => deleteDoc(docRef));
    },
    commit: async () => {
      await Promise.all(operations.map(op => op()));
    }
  };
}

// ------------------- firebase/storage -------------------
export function getStorage(_app?: any) {
  return { type: 'supabase-storage-shim' };
}

export function ref(storageInstance: any, path: string) {
  return { type: 'storage-ref', path };
}

export async function uploadBytes(storageRef: any, file: any) {
  const pathParts = storageRef.path.split('/');
  const bucket = pathParts[0] || 'files';
  const filePath = pathParts.slice(1).join('/') || pathParts[0];

  const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
    upsert: true
  });

  if (error) {
    // Fallback uploading to 'files' bucket
    const { error: fallbackError } = await supabase.storage.from('files').upload(storageRef.path, file, {
      upsert: true
    });
    if (fallbackError) throw fallbackError;
  }

  return { ref: storageRef };
}

export async function getDownloadURL(storageRef: any) {
  const pathParts = storageRef.path.split('/');
  const bucket = pathParts[0] || 'files';
  const filePath = pathParts.slice(1).join('/') || pathParts[0];

  const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
  return data.publicUrl;
}
