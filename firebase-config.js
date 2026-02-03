// Firebase Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import { getStorage, ref, uploadString, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";
import { FIREBASE_CONFIG, CLOUDINARY_CONFIG } from './js/config.js';

// Initialize Firebase
const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const storage = getStorage(app);

// Cloudinary Constants (Re-exporting for backward compatibility with scripts)
const CLOUDINARY_CLOUD_NAME = CLOUDINARY_CONFIG.cloudName;
const CLOUDINARY_UPLOAD_PRESET = CLOUDINARY_CONFIG.uploadPreset;

// Export instances and constants
export {
    db, storage, collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc, ref, uploadString, uploadBytes, getDownloadURL,
    CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET
};
