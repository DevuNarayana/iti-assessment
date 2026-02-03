import { db, collection, addDoc, getDocs, doc, deleteDoc, query, where, getDoc } from '../firebase-config.js';
import { state } from './state.js';
import { syncData } from './services.js';
import { openLightbox } from './camera.js'; // for reviewing evidence

// Helper to populate global SSC dropdown
export function updateGlobalSscDropdown() {
    const globalBatchSscSelect = document.getElementById('global-batch-ssc');
    const openCreateBatchBtn = document.getElementById('add-batch-btn');
    if (!globalBatchSscSelect) return;

    const currentVal = globalBatchSscSelect.value;
    globalBatchSscSelect.innerHTML = '<option value="" disabled selected>Select Sector Skill Council</option>';
    state.sscs.forEach(ssc => {
        const option = document.createElement('option');
        option.value = ssc.name;
        option.textContent = ssc.name;
        option.style.color = 'black';
        globalBatchSscSelect.appendChild(option);
    });

    if (!currentVal) {
        if (openCreateBatchBtn) openCreateBatchBtn.classList.add('hidden');
    } else {
        globalBatchSscSelect.value = currentVal;
        if (openCreateBatchBtn) openCreateBatchBtn.classList.remove('hidden');
    }
}

export function renderSscTable() {
    const sscTableBody = document.getElementById('ssc-table-body');
    const sscCount = document.getElementById('ssc-count');
    if (!sscTableBody) return;

    if (sscCount) sscCount.textContent = state.sscs.length;

    if (state.sscs.length === 0) {
        sscTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No SSCs added yet.</td></tr>`;
        return;
    }

    sscTableBody.innerHTML = state.sscs.map((ssc, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${ssc.name}</td>
            <td>${ssc.code}</td>
            <td>
                <button class="action-btn delete-ssc-btn" data-id="${ssc.id}" style="border-color: #ef4444; color: #ef4444; padding: 0.25rem 0.75rem;">Delete</button>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.delete-ssc-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteSsc(btn.dataset.id));
    });
}

export function renderBatchTable() {
    const batchesTableBody = document.getElementById('batches-table-body');
    const batchCount = document.getElementById('batch-count');
    const globalBatchSscSelect = document.getElementById('global-batch-ssc');

    if (!batchesTableBody) return;
    const selectedSsc = globalBatchSscSelect ? globalBatchSscSelect.value : '';

    if (!selectedSsc) {
        batchesTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">Please select a Sector Skill Council to view/add batches.</td></tr>`;
        if (batchCount) batchCount.textContent = 0;
        return;
    }

    const filteredBatches = state.batches.filter(b => b.ssc === selectedSsc);
    if (batchCount) batchCount.textContent = filteredBatches.length;

    if (filteredBatches.length === 0) {
        batchesTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">No batches found for ${selectedSsc}.</td></tr>`;
        return;
    }

    batchesTableBody.innerHTML = filteredBatches.map((batch) => `
        <tr>
            <td>${batch.sr}</td>
            <td>${batch.day}</td>
            <td>${batch.month}</td>
            <td>${batch.ssc}</td>
            <td>${batch.jobRole}</td>
            <td>${batch.batchId}</td>
            <td>${batch.skillHub}</td>
            <td>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="action-btn" style="border-color: var(--primary-color); color: var(--primary-color); padding: 0.25rem 0.75rem;">View</button>
                    <button class="action-btn delete-batch-btn" data-id="${batch.id}" style="border-color: #ef4444; color: #ef4444; padding: 0.25rem 0.75rem;">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.delete-batch-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteBatch(btn.dataset.id));
    });
}

export async function deleteSsc(id) {
    if (confirm('Are you sure you want to delete this SSC?')) {
        try {
            await deleteDoc(doc(db, "sscs", id));
            await syncData();
            renderSscTable();
            updateGlobalSscDropdown();
        } catch (err) {
            console.error("Delete SSC Error:", err);
            alert("Failed to delete SSC from cloud.");
        }
    }
}

export async function deleteBatch(id) {
    if (confirm(`Are you sure you want to delete Batch "${id}"? This will also delete ALL associated evidence photos from the cloud.`)) {
        try {
            // Logic to delete evidence and batch
            const q = query(collection(db, "assessments"), where("batchId", "==", id));
            const snapshot = await getDocs(q);
            const allPhotoUrls = [];
            const assessmentDocIds = [];

            snapshot.forEach(doc => {
                assessmentDocIds.push(doc.id);
                if (doc.data().photos) allPhotoUrls.push(...doc.data().photos);
            });

            if (allPhotoUrls.length > 0) {
                // Mock delete call or implement cloud function call for cleanup
                // Since this is client side, we might skip the API routing for now or keep it same as original
                await fetch('/api/delete-photos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urls: allPhotoUrls })
                }).catch(e => console.warn("Cloudinary delete failed/skipped", e));
            }

            await Promise.all(assessmentDocIds.map(docId => deleteDoc(doc(db, "assessments", docId))));
            await deleteDoc(doc(db, "batches", id));

            await syncData();
            renderBatchTable();
            alert(`Batch ${id} deleted.`);
        } catch (err) {
            console.error("Delete Batch Error:", err);
            alert("Failed to delete Batch.");
        }
    }
}

// Assessor Credentials Logic
export function renderAssessorCredentials() {
    const assessorFilterSsc = document.getElementById('assessor-filter-ssc');
    const assessorFilterBatch = document.getElementById('assessor-filter-batch');

    if (assessorFilterSsc && assessorFilterSsc.options.length === 1) {
        state.sscs.forEach(ssc => {
            const opt = document.createElement('option');
            opt.value = ssc.name;
            opt.textContent = ssc.name;
            assessorFilterSsc.appendChild(opt);
        });

        assessorFilterSsc.addEventListener('change', handleAssessorSscChange);
        assessorFilterBatch.addEventListener('change', renderAssessorCredentialsView);
    }
}

function handleAssessorSscChange() {
    const assessorFilterSsc = document.getElementById('assessor-filter-ssc');
    const assessorFilterBatch = document.getElementById('assessor-filter-batch');
    const credentialsContainer = document.getElementById('assessor-credentials-container');
    const selectedSsc = assessorFilterSsc.value;

    assessorFilterBatch.innerHTML = '<option value="">Select Batch</option>';
    assessorFilterBatch.disabled = true;
    if (credentialsContainer) credentialsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted);">Please select a Batch.</div>';

    if (!selectedSsc) return;

    const filteredBatches = state.batches.filter(b => b.ssc === selectedSsc);

    if (filteredBatches.length > 0) {
        assessorFilterBatch.disabled = false;
        filteredBatches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.batchId;
            opt.textContent = b.batchId;
            assessorFilterBatch.appendChild(opt);
        });
    } else {
        assessorFilterBatch.innerHTML = '<option value="">No Batches Found</option>';
        assessorFilterBatch.disabled = true;
    }
}

function renderAssessorCredentialsView() {
    const assessorFilterBatch = document.getElementById('assessor-filter-batch');
    const credentialsContainer = document.getElementById('assessor-credentials-container');
    const selectedBatchId = assessorFilterBatch.value;
    if (!selectedBatchId) return;

    const batch = state.batches.find(b => b.batchId === selectedBatchId);

    if (batch) {
        credentialsContainer.innerHTML = `
            <div class="glass-panel" style="background: rgba(255, 255, 255, 0.05); padding: 2rem; border-radius: 12px; max-width: 400px; width: 100%; border: 1px solid var(--glass-border);">
                <h3 style="margin-bottom: 1.5rem; text-align: center; color: var(--primary-color);">Login Credentials</h3>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Username (Job Role)</label>
                    <div style="background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 6px; font-family: monospace; font-size: 1.1rem; user-select: all;">${batch.jobRole}</div>
                </div>
                <div>
                    <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.25rem;">Password (Batch ID)</label>
                    <div style="background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 6px; font-family: monospace; font-size: 1.1rem; user-select: all;">${batch.batchId}</div>
                </div>
            </div>
        `;
    }
}

// Evidence Logic
export function renderAdminEvidence() {
    const countDisplay = document.getElementById('evidence-count');
    const filterSsc = document.getElementById('evidence-filter-ssc');
    const filterBatch = document.getElementById('evidence-filter-batch');
    const container = document.getElementById('evidence-grid');

    if (filterSsc && filterSsc.options.length === 1) {
        state.sscs.forEach(ssc => {
            const opt = document.createElement('option');
            opt.value = ssc.name;
            opt.textContent = ssc.name;
            filterSsc.appendChild(opt);
        });

        filterSsc.onchange = handleSscChange;
        filterBatch.onchange = renderEvidenceGrid;
    }

    if (filterBatch.value && filterBatch.value !== "") {
        renderEvidenceGrid();
    } else {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Please select a Sector Skill Council and Batch to view evidence.</div>';
        if (countDisplay) countDisplay.textContent = '0';
    }
}

function handleSscChange() {
    const selectedSsc = document.getElementById('evidence-filter-ssc').value;
    const filterBatch = document.getElementById('evidence-filter-batch');
    const container = document.getElementById('evidence-grid');
    const countDisplay = document.getElementById('evidence-count');

    filterBatch.innerHTML = '<option value="">Select Batch</option>';
    filterBatch.disabled = true;
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Please select a Batch.</div>';
    if (countDisplay) countDisplay.textContent = '0';

    if (!selectedSsc) return;

    const filteredBatches = state.batches.filter(b => b.ssc === selectedSsc);

    if (filteredBatches.length > 0) {
        filterBatch.disabled = false;
        filteredBatches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.batchId;
            opt.textContent = b.batchId;
            filterBatch.appendChild(opt);
        });
    } else {
        filterBatch.innerHTML = '<option value="">No Batches Found</option>';
        filterBatch.disabled = true;
    }
}

async function renderEvidenceGrid() {
    const container = document.getElementById('evidence-grid');
    const countDisplay = document.getElementById('evidence-count');
    const selectedBatch = document.getElementById('evidence-filter-batch').value;

    if (!selectedBatch) return;

    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem;">Loading evidence...</div>';

    const evidence = [];
    try {
        const q = query(collection(db, "assessments"), where("batchId", "==", selectedBatch));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            evidence.push({ id: doc.id, ...doc.data() });
        });
    } catch (err) {
        console.error("Error fetching evidence:", err);
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Error loading evidence.</div>';
        return;
    }

    evidence.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    if (countDisplay) countDisplay.textContent = evidence.length;

    if (evidence.length === 0) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No evidence submitted for this batch yet.</div>';
        return;
    }

    container.innerHTML = evidence.map(item => `
        <div class="glass-panel" style="padding: 1.5rem; background: rgba(255,255,255,0.03);">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <span class="badge ${item.type === 'Theory' ? 'safe' : item.type === 'Practical' ? 'warning' : 'pending'}" style="margin-bottom: 0.5rem; display: inline-block;">${item.type}</span>
                </div>
                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
                    <button class="delete-evidence-btn" data-id="${item.id}" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; cursor: pointer; margin-bottom: 0.25rem;">Delete</button>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(item.timestamp).toLocaleDateString()}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${new Date(item.timestamp).toLocaleTimeString()}</div>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 0.5rem;">
                ${item.photos.map(url => `
                    <img src="${url}" class="evidence-thumb" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;">
                `).join('')}
            </div>
        </div>
    `).join('');

    // Attach listeners
    container.querySelectorAll('.delete-evidence-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteEvidence(btn.dataset.id));
    });
    container.querySelectorAll('.evidence-thumb').forEach(img => {
        img.addEventListener('click', () => openLightbox(img.src));
    });
}

export async function deleteEvidence(id) {
    // Re-implemented delete logic here or export the one from script.js if it was unique... 
    // Wait, deleteEvidence in script.js used fetch('/api/delete-photos').
    // Since we are client-side only (likely), that fetch was probably a placeholder or specific backend.
    // I will implement the same logic.
    if (confirm('Are you sure you want to delete this evidence?')) {
        try {
            const docRef = doc(db, "assessments", id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists() && docSnap.data().photos) {
                const photos = docSnap.data().photos;
                await fetch('/api/delete-photos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ urls: photos })
                }).catch(e => console.warn("Cloudinary delete failed/skipped", e));
            }

            await deleteDoc(docRef);
            await renderEvidenceGrid();
        } catch (err) {
            console.error("Delete Evidence Error:", err);
            alert("Failed to delete evidence.");
        }
    }
}

