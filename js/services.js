import { db, collection, getDocs } from '../firebase-config.js';
import { state } from './state.js';

export async function syncData() {
    try {
        // Fetch SSCs
        const sscSnapshot = await getDocs(collection(db, "sscs"));
        state.sscs = sscSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Batches
        const batchSnapshot = await getDocs(collection(db, "batches"));
        state.batches = batchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        console.log("Data Synced from Firebase", { sscs: state.sscs, batches: state.batches });
    } catch (err) {
        console.error("Sync Data Error:", err);
    }
}
