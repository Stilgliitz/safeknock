// firebaseConfig.js
import { initializeApp, getApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBkk6_zTg6JzKxH0kbSvqLL21sx8KqNzD0",
  authDomain: "safeknock-a6558.firebaseapp.com",
  projectId: "safeknock-a6558",
  storageBucket: "safeknock-a6558.firebasestorage.app",
  messagingSenderId: "945538325793",
  appId: "1:945538325793:web:8c4a1275b12f562a9a3260",
  measurementId: "G-5WZ5RM2YRX"
};

// Reuse the existing app after a fast refresh instead of creating a second one.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Store the login session in AsyncStorage so users stay signed in between
// app launches. Without this, Firebase keeps the session in memory only.
let auth;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  // initializeAuth throws if it has already run (for example after a fast refresh).
  auth = getAuth(app);
}

// Note: Firebase Analytics is not initialised here because the Firebase JS SDK
// does not support Analytics in React Native.

export { auth };
export const db = getFirestore(app);
