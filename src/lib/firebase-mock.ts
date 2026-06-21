type Callback = (snapshot: any) => void;

// Helper to interact with Mock database
const getMockData = (table: string): any[] => {
  const data = localStorage.getItem(`imsc_supabase_mock_${table}`);
  return data ? JSON.parse(data) : [];
};

const saveMockData = (table: string, data: any[]) => {
  localStorage.setItem(`imsc_supabase_mock_${table}`, JSON.stringify(data));
};

// Ensure default settings are initialized
const ensureDefaultSettings = () => {
  const configKey = 'imsc_supabase_mock_config';
  const configs = getMockData('config');
  if (!configs.some(c => c.id === 'admission_settings')) {
    configs.push({
      id: 'admission_settings',
      netlifyFormUrl: localStorage.getItem('imsc_netlify_form_url') || 'https://formbold.com/s/9mBJY',
      useExternalForm: localStorage.getItem('imsc_use_external_form') === 'true',
      updatedAt: new Date().toISOString()
    });
    saveMockData('config', configs);
  }
};
try {
  ensureDefaultSettings();
} catch (e) {
  console.warn("Could not ensure defaults", e);
}

// Mock firebase app
export function initializeApp() {
  console.log('[Mock Firebase App] Initialized');
  return { name: '[Mock App]' };
}

// Mock firebase auth
const subscribers: any[] = [];
export function getAuth() {
  return {
    currentUser: null,
    onAuthStateChanged: (callback: any) => {
      subscribers.push(callback);
      // Retrieve active user from mock session
      const getSessionUser = () => {
        const activeUserId = localStorage.getItem('imsc_active_user_id');
        if (!activeUserId) return null;
        const profiles = getMockData('profiles');
        const userProfile = profiles.find(p => p.id === activeUserId);
        if (!userProfile) return null;
        return {
          uid: userProfile.id,
          id: userProfile.id,
          email: userProfile.email,
          displayName: userProfile.displayName
        };
      };
      
      // Trigger callback with active user
      const user = getSessionUser();
      callback(user);
      return () => {
        const idx = subscribers.indexOf(callback);
        if (idx !== -1) subscribers.splice(idx, 1);
      };
    }
  };
}

export function signOut() {
  console.log('[Mock Firebase Auth] Signed out');
  localStorage.removeItem('imsc_active_user_id');
  subscribers.forEach(cb => cb(null));
  return Promise.resolve();
}

export class GoogleAuthProvider {
  static PROVIDER_ID = 'google.com';
}

export function signInWithPopup(auth: any, provider: any) {
  console.log('[Mock Firebase Auth] signInWithPopup using provider:', provider);
  return Promise.resolve({
    user: {
      uid: 'mock-google-user-id',
      email: 'admin@school.com',
      displayName: 'Google Admin'
    }
  });
}

export function onAuthStateChanged(auth: any, callback: any) {
  return auth.onAuthStateChanged(callback);
}

// Mock firestore
export function getFirestore() {
  return { type: 'mock-firestore' };
}

export function collection(db: any, pathName: string) {
  return { type: 'collection', path: pathName };
}

export function doc(db: any, pathOrCollection: any, ...pathSegments: string[]) {
  let path = '';
  if (typeof pathOrCollection === 'string') {
    path = pathOrCollection + '/' + pathSegments.join('/');
  } else if (pathOrCollection.type === 'collection') {
    path = pathOrCollection.path + '/' + pathSegments.join('/');
  }
  return { type: 'document-reference', path };
}

export function serverTimestamp() {
  return new Date().toISOString();
}

export function query(colRef: any, ...queries: any[]) {
  return { type: 'query', collection: colRef, queries };
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

// Internal query evaluator
const evaluateQuery = (q: any) => {
  const collectionRef = q.type === 'query' ? q.collection : q;
  const table = collectionRef.path;
  let data = getMockData(table);

  // Apply configs or defaults if empty
  if (table === 'fees' && data.length === 0) {
    data = [
      { id: 'fee-1', name: 'Admission Application Fee', amount: 5000 }
    ];
    saveMockData('fees', data);
  }

  if (q.type === 'query') {
    q.queries.forEach((filter: any) => {
      if (filter.type === 'where') {
        const { field, op, value } = filter;
        if (op === '==') {
          data = data.filter(item => item[field] === value);
        } else if (op === '!=') {
          data = data.filter(item => item[field] !== value);
        }
      } else if (filter.type === 'orderBy') {
        const { field, direction } = filter;
        data = [...data].sort((a, b) => {
          if (a[field] < b[field]) return direction === 'asc' ? -1 : 1;
          if (a[field] > b[field]) return direction === 'asc' ? 1 : -1;
          return 0;
        });
      } else if (filter.type === 'limit') {
        data = data.slice(0, filter.count);
      }
    });
  }

  return data;
};

export async function getDocs(q: any) {
  const rows = evaluateQuery(q);
  return {
    empty: rows.length === 0,
    docs: rows.map(r => ({
      id: r.id || 'doc-' + Math.floor(Math.random() * 1000000),
      data: () => r
    }))
  };
}

export async function getDoc(docRef: any) {
  const segments = docRef.path.split('/');
  const table = segments[0];
  const docId = segments[1];
  
  const rows = getMockData(table);
  const row = rows.find(r => r.id === docId);

  return {
    exists: () => !!row,
    id: docId,
    data: () => row
  };
}

export async function getDocFromServer(docRef: any) {
  return getDoc(docRef);
}

export async function setDoc(docRef: any, data: any, options?: any) {
  const segments = docRef.path.split('/');
  const table = segments[0];
  const docId = segments[1];
  
  const rows = getMockData(table);
  const idx = rows.findIndex(r => r.id === docId);

  const payload = { id: docId, ...data };
  if (idx !== -1) {
    if (options?.merge) {
      rows[idx] = { ...rows[idx], ...data };
    } else {
      rows[idx] = payload;
    }
  } else {
    rows.push(payload);
  }

  saveMockData(table, rows);
  console.log(`[Mock Firebase Firestore] setDoc on ${table}/${docId}`, data);
  return Promise.resolve();
}

export function writeBatch(db: any) {
  const operations: (() => void)[] = [];
  return {
    set: (docRef: any, data: any, options?: any) => {
      operations.push(() => { setDoc(docRef, data, options); });
    },
    update: (docRef: any, data: any) => {
      operations.push(() => { updateDoc(docRef, data); });
    },
    delete: (docRef: any) => {
      operations.push(() => { deleteDoc(docRef); });
    },
    commit: async () => {
      operations.forEach(op => op());
      return Promise.resolve();
    }
  };
}

export async function addDoc(colRef: any, data: any) {
  const table = colRef.path;
  const rows = getMockData(table);
  const docId = 'doc-' + Math.floor(Math.random() * 10000000);
  const payload = { id: docId, ...data };
  
  rows.push(payload);
  saveMockData(table, rows);
  console.log(`[Mock Firebase Firestore] addDoc on ${table}`, data);
  return { id: docId };
}

export async function updateDoc(docRef: any, data: any) {
  const segments = docRef.path.split('/');
  const table = segments[0];
  const docId = segments[1];
  
  const rows = getMockData(table);
  const idx = rows.findIndex(r => r.id === docId);

  if (idx !== -1) {
    rows[idx] = { ...rows[idx], ...data };
    saveMockData(table, rows);
  }
  console.log(`[Mock Firebase Firestore] updateDoc on ${table}/${docId}`, data);
  return Promise.resolve();
}

export async function deleteDoc(docRef: any) {
  const segments = docRef.path.split('/');
  const table = segments[0];
  const docId = segments[1];
  
  let rows = getMockData(table);
  rows = rows.filter(r => r.id !== docId);
  saveMockData(table, rows);
  console.log(`[Mock Firebase Firestore] deleteDoc on ${table}/${docId}`);
  return Promise.resolve();
}

export function onSnapshot(q: any, next: Callback, error?: any) {
  const evaluateAndTrigger = () => {
    const rows = evaluateQuery(q);
    const snapshot = {
      empty: rows.length === 0,
      docs: rows.map(r => ({
        id: r.id || 'doc-' + Math.floor(Math.random() * 1000000),
        data: () => r
      }))
    };
    next(snapshot);
  };

  evaluateAndTrigger();

  // Listen to window storage events to update in real-time
  const handleStorageChange = (e: StorageEvent) => {
    const collectionRef = q.type === 'query' ? q.collection : q;
    if (e.key === `imsc_supabase_mock_${collectionRef.path}`) {
      evaluateAndTrigger();
    }
  };

  window.addEventListener('storage', handleStorageChange);

  // Periodic polling backup for immediate interactive response
  const intervalId = setInterval(evaluateAndTrigger, 1000);

  return () => {
    window.removeEventListener('storage', handleStorageChange);
    clearInterval(intervalId);
  };
}

// Mock storage
export function getStorage() {
  return { type: 'mock-storage' };
}

export function ref(storage: any, path: string) {
  return { type: 'storage-reference', path };
}

export function uploadBytesResumable(storageRef: any, file: any) {
  console.log(`[Mock Firebase Storage] Uploading file to ${storageRef.path}`);
  const url = URL.createObjectURL(file instanceof Blob ? file : new Blob([file]));
  
  return {
    on: (event: string, progressCb: any, errorCb: any, completeCb: any) => {
      // Simulate slow uploads for good UX
      if (progressCb) progressCb({ bytesTransferred: 50, totalBytes: 100 });
      setTimeout(() => {
        if (progressCb) progressCb({ bytesTransferred: 100, totalBytes: 100 });
        if (completeCb) completeCb();
      }, 300);
    },
    snapshot: {
      ref: storageRef
    },
    then: (onfulfilled: any) => {
      return Promise.resolve({ snapshot: { ref: storageRef } }).then(onfulfilled);
    }
  };
}

export async function uploadBytes(storageRef: any, file: any) {
  console.log(`[Mock Firebase Storage] Uploading file to ${storageRef.path}`);
  return { ref: storageRef };
}

export async function getDownloadURL(storageRef: any) {
  return `https://firebasestorage.googleapis.com/v0/b/mock-app.appspot.com/o/${encodeURIComponent(storageRef.path)}`;
}
