// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDOCqRqIwl_Mhq3vtlbb0nl-Ijn8SVWxfQ",
  authDomain: "monmon-89c30.firebaseapp.com",
  projectId: "monmon-89c30",
  storageBucket: "monmon-89c30.firebasestorage.app",
  messagingSenderId: "379585627840",
  appId: "1:379585627840:web:4757ed422dc5f006d64f25"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;