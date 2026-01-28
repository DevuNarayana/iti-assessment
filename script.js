import {
    db, storage, collection, addDoc, getDocs, query, where, doc, getDoc, updateDoc, deleteDoc, ref, uploadString, uploadBytes, getDownloadURL,
    CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET
} from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    // State
    let currentRole = 'admin'; // Default

    // Elements
    const roleBtns = document.querySelectorAll('.role-btn');
    const loginForm = document.getElementById('login-form');
    const errorMsg = document.getElementById('error-message');
    const app = document.getElementById('app');

    // Views
    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const assessorView = document.getElementById('assessor-view');

    // Firebase Data State
    let sscs = [];
    let batches = [];

    // Initialize App
    async function initApp() {
        try {
            await syncData();
            // Initial all tables
            renderSscTable();
            updateGlobalSscDropdown();
            renderBatchTable();
            renderAssessorCredentials();
        } catch (err) {
            console.error("Initialization Error:", err);
        }
    }

    async function syncData() {
        // Fetch SSCs
        const sscSnapshot = await getDocs(collection(db, "sscs"));
        sscs = sscSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Batches
        const batchSnapshot = await getDocs(collection(db, "batches"));
        batches = batchSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        console.log("Data Synced from Firebase", { sscs, batches });
    }

    initApp();


    // Role Selection
    roleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            roleBtns.forEach(b => b.classList.remove('active'));
            // Add to clicked
            btn.classList.add('active');
            // Update state
            currentRole = btn.dataset.role;
            // Optional: visual feedback or focus input
            document.getElementById('username').focus();
            errorMsg.textContent = ''; // clear errors
        });
    });

    // Login Handler
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();

        if (validateLogin(username, password, currentRole)) {
            // Success
            loginSuccess(currentRole);
        } else {
            // Failure
            let msg = 'Invalid credentials.';
            if (currentRole === 'admin') msg = 'Invalid Admin credentials. Try admin/admin.';
            if (currentRole === 'assessor') msg = 'Invalid Assessor credentials. Use Job Role as Username and Batch ID as Password.';
            showError(msg);
        }
    });

    // Logout Handlers
    document.getElementById('logout-admin').addEventListener('click', logout);
    document.getElementById('logout-assessor').addEventListener('click', logout);

    // Helpers
    // Batches Management
    const globalBatchSscSelect = document.getElementById('global-batch-ssc'); // New global dropdown
    const openCreateBatchBtn = document.getElementById('add-batch-btn');
    const addBatchModal = document.getElementById('add-batch-modal');
    const createBatchForm = document.getElementById('create-batch-form');
    const cancelBatchBtn = document.getElementById('cancel-batch-btn');
    const batchesTableBody = document.getElementById('batches-table-body');
    const batchCount = document.getElementById('batch-count'); // New count element

    // Batches Management removed local initialization

    // Helper to populate global SSC dropdown
    function updateGlobalSscDropdown() {
        if (!globalBatchSscSelect) return;
        // Keep selected value if any
        const currentVal = globalBatchSscSelect.value;

        globalBatchSscSelect.innerHTML = '<option value="" disabled selected>Select Sector Skill Council</option>';
        sscs.forEach(ssc => {
            const option = document.createElement('option');
            option.value = ssc.name;
            option.textContent = ssc.name;
            option.style.color = 'black';
            globalBatchSscSelect.appendChild(option);
        });

        // Ensure button is hidden if nothing selected
        if (!currentVal) {
            if (openCreateBatchBtn) openCreateBatchBtn.classList.add('hidden');
        } else {
            globalBatchSscSelect.value = currentVal;
            if (openCreateBatchBtn) openCreateBatchBtn.classList.remove('hidden');
        }
    }

    // Assessor Management
    // Assessor Credentials Viewer
    const assessorFilterSsc = document.getElementById('assessor-filter-ssc');
    const assessorFilterBatch = document.getElementById('assessor-filter-batch');
    const credentialsContainer = document.getElementById('assessor-credentials-container');

    function renderAssessorCredentials() {
        // Populate SSC Dropdown
        if (assessorFilterSsc && assessorFilterSsc.options.length === 1) {
            const sscList = sscs;
            sscList.forEach(ssc => {
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
        const selectedSsc = assessorFilterSsc.value;

        // Reset Batch
        assessorFilterBatch.innerHTML = '<option value="">Select Batch</option>';
        assessorFilterBatch.disabled = true;
        credentialsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted);">Please select a Batch.</div>';

        if (!selectedSsc) return;

        const allBatches = batches;
        const filteredBatches = allBatches.filter(b => b.ssc === selectedSsc);

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
        const selectedBatchId = assessorFilterBatch.value;
        if (!selectedBatchId) return;

        const allBatches = batches;
        const batch = allBatches.find(b => b.batchId === selectedBatchId);

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

    // Helper to render batches table (filtered by global SSC)
    function renderBatchTable() {
        if (!batchesTableBody) return;

        const selectedSsc = globalBatchSscSelect ? globalBatchSscSelect.value : '';

        // If no SSC selected, show message
        if (!selectedSsc) {
            batchesTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        Please select a Sector Skill Council to view/add batches.
                    </td>
                </tr>`;
            if (batchCount) batchCount.textContent = 0;
            return;
        }

        // Filter batches 
        const filteredBatches = batches.filter(b => b.ssc === selectedSsc);

        // Update count
        if (batchCount) {
            batchCount.textContent = filteredBatches.length;
        }

        if (filteredBatches.length === 0) {
            batchesTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No batches found for ${selectedSsc}.
                    </td>
                </tr>`;
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
                        <button class="action-btn" style="border-color: var(--primary-color); color: var(--primary-color); padding: 0.25rem 0.75rem;">
                            View
                        </button>
                        <button class="action-btn" onclick="deleteBatch('${batch.id}')" style="border-color: #ef4444; color: #ef4444; padding: 0.25rem 0.75rem;">
                            Delete
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }


    // Event Listener for Global SSC Dropdown
    if (globalBatchSscSelect) {
        globalBatchSscSelect.addEventListener('change', () => {
            const selected = globalBatchSscSelect.value;
            if (selected) {
                // Show Create Button
                if (openCreateBatchBtn) openCreateBatchBtn.classList.remove('hidden');
                // Render Table for this SSC
                renderBatchTable();
            } else {
                if (openCreateBatchBtn) openCreateBatchBtn.classList.add('hidden');
            }
        });
    }

    if (openCreateBatchBtn) {
        openCreateBatchBtn.addEventListener('click', () => {
            addBatchModal.classList.remove('hidden');
        });
    }

    if (cancelBatchBtn) {
        cancelBatchBtn.addEventListener('click', () => {
            addBatchModal.classList.add('hidden');
            createBatchForm.reset();
        });
    }

    if (createBatchForm) {
        createBatchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const sr = document.getElementById('batch-sr').value.trim();
            const day = document.getElementById('batch-day').value.trim();
            const month = document.getElementById('batch-month').value.trim();
            // Get SSC from global dropdown
            const ssc = globalBatchSscSelect.value;
            const jobRole = document.getElementById('batch-job-role').value.trim();
            const batchId = document.getElementById('batch-id').value.trim();
            const skillHub = document.getElementById('batch-skill-hub').value.trim();

            console.log('Attempting to create batch:', { sr, day, month, ssc, jobRole, batchId, skillHub });

            if (sr && day && month && ssc && jobRole && batchId && skillHub) {
                try {
                    const newBatch = {
                        sr, day, month, ssc, jobRole, batchId, skillHub,
                        createdAt: new Date().toISOString()
                    };
                    await addDoc(collection(db, "batches"), newBatch);
                    await syncData(); // Refresh local list
                    renderBatchTable();

                    // Close modal and show success
                    addBatchModal.classList.add('hidden');
                    createBatchForm.reset();
                    alert(`Batch created successfully!`);
                } catch (err) {
                    console.error("Error adding Batch:", err);
                    alert("Failed to add Batch to cloud.");
                }
            } else {
                console.error('Validation missing fields');
                let missing = [];
                if (!sr) missing.push('Sr. No');
                if (!day) missing.push('Date');
                if (!month) missing.push('Month');
                if (!ssc) missing.push('SSC (Select from main dropdown)');
                if (!jobRole) missing.push('Job Role');
                if (!batchId) missing.push('Batch ID');
                if (!skillHub) missing.push('Skill Hub');
                alert('Please fill all fields:\n' + missing.join(', '));
            }
        });
    }

    // Admin Sidebar Navigation
    const navLinks = document.querySelectorAll('.nav-link');
    const adminSections = document.querySelectorAll('.admin-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Remove active from all links
            navLinks.forEach(l => l.classList.remove('active'));
            // Add active to clicked link
            link.classList.add('active');

            // Hide all sections
            adminSections.forEach(section => section.classList.remove('active'));

            // Show target section
            const targetId = link.dataset.section;
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');

                // Trigger specific renders
                if (targetId === 'batches-section') renderBatchTable();
                if (targetId === 'assessors-section') renderAssessorCredentials();
                if (targetId === 'ssc-section') renderSscTable();
                if (targetId === 'evidence-section') renderAdminEvidence();
                if (targetId === 'word-section') renderWordSection();
            }
        });
    });

    // SSC Management
    const addSscBtn = document.getElementById('add-ssc-btn');
    const addSscModal = document.getElementById('add-ssc-modal');
    const addSscForm = document.getElementById('add-ssc-form');
    const cancelSscBtn = document.getElementById('cancel-ssc-btn');
    const sscTableBody = document.getElementById('ssc-table-body');
    const sscCount = document.getElementById('ssc-count');

    // Initial SSC data removed local initialization

    if (addSscBtn) {
        addSscBtn.addEventListener('click', () => {
            addSscModal.classList.remove('hidden');
        });
    }

    if (cancelSscBtn) {
        cancelSscBtn.addEventListener('click', () => {
            addSscModal.classList.add('hidden');
            addSscForm.reset();
        });
    }

    if (addSscForm) {
        addSscForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const sscName = document.getElementById('ssc-name').value.trim();
            const sscCode = document.getElementById('ssc-code').value.trim();

            if (sscName && sscCode) {
                try {
                    await addDoc(collection(db, "sscs"), { name: sscName, code: sscCode, createdAt: new Date() });
                    await syncData(); // Refresh local list
                    renderSscTable();
                    updateGlobalSscDropdown();
                    addSscModal.classList.add('hidden');
                    addSscForm.reset();
                    console.log('SSC Added to Firebase:', { name: sscName, code: sscCode });
                } catch (err) {
                    console.error("Error adding SSC:", err);
                    alert("Failed to add SSC to cloud.");
                }
            }
        });
    }

    function renderSscTable() {
        if (!sscTableBody) return;

        // Update count
        if (sscCount) {
            sscCount.textContent = sscs.length;
        }

        if (sscs.length === 0) {
            sscTableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No SSCs added yet.
                    </td>
                </tr>`;
            return;
        }

        sscTableBody.innerHTML = sscs.map((ssc, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${ssc.name}</td>
                <td>${ssc.code}</td>
                <td>
                    <button class="action-btn" onclick="deleteSsc('${ssc.id}')" style="border-color: #ef4444; color: #ef4444; padding: 0.25rem 0.75rem;">
                        Delete
                    </button>
                </td>
            </tr>
        `).join('');
    }


    // Removed closeModalBtn reference - modal no longer exists

    // Global state for logged in user
    let loggedInUser = null;

    // Updated Validation to include Batches
    function validateLogin(username, password, role) {
        console.log('Login Attempt:', { username, password, role });

        const isValid = (role === 'admin') ? (username === 'admin' && password === 'admin') : false;
        if (isValid) return true;

        if (role === 'assessor') {
            // Static login fallback
            if (username === 'assessor' && password === 'assessor') {
                loggedInUser = { role: 'assessor', username: 'assessor' };
                return true;
            }

            console.log('Current Batches:', batches);
            // Check against batches
            // SWAPPED: Username = Job Role, Password = Batch ID
            const batchMatch = batches.find(b => {
                return b.jobRole.trim() === username.trim() && b.batchId.trim() === password.trim();
            });

            if (batchMatch) {
                loggedInUser = { role: 'assessor', username: username, batch: batchMatch };
                console.log('Batch Match Found:', batchMatch);
                return true;
            }
        }
        return false;
    }

    function loginSuccess(role) {
        // Animation out
        loginView.style.opacity = '0';
        loginView.style.transform = 'translateY(-20px)';

        setTimeout(() => {
            loginView.classList.remove('active');
            // Reset styles for next time
            loginView.style.opacity = '';
            loginView.style.transform = '';

            console.log(`Login Success for ${role}. Transitioning views...`);
            if (role === 'admin') {
                showView(adminView);
            } else {
                showView(assessorView);
                renderAssessorTasks();
            }
        }, 300);
    }

    // Assessor Flow Functions
    function renderAssessorTasks() {
        const taskList = document.getElementById('assessor-task-list');
        if (!taskList) return;

        // Reset view state
        backToTasks();

        if (loggedInUser && loggedInUser.username === 'assessor') {
            taskList.innerHTML = `
                <div class="task-item">
                    <div class="task-info">
                        <h4>General Assessment Dashboard</h4>
                        <span class="badge pending">System Default</span>
                    </div>
                    <button class="action-btn" onclick="goToOptions('General')">Start</button>
                </div>
            `;
        } else if (loggedInUser && loggedInUser.batch) {
            const b = loggedInUser.batch;
            taskList.innerHTML = `
                <div class="task-item">
                    <div class="task-info">
                        <h4>Batch: ${b.batchId}</h4>
                        <p>${b.jobRole} - ${b.ssc}</p>
                        <span class="badge pending">Ready to Start</span>
                    </div>
                    <button class="action-btn" onclick="goToOptions('${b.batchId}')">Start</button>
                </div>
            `;
        } else {
            taskList.innerHTML = '<p style="padding: 2rem; text-align: center;">No tasks assigned.</p>';
        }
    }

    function goToOptions(batchId) {
        document.getElementById('assessor-tasks-container').classList.add('hidden');
        document.getElementById('assessment-options-container').classList.remove('hidden');
        document.getElementById('assessor-history-container').classList.add('hidden');
        document.querySelector('#assessor-view h2').textContent = `Assessment for Batch: ${batchId}`;
    }

    function backToTasks() {
        document.getElementById('assessor-tasks-container').classList.remove('hidden');
        document.getElementById('assessment-options-container').classList.add('hidden');
        document.getElementById('assessor-history-container').classList.add('hidden');
        document.querySelector('#assessor-view h2').textContent = 'My Tasks';

        // Update active nav link specific to the current view
        const currentSidebar = document.querySelector('.view.active .sidebar');
        if (currentSidebar) {
            currentSidebar.querySelectorAll('nav a').forEach(el => el.classList.remove('active'));
            const firstLink = currentSidebar.querySelector('nav a:first-child');
            if (firstLink) firstLink.classList.add('active');
        }
    }

    function showHistory() {
        document.getElementById('assessor-tasks-container').classList.add('hidden');
        document.getElementById('assessment-options-container').classList.add('hidden');
        document.getElementById('assessor-history-container').classList.remove('hidden');
        document.querySelector('#assessor-view h2').textContent = 'My History';
        renderHistory();
    }

    async function renderHistory() {
        const container = document.getElementById('history-list');
        container.innerHTML = '<div style="text-align: center; padding: 2rem;"><span class="loader">Loading history...</span></div>';

        const history = [];
        const currentBatchId = (loggedInUser && loggedInUser.role === 'assessor' && loggedInUser.batch)
            ? loggedInUser.batch.batchId
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

        // Sort by timestamp desc
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (history.length === 0) {
            container.innerHTML = '<div class="glass-panel" style="padding: 2rem; text-align: center; color: var(--text-muted);">No assessments submitted yet.</div>';
            return;
        }

        history.forEach(item => {
            const date = new Date(item.timestamp).toLocaleDateString();
            const time = new Date(item.timestamp).toLocaleTimeString();

            const photosHtml = item.photos.map(url => `
                <img src="${url}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;" onclick="openLightbox(this.src)">
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
            container.innerHTML += html;
        });
    }

    // Attach listener to History link
    // We need to wait for DOM or do it dynamically. The sidebar is static in HTML.
    // Let's find the history link and attach listener.
    const assessorNavLinks = document.querySelectorAll('.dashboard-layout nav a');
    assessorNavLinks.forEach(link => {
        if (link.textContent.trim() === 'History') {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                // Update active state
                assessorNavLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                showHistory();
            });
        } else if (link.textContent.trim() === 'My Tasks') {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                backToTasks();
            });
        }
    });

    // Camera State
    let currentStream = null;
    let cameraType = '';
    let capturedPhotos = [];
    let photoLimits = {
        'Theory': 2,
        'Practical': 2,
        'Viva': 1,
        'Group': 1
    };

    function startAssessment(type) {
        cameraType = type;
        capturedPhotos = [];
        openCameraModal(type);
    }

    function openCameraModal(type) {
        const modal = document.getElementById('camera-modal');
        const title = document.getElementById('camera-title');
        const counter = document.getElementById('photo-counter');

        title.textContent = `${type} Assessment`;
        counter.textContent = `0/${photoLimits[type]}`;

        modal.classList.remove('hidden');
        initCamera();
        updateGallery();
    }

    async function initCamera() {
        try {
            const constraints = {
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            const video = document.getElementById('camera-feed');

            if (video) {
                video.muted = true; // Helps with autoplay on mobile
                video.setAttribute('playsinline', ''); // Double ensure inline playback
                video.srcObject = stream;
                currentStream = stream;

                // Wait for video to be ready and play
                await video.play();
                console.log('Camera stream active');
            }
        } catch (err) {
            console.error('Camera error:', err);
            // Fallback for devices that might fail on specific constraints
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                const video = document.getElementById('camera-feed');
                if (video) {
                    video.muted = true;
                    video.srcObject = stream;
                    currentStream = stream;
                    await video.play();
                }
            } catch (fallbackErr) {
                console.error('Camera fallback error:', fallbackErr);
                alert('Unable to access camera. Please ensure you have granted camera permissions.');
                closeCamera();
            }
        }
    }

    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
    }

    function closeCamera() {
        stopCamera();
        document.getElementById('camera-modal').classList.add('hidden');
    }

    // Camera Controls
    document.getElementById('close-camera-btn').addEventListener('click', closeCamera);

    document.getElementById('capture-btn').addEventListener('click', () => {
        const limit = photoLimits[cameraType];
        if (capturedPhotos.length >= limit) return;

        const video = document.getElementById('camera-feed');
        const canvas = document.getElementById('camera-canvas');
        const context = canvas.getContext('2d');

        // Enforce 4:3 Aspect Ratio for capture
        const targetRatio = 4 / 3;
        let sourceWidth = video.videoWidth;
        let sourceHeight = video.videoHeight;
        let sourceX = 0;
        let sourceY = 0;

        // Calculate crop area to center the 4:3 frame
        if (sourceWidth / sourceHeight > targetRatio) {
            // Source is wider than 4:3 (e.g. landscape)
            const newWidth = sourceHeight * targetRatio;
            sourceX = (sourceWidth - newWidth) / 2;
            sourceWidth = newWidth;
        } else {
            // Source is taller than 4:3 (e.g. portrait)
            const newHeight = sourceWidth / targetRatio;
            sourceY = (sourceHeight - newHeight) / 2;
            sourceHeight = newHeight;
        }

        // Set canvas dimensions to 1024x768 (standard 4:3)
        canvas.width = 1024;
        canvas.height = 768;

        // Draw cropped video frame to canvas
        context.drawImage(
            video,
            sourceX, sourceY, sourceWidth, sourceHeight, // Source crop
            0, 0, 1024, 768                             // Destination fill
        );

        // Get data URL with 0.8 quality compression
        const photoUrl = canvas.toDataURL('image/jpeg', 0.8);
        capturedPhotos.push(photoUrl);

        updateGallery();
    });

    // Helper: Convert DataURL to Blob
    function dataURLtoBlob(dataurl) {
        var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
            bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
    }

    document.getElementById('submit-photos-btn').addEventListener('click', async () => {
        const submitBtn = document.getElementById('submit-photos-btn');
        const defaultText = 'Submit';

        if (capturedPhotos.length === 0) {
            alert("No photos captured!");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Preparing...';

        try {
            const batchId = loggedInUser?.batch?.batchId || 'Default';

            // 1. Upload photos in PARALLEL using Cloudinary API
            // This avoids the Firebase Storage credit card requirement
            const uploadPromises = capturedPhotos.map(async (photoData, i) => {
                // Update UI progress
                submitBtn.textContent = `Uploading ${i + 1}/${capturedPhotos.length}...`;

                const formData = new FormData();
                formData.append('file', photoData); // photoData is a Base64 JPEG string
                formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

                const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.error.message || 'Cloudinary upload failed');
                }

                const data = await response.json();
                return data.secure_url;
            });

            const uploadedUrls = await Promise.all(uploadPromises);

            submitBtn.textContent = 'Saving...';

            // 2. Save assessment metadata to Firestore
            const assessmentData = {
                batchId: batchId,
                type: cameraType,
                photos: uploadedUrls,
                timestamp: new Date().toISOString(),
                username: loggedInUser?.username || 'unknown'
            };

            await addDoc(collection(db, "assessments"), assessmentData);

            alert(`${cameraType} photos submitted successfully!`);
            closeCamera();
        } catch (err) {
            console.error("Submission Error:", err);
            alert("Error submitting photos. Please check your internet connection.\nDetails: " + err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = defaultText;
        }
    });

    function updateGallery() {
        const gallery = document.getElementById('camera-gallery');
        const counter = document.getElementById('photo-counter');
        const submitBtn = document.getElementById('submit-photos-btn');
        const captureBtn = document.getElementById('capture-btn');
        const limit = photoLimits[cameraType];

        // Update counter
        counter.textContent = `${capturedPhotos.length}/${limit}`;

        // Update buttons
        if (capturedPhotos.length >= limit) {
            captureBtn.disabled = true;
            submitBtn.disabled = false;
        } else {
            captureBtn.disabled = false;
            submitBtn.disabled = true;
        }

        // Render gallery
        gallery.innerHTML = capturedPhotos.map((photo, index) => `
            <div class="gallery-item" style="position: relative;">
                <img src="${photo}" class="gallery-thumb">
                <button onclick="deletePhoto(${index})" 
                    style="position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer;">×</button>
            </div>
        `).join('');
    }

    function deletePhoto(index) {
        capturedPhotos.splice(index, 1);
        updateGallery();
    }

    // Lightbox Logic
    function openLightbox(src) {
        const modal = document.getElementById('lightbox-modal');
        const img = document.getElementById('lightbox-img');
        img.src = src;
        modal.classList.remove('hidden');
    }

    function closeLightbox() {
        document.getElementById('lightbox-modal').classList.add('hidden');
    }

    function showView(viewElement) {
        viewElement.classList.add('active');
        // Animate in
        viewElement.style.opacity = '0';
        viewElement.style.transform = 'translateY(20px)';

        // Trigger reflow
        void viewElement.offsetWidth;

        viewElement.style.transition = 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
        viewElement.style.opacity = '1';
        viewElement.style.transform = 'translateY(0)';
    }

    function logout(e) {
        e.preventDefault();
        loggedInUser = null; // Clear session
        // Hide current active view
        const activeView = document.querySelector('.view.active:not(#login-view)');
        if (activeView) {
            activeView.style.opacity = '0';
            activeView.style.transform = 'translateY(20px)';

            setTimeout(() => {
                activeView.classList.remove('active');
                // clear styles
                activeView.style.transition = '';

                // Show login
                showView(loginView);
                // Reset form
                loginForm.reset();
                errorMsg.textContent = '';
            }, 300);
        }
    }

    function showError(msg) {
        errorMsg.textContent = msg;
        // Shake animation
        const card = document.querySelector('.login-card');
        card.style.animation = 'none';
        void card.offsetWidth; // reflow
        card.style.animation = 'shake 0.4s ease';
    }
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(styleSheet);

    // Mobile Sidebar Toggle
    window.toggleSidebar = function (id) {
        const sidebar = document.getElementById(id);
        if (sidebar) {
            sidebar.classList.toggle('mobile-active');
        }
    }

    // Close sidebar on link click (mobile)
    document.querySelectorAll('.sidebar nav a').forEach(link => {
        link.addEventListener('click', () => {
            const sidebar = link.closest('.sidebar');
            if (sidebar) {
                sidebar.classList.remove('mobile-active');
            }
        });
    });

    // Initialize all tables
    renderSscTable();
    updateGlobalSscDropdown(); // Initialize dropdown
    renderBatchTable();

    function renderAdminEvidence() {
        const container = document.getElementById('evidence-grid');
        const countDisplay = document.getElementById('evidence-count');
        const filterSsc = document.getElementById('evidence-filter-ssc');
        const filterBatch = document.getElementById('evidence-filter-batch');

        // --- Populate SSC Dropdown (only once) ---
        if (filterSsc && filterSsc.options.length === 1) {
            const sscList = sscs;
            sscList.forEach(ssc => {
                const opt = document.createElement('option');
                opt.value = ssc.name;
                opt.textContent = ssc.name;
                filterSsc.appendChild(opt);
            });

            // Add listeners using function references to allow multiple binding safety? 
            // Better to wrap in a check or use onchange property if worried about dupes.
            filterSsc.onchange = handleSscChange;
            filterBatch.onchange = renderEvidenceGrid;
        }

        // If selection exists, render grid.
        if (filterBatch.value && filterBatch.value !== "") {
            renderEvidenceGrid();
        } else {
            // Initial/Empty State
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Please select a Sector Skill Council and Batch to view evidence.</div>';
            if (countDisplay) countDisplay.textContent = '0';
        }
    }

    function handleSscChange() {
        const selectedSsc = document.getElementById('evidence-filter-ssc').value;
        const filterBatch = document.getElementById('evidence-filter-batch');
        const container = document.getElementById('evidence-grid');
        const countDisplay = document.getElementById('evidence-count');

        // Reset Batch Dropdown
        filterBatch.innerHTML = '<option value="">Select Batch</option>';
        filterBatch.disabled = true;
        container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">Please select a Batch.</div>';
        if (countDisplay) countDisplay.textContent = '0';

        if (!selectedSsc) return;

        // Fetch Batches for this SSC
        const allBatches = batches;
        const filteredBatches = allBatches.filter(b => b.ssc === selectedSsc);

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

        // Sort by timestamp desc
        evidence.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        if (countDisplay) countDisplay.textContent = evidence.length;

        if (evidence.length === 0) {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 2rem;">No evidence submitted for this batch yet.</div>';
            return;
        }

        evidence.forEach(item => {
            const date = new Date(item.timestamp).toLocaleDateString();
            const time = new Date(item.timestamp).toLocaleTimeString();

            const photosHtml = item.photos.map(url => `
                <img src="${url}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; border: 1px solid var(--glass-border); cursor: pointer;" onclick="openLightbox(this.src)">
            `).join('');

            const html = `
                <div class="glass-panel" style="padding: 1.5rem; background: rgba(255,255,255,0.03);">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                        <div>
                            <span class="badge ${item.type === 'Theory' ? 'safe' : item.type === 'Practical' ? 'warning' : 'pending'}" style="margin-bottom: 0.5rem; display: inline-block;">${item.type}</span>
                        </div>
                        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.25rem;">
                            <button onclick="deleteEvidence('${item.id}')" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; cursor: pointer; margin-bottom: 0.25rem;">Delete</button>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${date}</div>
                            <div style="font-size: 0.75rem; color: var(--text-muted);">${time}</div>
                        </div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(80px, 1fr)); gap: 0.5rem;">
                        ${photosHtml}
                    </div>
                </div>
            `;
            container.innerHTML += html;
        });
    }

    renderAssessorCredentials();

    // Word Report Generator Logic
    const wordFilterSsc = document.getElementById('word-filter-ssc');
    const wordFilterBatch = document.getElementById('word-filter-batch');
    const wordPreviewContainer = document.getElementById('word-preview-container');
    const generateWordBtn = document.getElementById('generate-word-btn');

    window.renderWordSection = function () {
        if (wordFilterSsc && wordFilterSsc.options.length === 1) {
            const sscList = sscs;
            sscList.forEach(ssc => {
                const opt = document.createElement('option');
                opt.value = ssc.name;
                opt.textContent = ssc.name;
                wordFilterSsc.appendChild(opt);
            });

            wordFilterSsc.addEventListener('change', handleWordSscChange);
            wordFilterBatch.addEventListener('change', handleWordBatchChange);

            if (generateWordBtn) {
                generateWordBtn.addEventListener('click', generateWordDoc);
            }
        }
    };

    function handleWordSscChange() {
        const selectedSsc = wordFilterSsc.value;
        wordFilterBatch.innerHTML = '<option value="">Select Batch</option>';
        wordFilterBatch.disabled = true;
        wordPreviewContainer.innerHTML = '<p>Select a Batch to generate the Evidence Report.</p>';

        if (!selectedSsc) return;

        const allBatches = batches;
        const filteredBatches = allBatches.filter(b => b.ssc === selectedSsc);

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
            wordFilterBatch.disabled = true;
        }
    }

    function handleWordBatchChange() {
        const selectedBatchId = wordFilterBatch.value;
        if (!selectedBatchId) {
            wordPreviewContainer.innerHTML = '<p>Select a Batch to generate the Evidence Report.</p>';
            return;
        }

        // Show Ready State
        wordPreviewContainer.innerHTML = `
            <div style="text-align: center;">
                <svg width="64" height="64" fill="#2563eb" viewBox="0 0 24 24" style="margin-bottom: 1rem;">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
                <h3>Ready to Generate</h3>
                <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Report for Batch: <strong>${selectedBatchId}</strong></p>
                <button id="regen-word-btn" class="action-btn primary" style="background: #2563eb; padding: 0.75rem 2rem;">
                    Download Word Document
                </button>
            </div>
        `;
        document.getElementById('regen-word-btn').addEventListener('click', generateWordDoc);
    }

    async function generateWordDoc() {
        const selectedBatchId = wordFilterBatch.value;
        if (!selectedBatchId) return;

        const allBatches = batches;
        const batch = allBatches.find(b => b.batchId === selectedBatchId);

        if (!batch) { alert('Batch data not found.'); return; }

        // Fetch Evidence Photos from Firestore
        const evidencePhotos = [];
        try {
            const q = query(collection(db, "assessments"), where("batchId", "==", selectedBatchId));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.photos && Array.isArray(data.photos)) {
                    evidencePhotos.push(...data.photos);
                }
            });
        } catch (err) {
            console.error("Error fetching photos for Word report:", err);
            alert("Error fetching photos from cloud.");
            return;
        }

        if (evidencePhotos.length === 0) {
            alert('No photos found for this batch!');
            return;
        }

        // Limit to 6 photos for the grid (or take first 6)
        const photosToUse = evidencePhotos.slice(0, 6);

        // Generate HTML for Word
        // MSO Header/Footer Implementation
        try {
            console.log('Generating Word Doc...');

            // Check Photos
            if (!evidencePhotos || evidencePhotos.length === 0) {
                alert('No evidence photos found to generate the report!');
                return;
            }

            const htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>Evidence Report</title>
                <style>
                    /* Basic Page Setup */
                    @page Section1 {
                        size: A4;
                        margin: 0.25in; /* Reduced margin to fit photos+border */
                        mso-header-margin: 0.25in; 
                        mso-footer-margin: 0.25in;
                    }
                    div.Section1 { page: Section1; }
                    
                    body { 
                        font-family: 'Calibri', 'Arial', sans-serif; 
                        font-size: 11pt;
                        margin: 0;
                        padding: 0;
                    }

                    /* Main Container Table for 6pt Page Border */
                    .main-container {
                        width: 100%;
                        border-collapse: collapse;
                        border: 6pt solid black; /* The Page Border */
                    }
                    
                    /* Header Row Styling */
                    .header-row td {
                        text-align: center;
                        padding-top: 20px;
                        padding-bottom: 20px;
                    }
                    .header-content {
                        font-weight: bold;
                        font-size: 14pt;
                        line-height: 1.2;
                    }
                    
                    /* Photo Grid Styling */
                    .photo-row td {
                        text-align: center;
                        vertical-align: middle;
                        padding: 10px;
                    }
                    
                    /* Photo Wrapper Table for 4.5pt Border */
                    .photo-wrapper {
                        display: inline-block;
                        border: 4.5pt solid black;
                    }
                </style>
            </head>
            <body>
                <div class="Section1">
                    <!-- 
                       STRATEGY: Single Outer Table Cell for Page Border.
                       Added PADDING to separate border from content.
                    -->
                    <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                        <tr>
                            <!-- 6pt Page Border with 15pt Internal Padding (Adjusted to fit 3.54in photos) -->
                            <!-- Reduced height to 900 to ensure single page -->
                            <td height="900" style="border: 6pt solid black; padding: 15pt; vertical-align: top;">
                                
                                <!-- Header -->
                                <div class="header-content" style="text-align: center; margin-bottom: 20px;">
                                    <p style="margin: 0; padding-bottom: 5px;">Name of the Skill Hub: ${batch.skillHub || 'NAC-Bhimavaram'}</p>
                                    <p style="margin: 0; padding-bottom: 5px;">Batch ID: ${batch.batchId}</p>
                                    <p style="margin: 0; padding-bottom: 5px;">Job Role: ${batch.jobRole}</p>
                                </div>

                                <!-- Photo Grid with CellSpacing for Photo Separation -->
                                <table width="100%" cellspacing="5" cellpadding="0" style="border: none;">
                                    ${generateGridRows(photosToUse)}
                                </table>

                            </td>
                        </tr>
                    </table>
                </div>
            </body>
            </html>
            `;

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

            rows += '<tr class="photo-row">';

            // Left Cell - Reduced padding
            rows += '<td style="padding: 2px; text-align: center;">';
            // Inner Table: Zero padding, collapsed border, inline-block to shrink wrap
            rows += '<table cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 4.5pt solid black; display: inline-block; margin: 0; padding: 0;"><tr><td style="padding: 0; margin: 0;">';
            rows += `<img src="${p1}" width="340" height="243" style="width:3.54in; height:2.53in; display:block; margin: 0; padding: 0;">`;
            rows += '</td></tr></table>';
            rows += '</td>';

            if (p2) {
                // Right Cell - Reduced padding
                rows += '<td style="padding: 2px; text-align: center;">';
                rows += '<table cellspacing="0" cellpadding="0" style="border-collapse: collapse; border: 4.5pt solid black; display: inline-block; margin: 0; padding: 0;"><tr><td style="padding: 0; margin: 0;">';
                rows += `<img src="${p2}" width="340" height="243" style="width:3.54in; height:2.53in; display:block; margin: 0; padding: 0;">`;
                rows += '</td></tr></table>';
                rows += '</td>';
            } else {
                rows += `<td></td>`;
            }
            rows += '</tr>';
        }
        return rows;
    }

    // --- Global Exposures for onclick handlers ---
    window.deleteSsc = async (id) => {
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
    };

    window.deleteBatch = async (id) => {
        if (confirm(`Are you sure you want to delete Batch "${id}"? This will also delete ALL associated evidence photos from the cloud.`)) {
            try {
                // 1. Find all evidence for this batch
                const q = query(collection(db, "assessments"), where("batchId", "==", id));
                const snapshot = await getDocs(q);
                const allPhotoUrls = [];
                const assessmentDocIds = [];

                snapshot.forEach(doc => {
                    assessmentDocIds.push(doc.id);
                    if (doc.data().photos) {
                        allPhotoUrls.push(...doc.data().photos);
                    }
                });

                // 2. Delete all photos from Cloudinary
                if (allPhotoUrls.length > 0) {
                    console.log(`Deleting ${allPhotoUrls.length} photos from cloud...`);
                    await fetch('/api/delete-photos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ urls: allPhotoUrls })
                    });
                }

                // 3. Delete all assessment documents from Firestore
                await Promise.all(assessmentDocIds.map(docId => deleteDoc(doc(db, "assessments", docId))));

                // 4. Delete the batch document
                await deleteDoc(doc(db, "batches", id));

                await syncData();
                renderBatchTable();
                alert(`Batch ${id} and its evidence deleted successfully.`);
            } catch (err) {
                console.error("Delete Batch Error:", err);
                alert("Failed to delete Batch or its photos.");
            }
        }
    };

    window.deleteEvidence = async (id) => {
        if (confirm('Are you sure you want to delete this evidence? This action will also remove the photos from the cloud.')) {
            try {
                // 1. Get the document first to find photo URLs
                const docRef = doc(db, "assessments", id);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data().photos) {
                    const photos = docSnap.data().photos;
                    console.log('Deleting photos from cloud:', photos);

                    // 2. Call our secure API to delete from Cloudinary
                    await fetch('/api/delete-photos', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ urls: photos })
                    });
                }

                // 3. Delete from Firestore
                await deleteDoc(docRef);
                await renderEvidenceGrid();
                console.log('Evidence deleted:', id);
            } catch (err) {
                console.error("Delete Evidence Error:", err);
                alert("Failed to delete evidence or cloud photos.");
            }
        }
    };

    window.startAssessment = startAssessment;
    window.backToTasks = backToTasks;
    window.closeLightbox = closeLightbox;
    window.openLightbox = openLightbox;
    window.deletePhoto = deletePhoto;
    window.renderWordSection = renderWordSection;
    window.goToOptions = goToOptions;
    window.showHistory = showHistory;
    window.renderAssessorTasks = renderAssessorTasks;

    console.log("ITI Assessment Portal Initialized - v4.0 [Firebase Mode]");
});
