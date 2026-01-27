// Firebase Configuration
// IMPORTANT: You must replace these values with your own project keys from:
// https://console.firebase.google.com/ -> Project Settings -> General -> "SDK setup and configuration"

const firebaseConfig = {
    apiKey: "AIzaSyCnlqJBag724QbrSRqh5yI1t2wubDmHOEE",
    authDomain: "iti-assessment.firebaseapp.com",
    projectId: "iti-assessment",
    storageBucket: "iti-assessment.firebasestorage.app",
    messagingSenderId: "228526833685",
    appId: "1:228526833685:web:a6b791d237e6615874e1c",
    measurementId: "G-LT05Q66KMT"
};

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getStorage, ref, uploadString, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Export instances for use in script.js
export { db, storage, collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc, ref, uploadString, getDownloadURL };
