import { db, collection, query, where, getDocs, addDoc, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '../firebase-config.js';
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

    // Attach listener for dynamic buttons
    document.querySelectorAll('.start-task-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            goToOptions(e.target.dataset.batch);
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

    try {
        let q;
        if (currentBatchId) {
            q = query(collection(db, "assessments"), where("batchId", "==", currentBatchId));
        } else {
            q = collection(db, "assessments");
        }

        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            history.push(doc.data());
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
            <div class="glass-panel" style="padding: 1.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                    <div>
                        <h3 style="color: var(--primary-color); margin-bottom: 0.25rem;">${item.type} Assessment</h3>
                        <div style="font-size: 0.9rem; color: var(--text-muted);">Batch: ${item.batchId}</div>
                    </div>
                    <div style="text-align: right; font-size: 0.85rem; color: var(--text-muted);">
                        <div>${date}</div>
                        <div>${time}</div>
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
}

// Initialization
export function initAssessorListeners() {
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

    // Force Location
    requestLocation();
    
    const progressDiv = document.getElementById('smart-upload-progress');
    const statusText = document.getElementById('smart-upload-status');
    progressDiv.classList.remove('hidden');

    const batch = state.loggedInUser?.batch;
    const batchId = batch?.batchId || 'Default';
    const ssc = batch?.ssc || '';

    try {
        let currentFileNumber = 1;
        const totalFiles = categoriesFound.reduce((sum, [k, v]) => sum + Math.min(v.length, photoLimits[k]), 0);

        for (const [type, typeFiles] of Object.entries(categories)) {
            if (typeFiles.length === 0) continue;

            const limit = photoLimits[type];
            const filesToUpload = typeFiles.slice(0, limit);
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

// Re-export for use in script.js
export { backToTasks, goToOptions, showHistory };
