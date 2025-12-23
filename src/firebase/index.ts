'use client';

import {initializeApp, type FirebaseApp} from 'firebase/app';
import {getAuth, type Auth} from 'firebase/auth';
import {getFirestore, type Firestore} from 'firebase/firestore';
import {firebaseConfig} from './config';

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

export function initializeFirebase() {
  if (!firebaseConfig) {
    throw new Error('Firebase config not found');
  }
  
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    firestore = getFirestore(app);

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
