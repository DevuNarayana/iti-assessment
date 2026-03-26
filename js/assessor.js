import { db, collection, query, where, getDocs, addDoc, doc, deleteDoc, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '../firebase-config.js';
import { state } from './state.js';
import { openLightbox, startAssessment, requestLocation } from './camera.js';
import { showView } from './utils.js';

export function renderAssessorTasks() {
    const taskList = document.getElementById('assessor-task-list');
    if (!taskList) return;

    backToTasks(); // Reset view

    if (state.loggedInUser && state.loggedInUser.username === 'assessor') {
        taskList.innerHTML = `
            <div class="task-item">
                <div class="task-info">
                    <h4>General Assessment Dashboard</h4>
                    <span class="badge pending">System Default</span>
                </div>
                <button class="action-btn start-task-btn" data-batch="General">Start</button>
            </div>
        `;
    } else if (state.loggedInUser && state.loggedInUser.sector && state.loggedInUser.batches) {
        // Render list of all batches in this sector
        const sectorHeaderStr = `
            <div style="margin-bottom: 2rem; padding: 1.5rem; background: rgba(147, 51, 234, 0.1); border: 1px solid rgba(147, 51, 234, 0.3); border-radius: 12px; display: flex; align-items: center; justify-content: space-between;">
                <div>
                    <h4 style="color: #a855f7; margin-bottom: 0.25rem;">Bulk Sector Folder Upload</h4>
                    <p style="font-size: 0.9rem; color: var(--text-muted);">Select a master folder containing subfolders for each batch.</p>
                </div>
                <button class="action-btn" onclick="document.getElementById('bulk-sector-upload-input').click()" style="background: #9333ea; color: white;">Upload Master Folder</button>
            </div>
            <h3 style="margin-bottom: 1rem;">Batches in ${state.loggedInUser.sector}</h3>
        `;
        
        taskList.innerHTML = sectorHeaderStr + state.loggedInUser.batches.map(b => `
            <div class="task-item">
                <div class="task-info">
                    <h4>Batch: ${b.batchId}</h4>
                    <p style="margin: 0.25rem 0; font-size: 0.9rem; color: var(--text-muted);">${b.jobRole}</p>
                    <span class="badge pending">Sector Batch</span>
                </div>
                <button class="action-btn select-batch-btn" data-batch-id="${b.batchId}">Select Batch</button>
            </div>
        `).join('');
    } else if (state.loggedInUser && state.loggedInUser.batch) {
        const b = state.loggedInUser.batch;
        taskList.innerHTML = `
            <div class="task-item">
                <div class="task-info">
                    <h4>Batch: ${b.batchId}</h4>
                    <p>${b.jobRole} - ${b.ssc}</p>
                    <span class="badge pending">Ready to Start</span>
                </div>
                <button class="action-btn start-task-btn" data-batch="${b.batchId}">Start</button>
            </div>
        `;
    } else {
        taskList.innerHTML = '<p style="padding: 2rem; text-align: center;">No tasks assigned.</p>';
    }

    // Attach listener for single-batch start buttons
    document.querySelectorAll('.start-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            goToOptions(e.target.dataset.batch);
        });
    });

    // Attach listener for sector batch selection
    document.querySelectorAll('.select-batch-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const batchId = e.currentTarget.dataset.batchId;
            const selectedBatch = state.loggedInUser.batches.find(b => b.batchId === batchId);
            if (selectedBatch) {
                // Emulate single batch login for the rest of the flow
                state.loggedInUser.batch = selectedBatch;
                goToOptions(batchId);
            }
        });
    });
}

function goToOptions(batchId) {
    document.getElementById('assessor-tasks-container')?.classList.add('hidden');
    document.getElementById('assessment-options-container')?.classList.remove('hidden');
    document.getElementById('assessor-history-container')?.classList.add('hidden');

    const header = document.querySelector('#assessor-view h2');
    if (header) header.textContent = `Assessment for Batch: ${batchId}`;
}

function backToTasks() {
    document.getElementById('assessor-tasks-container')?.classList.remove('hidden');
    document.getElementById('assessment-options-container')?.classList.add('hidden');
    document.getElementById('assessor-history-container')?.classList.add('hidden');

    const header = document.querySelector('#assessor-view h2');
    if (header) header.textContent = 'My Tasks';

    // Update active nav link specific to the current view
    const currentSidebar = document.querySelector('.view.active .sidebar');
    if (currentSidebar) {
        currentSidebar.querySelectorAll('nav a').forEach(el => el.classList.remove('active'));
        const firstLink = currentSidebar.querySelector('nav a:first-child');
        if (firstLink) firstLink.classList.add('active');
    }
}

export async function getBatchHistory(batchId) {
    if (!batchId) return [];
    try {
        const q = query(collection(db, "assessments"), where("batchId", "==", batchId));
        const snapshot = await getDocs(q);
        const records = [];
        snapshot.forEach(doc => records.push({ id: doc.id, ...doc.data() }));
        return records;
    } catch (err) {
        console.error("Error fetching batch history:", err);
        return [];
    }
}

function showHistory() {
    document.getElementById('assessor-tasks-container')?.classList.add('hidden');
    document.getElementById('assessment-options-container')?.classList.add('hidden');
    document.getElementById('assessor-history-container')?.classList.remove('hidden');

    const header = document.querySelector('#assessor-view h2');
    if (header) header.textContent = 'My History';

    renderHistory();
}

async function renderHistory() {
    const container = document.getElementById('history-list');
    if (!container) return;
    container.innerHTML = '<div style="text-align: center; padding: 2rem;"><span class="loader">Loading history...</span></div>';

    const history = [];
    const currentBatchId = (state.loggedInUser && state.loggedInUser.role === 'assessor' && state.loggedInUser.batch)
        ? state.loggedInUser.batch.batchId
        : null;

    if (!currentBatchId && state.loggedInUser && state.loggedInUser.sector) {
        container.innerHTML = '<div class="glass-panel" style="padding: 2rem; text-align: center; color: var(--text-muted);">Please select a batch from <strong>My Tasks</strong> first to view its history.</div>';
        return;
    }

    try {
        let q;
        if (currentBatchId) {
            q = query(collection(db, "assessments"), where("batchId", "==", currentBatchId));
        } else {
            q = collection(db, "assessments");
        }

        const snapshot = await getDocs(q);
        snapshot.forEach(docSnap => {
            history.push({ id: docSnap.id, ...docSnap.data() });
        });
    } catch (err) {
        console.error("Error fetching history:", err);
        container.innerHTML = '<div style="text-align: center; color: red; padding: 2rem;">Error loading history.</div>';
        return;
    }

    history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    if (history.length === 0) {
        container.innerHTML = '<div class="glass-panel" style="padding: 2rem; text-align: center; color: var(--text-muted);">No assessments submitted yet.</div>';
        return;
    }

    container.innerHTML = ''; // clear loading
    history.forEach(item => {
        const date = new Date(item.timestamp).toLocaleDateString();
        const time = new Date(item.timestamp).toLocaleTimeString();

        const photosHtml = item.photos.map(url => `
            <img src="${url}" class="history-thumb" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;">
        `).join('');

        const html = `
            <div class="glass-panel" style="padding: 1.5rem;" id="history-item-${item.id}">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h3 style="color: var(--primary-color); margin-bottom: 0.25rem;">${item.type} Assessment</h3>
                        <div style="font-size: 0.9rem; color: var(--text-muted);">Batch: ${item.batchId}</div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <button class="action-btn delete-history-btn" data-id="${item.id}" style="padding: 0.25rem 0.5rem; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: #ef4444; font-size: 0.8rem; display: flex; align-items: center; gap: 0.25rem;">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                        </button>
                        <div style="font-size: 0.85rem; color: var(--text-muted);">
                            <div>${date}</div>
                            <div>${time}</div>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem;">
                    ${photosHtml}
                </div>
            </div>
        `;
        const div = document.createElement('div');
        div.innerHTML = html;
        container.appendChild(div);
    });

    // Attach lightbox listeners
    container.querySelectorAll('.history-thumb').forEach(img => {
        img.addEventListener('click', () => openLightbox(img.src));
    });

    // Attach delete listeners
    container.querySelectorAll('.delete-history-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.currentTarget.dataset.id;
            if (confirm("Are you sure you want to delete this submission? This will allow you to upload photos for this category again.")) {
                try {
                    e.currentTarget.disabled = true;
                    e.currentTarget.innerHTML = "Deleting...";
                    await deleteDoc(doc(db, "assessments", id));
                    renderHistory(); // Refresh history
                } catch (err) {
                    console.error("Error deleting document:", err);
                    alert("Failed to delete record.");
                    e.currentTarget.disabled = false;
                    e.currentTarget.innerHTML = "Delete";
                }
            }
        });
    });
}

// Initialization
export function initAssessorListeners() {
    // Nav Links
    const navTasks = document.getElementById('assessor-nav-tasks');
    const navHistory = document.getElementById('assessor-nav-history');

    if (navTasks) {
        navTasks.addEventListener('click', (e) => {
            e.preventDefault();
            navTasks.classList.add('active');
            navHistory?.classList.remove('active');
            backToTasks();
        });
    }

    if (navHistory) {
        navHistory.addEventListener('click', (e) => {
            e.preventDefault();
            navHistory.classList.add('active');
            navTasks?.classList.remove('active');
            showHistory();
        });
    }

    // Back button (in options and history)
    document.querySelectorAll('[onclick="backToTasks()"]').forEach(btn => {
        btn.removeAttribute('onclick'); // remove inline
        btn.addEventListener('click', backToTasks);
    });

    // Assessment Type Options
    document.querySelectorAll('#assessment-options-container .option-card').forEach(card => {
        card.removeAttribute('onclick');
        const h3 = card.querySelector('h3');
        if (!h3) return;
        const type = h3.textContent;

        if (type === 'Smart Folder Upload') {
            card.addEventListener('click', () => document.getElementById('smart-upload-input').click());
        } else {
            card.addEventListener('click', () => {
                startAssessment(type);
            });
        }
    });

    // Smart Folder Upload Handler
    const smartInput = document.getElementById('smart-upload-input');
    if (smartInput) {
        smartInput.addEventListener('change', handleSmartUpload);
    }
    
    // Bulk Sector Folder Upload Handler
    const bulkSectorInput = document.getElementById('bulk-sector-upload-input');
    if (bulkSectorInput) {
        bulkSectorInput.addEventListener('change', handleBulkSectorUpload);
    }
}

async function handleSmartUpload(e) {
    const files = Array.from(e.target.files);
    e.target.value = ''; // Reset
    if (files.length === 0) return;

    // Categorize
    const categories = {
        'Theory': [],
        'Practical': [],
        'Viva': [],
        'Group': [],
        'Attendance': []
    };
    
    const photoLimits = {
        'Theory': 2,
        'Practical': 2,
        'Viva': 1,
        'Group': 1,
        'Attendance': 10
    };

    files.forEach(file => {
        const name = file.name.toLowerCase();
        if (name.includes('theory')) categories['Theory'].push(file);
        else if (name.includes('practical')) categories['Practical'].push(file);
        else if (name.includes('viva')) categories['Viva'].push(file);
        else if (name.includes('group')) categories['Group'].push(file);
        else if (name.includes('att')) categories['Attendance'].push(file);
    });

    const categoriesFound = Object.entries(categories).filter(([k, v]) => v.length > 0);
    if (categoriesFound.length === 0) {
        alert("No appropriately named files found. Make sure filenames contain 'theory', 'practical', 'viva', 'group', or 'att'.");
        return;
    }

    const batch = state.loggedInUser?.batch;
    const batchId = batch?.batchId || 'Default';
    const ssc = batch?.ssc || '';

    // Fetch history to enforce limits
    const existingHistory = await getBatchHistory(batchId);
    const uploadedCounts = {
        'Theory': 0, 'Practical': 0, 'Viva': 0, 'Group': 0, 'Attendance': 0
    };
    
    existingHistory.forEach(record => {
        if (uploadedCounts[record.type] !== undefined) {
            uploadedCounts[record.type] += (record.photos ? record.photos.length : 0);
        }
    });

    try {
        let currentFileNumber = 1;
        
        // Filter out categories that are already full before counting total files
        for (const [type, typeFiles] of Object.entries(categories)) {
            const alreadyUploaded = uploadedCounts[type];
            const limit = photoLimits[type];
            if (alreadyUploaded >= limit && typeFiles.length > 0) {
                alert(`⚠️ You have already uploaded ${alreadyUploaded}/${limit} photos for ${type}. Skipping these files. Go to History to delete previous uploads if you want to replace them.`);
                categories[type] = []; // Clear them so they don't process
            } else if (alreadyUploaded + typeFiles.length > limit) {
                const allowedNew = limit - alreadyUploaded;
                alert(`⚠️ You can only upload ${allowedNew} more photo(s) for ${type}. Only the first ${allowedNew} matching files will be uploaded.`);
                categories[type] = typeFiles.slice(0, allowedNew);
            }
        }

        const categoriesFoundAfterFilter = Object.entries(categories).filter(([k, v]) => v.length > 0);
        if (categoriesFoundAfterFilter.length === 0) {
            alert("No new files to upload (all selected categories have reached their limits or no matching files were found).");
            return;
        }

        const totalFiles = categoriesFoundAfterFilter.reduce((sum, [k, v]) => sum + v.length, 0);

        // Force Location
        requestLocation();
        
        const progressDiv = document.getElementById('smart-upload-progress');
        const statusText = document.getElementById('smart-upload-status');
        progressDiv.classList.remove('hidden');

        for (const [type, filesToUpload] of categoriesFoundAfterFilter) {
            if (filesToUpload.length === 0) continue;

            const uploadedUrls = [];

            statusText.textContent = `Uploading ${type}...`;

            for (let i = 0; i < filesToUpload.length; i++) {
                statusText.textContent = `Uploading ${type} (${i+1}/${filesToUpload.length}) - File ${currentFileNumber}/${totalFiles}`;
                currentFileNumber++;

                // Read file to get raw data
                const base64Str = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (event) => resolve(event.target.result);
                    reader.readAsDataURL(filesToUpload[i]);
                });

                const formData = new FormData();
                formData.append('file', base64Str);
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

                const isPdf = base64Str.startsWith('data:application/pdf');
                const resourceType = isPdf ? 'raw' : 'image';

                const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error(`${type} upload failed`);
                }
                
                const data = await response.json();
                uploadedUrls.push(data.secure_url);
            }

            // Save to Firebase for this category
            statusText.textContent = `Saving ${type} record...`;
            const assessmentData = {
                batchId: batchId,
                ssc: ssc,
                type: type,
                photos: uploadedUrls,
                timestamp: new Date().toISOString(),
                username: state.loggedInUser?.username || 'unknown',
                location: null // using null for smart upload since it's hard to get accurate GPS for old photos
            };
            await addDoc(collection(db, "assessments"), assessmentData);
        }

        statusText.textContent = "All uploads completed successfully!";
        setTimeout(() => {
            progressDiv.classList.add('hidden');
        }, 3000);

    } catch (err) {
        console.error("Smart Upload Error:", err);
        statusText.innerHTML = `<span style="color:red">Error: ${err.message}. Please refresh and try again.</span>`;
    }
}

async function handleBulkSectorUpload(e) {
    const files = Array.from(e.target.files);
    e.target.value = ''; // Reset
    if (files.length === 0) return;

    const progressDiv = document.getElementById('bulk-sector-upload-progress');
    const statusText = document.getElementById('bulk-sector-upload-status');
    if(progressDiv) progressDiv.classList.remove('hidden');

    // Group files by Batch ID based on folder name
    // e.g., files[0].webkitRelativePath = "Master/Ban2025-09-24 151113/theory1.jpg"
    const batchesMap = {};

    files.forEach(file => {
        // Find the batch ID folder. Usually the second-to-last item.
        const pathParts = file.webkitRelativePath.split('/');
        if (pathParts.length >= 2) {
            const batchFolderName = pathParts[pathParts.length - 2];
            if (!batchesMap[batchFolderName]) {
                batchesMap[batchFolderName] = {
                    'Theory': [],
                    'Practical': [],
                    'Viva': [],
                    'Group': [],
                    'Attendance': []
                };
            }
            const name = file.name.toLowerCase();
            if (name.includes('theory')) batchesMap[batchFolderName]['Theory'].push(file);
            else if (name.includes('practical')) batchesMap[batchFolderName]['Practical'].push(file);
            else if (name.includes('viva')) batchesMap[batchFolderName]['Viva'].push(file);
            else if (name.includes('group')) batchesMap[batchFolderName]['Group'].push(file);
            else if (name.includes('att')) batchesMap[batchFolderName]['Attendance'].push(file);
        }
    });

    const photoLimits = {
        'Theory': 2,
        'Practical': 2,
        'Viva': 1,
        'Group': 1,
        'Attendance': 10
    };

    // Filter valid batches in this sector
    const sectorBatches = state.loggedInUser?.batches || [];
    const validBatchIds = sectorBatches.map(b => b.batchId);

    const validFolders = Object.keys(batchesMap).filter(folderName => validBatchIds.includes(folderName));

    if (validFolders.length === 0) {
        if(statusText) statusText.innerHTML = `<span style="color:red">No subfolders matched any Batch IDs in this sector. Make sure subfolders are named EXACTLY like the Batch IDs.</span>`;
        setTimeout(() => { if(progressDiv) progressDiv.classList.add('hidden') }, 5000);
        return;
    }

    try {
        let currentBatchNum = 1;
        const totalBatches = validFolders.length;

        for (const batchId of validFolders) {
            const categories = batchesMap[batchId];
            const batchObj = sectorBatches.find(b => b.batchId === batchId);
            const ssc = batchObj?.ssc || '';

            // Check history
            const existingHistory = await getBatchHistory(batchId);
            const uploadedCounts = {
                'Theory': 0, 'Practical': 0, 'Viva': 0, 'Group': 0, 'Attendance': 0
            };
            
            existingHistory.forEach(record => {
                if (uploadedCounts[record.type] !== undefined) {
                    uploadedCounts[record.type] += (record.photos ? record.photos.length : 0);
                }
            });

            // Prepare files to upload without exceeding limits
            for (const [type, typeFiles] of Object.entries(categories)) {
                const alreadyUploaded = uploadedCounts[type];
                const limit = photoLimits[type];
                if (alreadyUploaded >= limit && typeFiles.length > 0) {
                    categories[type] = []; // Skip
                } else if (alreadyUploaded + typeFiles.length > limit) {
                    const allowedNew = limit - alreadyUploaded;
                    categories[type] = typeFiles.slice(0, allowedNew);
                }
            }

            const categoriesFoundAfterFilter = Object.entries(categories).filter(([k, v]) => v.length > 0);
            if (categoriesFoundAfterFilter.length === 0) {
                console.log(`Skipping batch ${batchId}: No new valid files or limits reached.`);
                continue;
            }

            // Begin Upload Sequence for this Batch
            for (const [type, filesToUpload] of categoriesFoundAfterFilter) {
                if(statusText) statusText.textContent = `Batch ${currentBatchNum}/${totalBatches} (${batchId}): Uploading ${type}...`;
                const uploadedUrls = [];

                for (let i = 0; i < filesToUpload.length; i++) {
                    const base64Str = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (event) => resolve(event.target.result);
                        reader.readAsDataURL(filesToUpload[i]);
                    });

                    const formData = new FormData();
                    formData.append('file', base64Str);
                    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

                    const isPdf = base64Str.startsWith('data:application/pdf');
                    const resourceType = isPdf ? 'raw' : 'image';

                    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`, {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) throw new Error(`${type} upload failed for Batch ${batchId}`);
                    
                    const data = await response.json();
                    uploadedUrls.push(data.secure_url);
                }

                if(statusText) statusText.textContent = `Batch ${currentBatchNum}/${totalBatches} (${batchId}): Saving ${type} record...`;
                const assessmentData = {
                    batchId: batchId,
                    ssc: ssc,
                    type: type,
                    photos: uploadedUrls,
                    timestamp: new Date().toISOString(),
                    username: state.loggedInUser?.username || 'unknown',
                    location: null
                };
                await addDoc(collection(db, "assessments"), assessmentData);
            }
            currentBatchNum++;
        }

        if(statusText) statusText.innerHTML = `<span style="color: #10b981;">All batch folder uploads completed successfully!</span>`;
        setTimeout(() => { if(progressDiv) progressDiv.classList.add('hidden') }, 5000);

    } catch (err) {
        console.error("Bulk Sector Upload Error:", err);
        if(statusText) statusText.innerHTML = `<span style="color:red">Error: ${err.message}. Please refresh and try again.</span>`;
    }
}

// Re-export for use in script.js
export { backToTasks, goToOptions, showHistory };
