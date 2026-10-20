'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from './config';

let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let firestore: Firestore | undefined;

export function initializeFirebase() {
  if (!isFirebaseConfigured()) {
    // When Firebase credentials are not yet configured in .env, operate in offline/local fallback
    return {
      app: undefined,
      auth: undefined,
      firestore: undefined,
      isConfigured: false,
    };
  }

  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig as any);
    auth = getAuth(app);

    // Initialize Cloud Firestore with persistent local cache (IndexedDB multi-tab)
    // Conforms to Requirement 3.1.2 & 3.3.1 for fault-tolerant offline persistence
    try {
      if (typeof window !== 'undefined') {
        firestore = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
        });
      } else {
        firestore = getFirestore(app);
      }
    } catch {
      // Fallback if already initialized (e.g. during Hot Module Reloading)
      firestore = getFirestore(app);
    }
  } catch (e) {
    console.warn('[Firebase] Initialization warning:', e);
  }

  return {
    app,
    auth,
    firestore,
    isConfigured: Boolean(app && firestore),
  };
}

export function getFirestoreInstance(): Firestore | null {
  if (firestore) return firestore;
  const res = initializeFirebase();
  return res.firestore || null;
}

export * from './provider';
export { isFirebaseConfigured };
