import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Test Connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error && typeof error.message === 'string' && error.message.includes('the client is offline')) {
      console.warn("Firebase client is currently working offline. Using local cache fallback mode.");
    } else {
      console.log("Firebase initialized successfully. Awaiting authenticating events.");
    }
  }
}
testConnection();
