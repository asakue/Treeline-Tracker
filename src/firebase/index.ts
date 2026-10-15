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
import { firebaseConfig } from './config';

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

export function initializeFirebase() {
  if (!firebaseConfig) {
    throw new Error('Firebase config not found');
  }

  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
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
    console.error('Failed to initialize Firebase', e);
  }

  return {
    app,
    auth,
    firestore,
  };
}

export * from './provider';
