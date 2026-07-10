import * as shim from './firebase-shim';

export const db = shim.getFirestore();
export const auth = shim.getAuth();
export const storage = shim.getStorage();

export * from './firebase-shim';
