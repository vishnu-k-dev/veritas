/**
 * Firebase SDK — single instance for the entire app
 * Config loaded from env vars (VITE_ prefix for Vite injection)
 * SECURITY: No hardcoded fallbacks — all values must come from .env
 */
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, GithubAuthProvider, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
export const githubProvider = new GithubAuthProvider();
githubProvider.addScope('public_repo'); // Read-only access to public repos

/**
 * getAuthToken — race-condition-safe Firebase ID token retrieval.
 *
 * Problem: auth.currentUser can be null at component mount even when the user
 * is logged in, because React state (onAuthStateChanged) and the Firebase SDK
 * singleton hydrate asynchronously and independently.
 *
 * Solution: fast path if currentUser is already set; otherwise wait for the
 * next onAuthStateChanged event (up to 8 seconds) before giving up.
 */
export function getAuthToken() {
  if (auth.currentUser) return auth.currentUser.getIdToken();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error('Authentication timeout — please sign in again'));
    }, 15000);

    const unsub = onAuthStateChanged(auth, (user) => {
      clearTimeout(timer);
      unsub();
      if (user) resolve(user.getIdToken());
      else reject(new Error('Not authenticated'));
    });
  });
}

export default app;
