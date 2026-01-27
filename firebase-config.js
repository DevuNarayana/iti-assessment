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

// Cloudinary Configuration (For Image Storage without Credit Card)
const CLOUDINARY_CLOUD_NAME = "derqad6eq";
const CLOUDINARY_UPLOAD_PRESET = "g5bnz7sq";

// Initialize Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getStorage, ref, uploadString, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Export instances and constants for use in script.js
export {
    db, storage, collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc, ref, uploadString, uploadBytes, getDownloadURL,
    CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET
};
