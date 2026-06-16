import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase Configuration using environment variables with the provided API keys as fallbacks
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA6DkKR0vYYxWWNX6Td6K1O53GRM7-5Z_M",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "psaescalas.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "psaescalas",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "psaescalas.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "66155357211",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:66155357211:web:1998658ad9c1e6c0e444be",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-9W1HX2S7DJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
