'use client';

import {FirebaseProvider, type FirebaseContextType} from './provider';

let app: FirebaseContextType | null = null;

/**
 * Ensures that Firebase is only initialized once on the client.
 */
function getFirebaseClient(
  getFirebase: () => FirebaseContextType
): FirebaseContextType {
  if (typeof window === 'undefined') {
    return getFirebase();
  }
  if (!app) {
    app = getFirebase();
  }
  return app;
}

/**
 * A client-side provider that composes the FirebaseProvider and ensures Firebase is initialized only once.
 */
export function FirebaseClientProvider({
  children,
  getFirebase,
}: {
  children: React.ReactNode;
  getFirebase: () => FirebaseContextType;
}) {
  return (
    <FirebaseProvider {...getFirebaseClient(getFirebase)}>
      {children}
    </FirebaseProvider>
  );
}
