import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBMw7p1dE7LY30uRi08LzTKxFosa-Y4kxM",
  authDomain: "hotel-management-538e0.firebaseapp.com",
  databaseURL: "https://hotel-management-538e0-default-rtdb.firebaseio.com",
  projectId: "hotel-management-538e0",
  storageBucket: "hotel-management-538e0.firebasestorage.app",
  messagingSenderId: "287982821133",
  appId: "1:287982821133:web:d2825b215b7f664aa31a44",
  measurementId: "G-2NZ1CQJVNQ",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { auth, db };
