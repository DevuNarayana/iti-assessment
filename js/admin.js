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

// Initialization
export function initAdminListeners() {
    // Add SSC Form
    const sscForm = document.getElementById('add-ssc-form');
    if (sscForm) {
        sscForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const sscName = document.getElementById('ssc-name').value.trim();
            const sscCode = document.getElementById('ssc-code').value.trim();
            if (sscName && sscCode) {
                await addDoc(collection(db, "sscs"), { name: sscName, code: sscCode, createdAt: new Date().toISOString() });
                await syncData();
                renderSscTable();
                updateGlobalSscDropdown();
                document.getElementById('add-ssc-modal').classList.add('hidden');
                e.target.reset();
            }
        });
    }

    // Add Batch Form
    const batchForm = document.getElementById('create-batch-form');
    if (batchForm) {
        batchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const ssc = document.getElementById('global-batch-ssc').value;
            const batchId = document.getElementById('batch-id').value.trim();
            const jobRole = document.getElementById('job-role').value.trim();
            const skillHub = document.getElementById('skill-hub').value.trim();
            const dateVal = document.getElementById('batch-date').value;

            if (ssc && batchId && jobRole && dateVal) {
                const dateObj = new Date(dateVal);
                const day = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                const month = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

                const batchData = {
                    ssc,
                    batchId,
                    jobRole,
                    skillHub,
                    day,
                    month,
                    timestamp: new Date().toISOString()
                };

                await addDoc(collection(db, "batches"), batchData);
                await syncData();
                renderBatchTable();
                document.getElementById('create-batch-modal').classList.add('hidden');
                e.target.reset();
            }
        });
    }
}

// Word Generator Logic
export function renderWordGenerator() {
    const wordFilterSsc = document.getElementById('word-filter-ssc');
    const wordFilterBatch = document.getElementById('word-filter-batch');
    const wordPreviewContainer = document.getElementById('word-preview-container');

    // Check if options are already populated to avoid duplication
    if (wordFilterSsc && wordFilterSsc.options.length === 1) {
        state.sscs.forEach(ssc => {
            const opt = document.createElement('option');
            opt.value = ssc.name;
            opt.textContent = ssc.name;
            wordFilterSsc.appendChild(opt);
        });

        wordFilterSsc.onchange = () => {
            const selectedSsc = wordFilterSsc.value;
            wordFilterBatch.innerHTML = '<option value="">Select Batch</option>';
            wordFilterBatch.disabled = true;
            // Reset preview
            if (wordPreviewContainer) wordPreviewContainer.innerHTML = '<p>Select a Batch to generate the Evidence Report.</p>';

            if (selectedSsc) {
                const filteredBatches = state.batches.filter(b => b.ssc === selectedSsc);
                if (filteredBatches.length > 0) {
                    wordFilterBatch.disabled = false;
                    filteredBatches.forEach(b => {
                        const opt = document.createElement('option');
                        opt.value = b.batchId;
                        opt.textContent = b.batchId;
                        wordFilterBatch.appendChild(opt);
                    });
                } else {
                    wordFilterBatch.innerHTML = '<option value="">No Batches Found</option>';
                }
            }
        };

        wordFilterBatch.onchange = () => {
            const selectedBatchId = wordFilterBatch.value;
            if (!wordPreviewContainer) return;

            if (!selectedBatchId) {
                wordPreviewContainer.innerHTML = '<p>Select a Batch to generate the Evidence Report.</p>';
                return;
            }

            // Show Ready State with both Word and PDF options
            wordPreviewContainer.innerHTML = `
                 <div style="text-align: center;">
                     <svg width="64" height="64" fill="#2563eb" viewBox="0 0 24 24" style="margin-bottom: 1rem;">
                         <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0"/>
                     </svg>
                     <h3>Ready to Generate</h3>
                     <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Report for Batch: <strong>${selectedBatchId}</strong></p>
                     <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                         <button id="regen-word-btn" class="action-btn primary" style="background: #2563eb; padding: 0.75rem 2rem; display: flex; align-items: center; gap: 0.5rem;">
                              <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0V4c0-1.1-.9-2-2-2zm-2 16H8v-2h4v2zm3-4H8v-2h7v2zm0-4H8V8h7v2z"/></svg>
                             Download Word
                         </button>
                         <button id="regen-pdf-btn" class="action-btn" style="background: #e11d48; color: white; padding: 0.75rem 2rem; display: flex; align-items: center; gap: 0.5rem;">
                             <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
                             Download PDF
                         </button>
                     </div>
                 </div>
             `;
            document.getElementById('regen-word-btn').addEventListener('click', () => generateWordDoc(false));
            document.getElementById('regen-pdf-btn').addEventListener('click', () => generateWordDoc(true));

            // Attendance Download Hook
            const attendanceBtn = document.getElementById('download-attendance-btn');
            if (attendanceBtn) {
                attendanceBtn.style.display = 'block';
                attendanceBtn.onclick = () => generateAttendanceReport();
            }
        };
    }

    async function generateAttendanceReport() {
        const selectedBatchId = document.getElementById('word-filter-batch').value;
        if (!selectedBatchId) return;

        const batch = state.batches.find(b => b.batchId === selectedBatchId);
        if (!batch) return;

        console.log('Generating Attendance Report...');
        const attendanceItems = [];

        try {
            const q = query(collection(db, "assessments"),
                where("batchId", "==", selectedBatchId),
                where("type", "==", "Attendance")
            );
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.photos) attendanceItems.push(...data.photos);
            });
        } catch (err) {
            console.error("Error fetching attendance:", err);
            alert("Error fetching attendance data.");
            return;
        }

        if (attendanceItems.length === 0) {
            alert('No attendance records found for this batch!');
            return;
        }

        // Create PDF logic for attendance
        const element = document.createElement('div');
        element.style.padding = '40px';
        element.style.background = 'white';
        element.style.color = 'black';
        element.style.fontFamily = 'Arial, sans-serif';

        element.innerHTML = `
            <h1 style="text-align: center; color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px;">Attendance Sheets</h1>
            <div style="margin: 20px 0; padding: 15px; background: #f3f4f6; border-radius: 8px;">
                <p><strong>Batch ID:</strong> ${batch.batchId}</p>
                <p><strong>SSC:</strong> ${batch.ssc}</p>
                <p><strong>Job Role:</strong> ${batch.jobRole}</p>
                <p><strong>Skill Hub:</strong> ${batch.skillHub}</p>
            </div>
            <div id="attendance-content">
                ${attendanceItems.map((url, idx) => {
            const isPdf = url.includes('.pdf') || url.startsWith('data:application/pdf');
            if (isPdf) {
                return `<div style="padding: 20px; border: 1px dashed #ccc; margin-bottom: 20px; text-align: center;">
                            <p><strong>File ${idx + 1}:</strong> PDF Document Attached</p>
                            <a href="${url}" target="_blank" style="color: #2563eb;">View Original PDF</a>
                        </div>`;
            }
            return `<div style="margin-bottom: 30px; text-align: center; page-break-inside: avoid;">
                        <p style="text-align: left; font-weight: bold; font-size: 14px;">Sheet ${idx + 1}:</p>
                        <img src="${url}" style="max-width: 100%; border: 1px solid #000; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    </div>`;
        }).join('')}
            </div>
        `;

        const opt = {
            margin: 0.5,
            filename: `Attendance_${batch.batchId}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save();
    }

    async function generateWordDoc(isPdf = false) {
        const selectedBatchId = wordFilterBatch.value;
        if (!selectedBatchId) return;

        const batch = state.batches.find(b => b.batchId === selectedBatchId);
        if (!batch) { alert('Batch data not found.'); return; }

        // Fetch and Group Evidence Photos from Firestore
        const photoGroups = {
            'Theory': [],
            'Practical': [],
            'Viva': [],
            'Group': []
        };

        try {
            const q = query(collection(db, "assessments"), where("batchId", "==", selectedBatchId));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.photos && Array.isArray(data.photos)) {
                    const type = data.type || 'Unknown';
                    if (photoGroups[type]) {
                        photoGroups[type].push(...data.photos);
                    }
                }
            });
        } catch (err) {
            console.error("Error fetching photos for Word report:", err);
            alert("Error fetching photos from cloud.");
            return;
        }

        // Combine photos in mandated order: Theory -> Practical -> Viva -> Group
        const orderedPhotos = [
            ...photoGroups['Theory'],
            ...photoGroups['Practical'],
            ...photoGroups['Viva'],
            ...photoGroups['Group']
        ];

        if (orderedPhotos.length === 0) {
            alert('No photos found for this batch!');
            return;
        }

        // Limit to 6 photos for the single-page layout
        const photosToUse = orderedPhotos.slice(0, 6);

        // Generate HTML for Word
        // MSO Header/Footer Implementation
        try {
            console.log('Generating Word Doc...');

            const htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>Evidence Report</title>
                <style>
                    /* Page Setup - Zero Tolerance A4 */
                    @page Section1 {
                        size: A4;
                        margin: 0.3in; 
                        mso-header-margin: 0.1in; 
                        mso-footer-margin: 0.1in;
                        mso-page-orientation: portrait;
                    }
                    div.Section1 { 
                        page: Section1;
                        mso-element:header;
                    }
                    
                    body { 
                        font-family: 'Calibri', 'Arial', sans-serif; 
                        margin: 0;
                        padding: 0;
                        mso-line-height-rule: exactly;
                    }

                    .header-content {
                        text-align: center;
                        margin-bottom: 0pt; /* ZERO margin */
                        font-weight: bold;
                        font-size: 14pt;
                        line-height: 1.0;
                    }

                    .main-table {
                        border-collapse: collapse;
                        table-layout: fixed;
                        margin-bottom: -100pt; /* ZERO TOLERANCE PULL-UP */
                    }
                </style>
            </head>
            <body>
                <div class="Section1">
                    <!-- Tight 9.8in height to guarantee single page with 2.82in photos -->
                    <table class="main-table" width="100%" height="9.8in" cellspacing="0" cellpadding="0" style="height: 9.8in; mso-padding-alt: 0 0 0 0;">
                        <tr>
                            <td height="9.8in" style="border: 6pt solid black; padding: 2pt; vertical-align: top; text-align: center; height: 9.8in;">
                                
                                <div class="header-content">
                                    <p style="margin: 0; padding: 0;">Name of the Skill Hub: ${batch.skillHub || 'NAC-Bhimavaram'}</p>
                                    <p style="margin: 0; padding: 0;">Batch ID: ${batch.batchId}</p>
                                    <p style="margin: 0; padding: 0;">Job Role: ${batch.jobRole}</p>
                                </div>

                                <table width="100%" cellspacing="2" cellpadding="0" style="margin: 0 auto; table-layout: fixed;">
                                    ${generateGridRows(photosToUse)}
                                </table>

                            </td>
                        </tr>
                    </table>
                    <!-- Hidden Trailing Paragraph - Maximum Deletion -->
                    <p style="font-size: 1pt; line-height: 1pt; margin: 0; padding: 0; display: none; mso-hide: all; height: 0; overflow: hidden; mso-element:header;">&nbsp;</p>
                </div>
            </body>
            </html>
            `;

            if (isPdf) {
                // PDF Generation - Version 52.0 (Fixing Double Border & 2-Page Spill)
                const element = document.createElement('div');
                element.style.width = '8.27in';
                element.style.background = 'white';

                // Construct a CLEAN HTML snippet specifically for PDF
                element.innerHTML = `
                    <div style="width: 8.27in; padding: 0.3in; background: white; color: black; font-family: Calibri, Arial, sans-serif;">
                        <div style="width: 100%; border: 7.5pt solid black; min-height: 10.6in; padding: 10pt; box-sizing: border-box;">
                            <div style="text-align: center; margin-bottom: 20pt; font-weight: bold; font-size: 14pt; color: black !important;">
                                <p style="margin: 0; padding: 1pt;">Name of the Skill Hub: ${batch.skillHub || 'NAC-Bhimavaram'}</p>
                                <p style="margin: 0; padding: 1pt;">Batch ID: ${batch.batchId}</p>
                                <p style="margin: 0; padding: 1pt;">Job Role: ${batch.jobRole}</p>
                            </div>
                            <table width="100%" cellspacing="5" cellpadding="0" style="table-layout: fixed; margin: 0 auto;">
                                ${generateGridRows(photosToUse)}
                            </table>
                        </div>
                    </div>
                `;

                // Set EXACT image dimensions for PDF - REMOVED REPEAT BORDER
                const imgs = element.querySelectorAll('img');
                imgs.forEach(img => {
                    img.style.width = '3.33in';
                    img.style.height = '2.82in';
                    img.style.display = 'block';
                    img.style.margin = '0 auto';
                    // NO EXTRA BORDER HERE - It's already in generateGridRows
                });

                const opt = {
                    margin: 0,
                    filename: `Evidence_Report_${batch.batchId}.pdf`,
                    image: { type: 'jpeg', quality: 1.0 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        logging: false
                    },
                    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
                };

                html2pdf().set(opt).from(element).save();
                return;
            }

            const blob = new Blob(['\ufeff', htmlContent], {
                type: 'application/msword'
            });

            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Evidence_Report_${selectedBatchId}.doc`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Success Feedback
            console.log('Download triggered');
        } catch (err) {
            console.error(err);
            alert('Error generating report: ' + err.message);
        }
    }

    function generateGridRows(photos) {
        let rows = '';
        for (let i = 0; i < photos.length; i += 2) {
            const p1 = photos[i];
            const p2 = photos[i + 1];

            rows += '<tr>';

            // Version 40.0 - EXACT dimensions: 3.33in x 2.82in
            rows += '<td align="center" style="padding: 1pt;">';
            rows += '<table cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 4.5pt solid black; margin: 0 auto;">';
            rows += '<tr><td style="padding: 0; margin: 0; line-height: 0; mso-line-height-rule: exactly;">';
            rows += `<img src="${p1}" width="320" height="270" style="width:3.33in; height:2.82in; display:block;">`;
            rows += '</td></tr></table>';
            rows += '</td>';

            if (p2) {
                // Version 40.0 - EXACT dimensions: 3.33in x 2.82in
                rows += '<td align="center" style="padding: 1pt;">';
                rows += '<table cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 4.5pt solid black; margin: 0 auto;">';
                rows += '<tr><td style="padding: 0; margin: 0; line-height: 0; mso-line-height-rule: exactly;">';
                rows += `<img src="${p2}" width="320" height="270" style="width:3.33in; height:2.82in; display:block;">`;
                rows += '</td></tr></table>';
                rows += '</td>';
            } else {
                rows += '<td></td>';
            }
            rows += '</tr>';
        }
        return rows;
    }
}
