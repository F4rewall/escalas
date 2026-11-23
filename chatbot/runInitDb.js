import 'dotenv/config';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { ensureFirestoreBase } from './initDb.js';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyA6DkKR0vYYxWWNX6Td6K1O53GRM7-5Z_M',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'psaescalas.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'psaescalas',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'psaescalas.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '66155357211',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:66155357211:web:1998658ad9c1e6c0e444be'
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

await ensureFirestoreBase(db, process.env.SITE_URL || 'http://localhost:5173');
console.log('✅ Base de dados Firestore inicializada e verificada com sucesso!');
process.exit(0);

