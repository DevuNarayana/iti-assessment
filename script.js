// Version 86.0 - Modular Refactor
import { state } from './js/state.js';
import { injectStyles, showError, toggleSidebar } from './js/utils.js';
import { syncData } from './js/services.js';
import { validateLogin, loginSuccess, logout } from './js/auth.js';
import { initCameraListeners, startAssessment, closeCamera, deletePhoto, openLightbox, closeLightbox } from './js/camera.js';
import {
    updateGlobalSscDropdown,
    renderSscTable,
    renderBatchTable,
    renderAssessorCredentials,
    renderAdminEvidence,
    renderWordGenerator,
    initAdminListeners,
    deleteSsc,            // Exported for window
    deleteBatch,          // Exported for window
    deleteEvidence,       // Should be in admin, assumed created or reused
    downloadSingleQR
} from './js/admin.js';
import {
    renderAssessorTasks,
    initAssessorListeners,
    goToOptions,          // Exported for window
    backToTasks,          // Exported for window
    showHistory
} from './js/assessor.js';

// Global exports for inline HTML event handlers
window.deleteSsc = deleteSsc;
window.deleteBatch = deleteBatch;
window.startAssessment = startAssessment;
window.backToTasks = backToTasks;
window.goToOptions = goToOptions;
window.closeLightbox = closeLightbox;
window.openLightbox = openLightbox;
window.deletePhoto = deletePhoto;
window.showHistory = showHistory;
window.toggleSidebar = toggleSidebar;
window.downloadSingleQR = downloadSingleQR;

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
    // Debug Error Handler (Temporary)
    window.onerror = function (msg, url, line, col, error) {
        alert("JS Error: " + msg + "\nIn: " + url + "\nLine: " + line);
    };

    try {
        injectStyles();

        // Initialize Listeners
        initCameraListeners();
        initAdminListeners();
        initAssessorListeners();

        // Role Selection
        const roleBtns = document.querySelectorAll('.role-btn');
        roleBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                roleBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.currentRole = btn.dataset.role;

                // Toggle QR buttons visibility
                const qrLoginBtn = document.getElementById('qr-login-btn');
                const qrUploadBtn = document.getElementById('qr-upload-btn');
                if (qrLoginBtn) qrLoginBtn.style.display = state.currentRole === 'assessor' ? 'flex' : 'none';
                if (qrUploadBtn) qrUploadBtn.style.display = state.currentRole === 'assessor' ? 'flex' : 'none';

                document.getElementById('username').focus();
                const errorMsg = document.getElementById('error-message');
                if (errorMsg) errorMsg.textContent = '';
            });
        });

        // Login Handler
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const username = document.getElementById('username').value.trim();
                const password = document.getElementById('password').value.trim();

                if (validateLogin(username, password, state.currentRole)) {
                    loginSuccess(state.currentRole);
                } else {
                    let msg = 'Invalid credentials.';
                    if (state.currentRole === 'admin') msg = 'Invalid Admin credentials. Try admin/admin.';
                    if (state.currentRole === 'assessor') msg = 'Invalid Assessor credentials. Use Job Role as Username and Batch ID as Password.';
                    showError(msg);
                }
            });
        }

        // Logout Handlers
        document.getElementById('logout-admin')?.addEventListener('click', logout);
        document.getElementById('logout-assessor')?.addEventListener('click', logout);

        // Initial Data Sync
        await syncData();

        // Initial Render
        renderSscTable();
        updateGlobalSscDropdown();
        renderBatchTable();
        // renderAssessorCredentials(); // if needed immediately

        // Admin Sidebar Navigation
        const navLinks = document.querySelectorAll('.nav-link');
        const adminSections = document.querySelectorAll('.admin-section');

        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                navLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                adminSections.forEach(section => section.classList.remove('active'));

                const targetId = link.dataset.section;
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.classList.add('active');

                    // Trigger specific renders
                    if (targetId === 'batches-section') renderBatchTable();
                    if (targetId === 'assessors-section') renderAssessorCredentials(); // Ensure this is exported/imported if used
                    if (targetId === 'ssc-section') renderSscTable();
                    if (targetId === 'evidence-section') renderAdminEvidence();
                    if (targetId === 'word-section') renderWordGenerator();
                }
            });
        });

        // Initialize QR Scanner
        let html5QrCode = null;
        const qrLoginBtn = document.getElementById('qr-login-btn');
        const scannerModal = document.getElementById('qr-scanner-modal');
        const cancelQrBtn = document.getElementById('cancel-qr-btn');

        const stopScanner = async () => {
            if (html5QrCode && html5QrCode.isScanning) {
                await html5QrCode.stop();
                await html5QrCode.clear();
            }
            scannerModal.classList.add('hidden');
        };

        qrLoginBtn?.addEventListener('click', () => {
            scannerModal.classList.remove('hidden');
            html5QrCode = new Html5Qrcode("qr-reader");

            const config = { fps: 10, qrbox: { width: 250, height: 250 } };

            html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => {
                    try {
                        const data = JSON.parse(decodedText);
                        if (data.u && data.p) {
                            // Auto-login logic
                            document.getElementById('username').value = data.u;
                            document.getElementById('password').value = data.p;

                            // Ensure role is assessor
                            roleBtns.forEach(b => b.classList.remove('active'));
                            const assessorBtn = document.querySelector('.role-btn[data-role="assessor"]');
                            if (assessorBtn) {
                                assessorBtn.classList.add('active');
                                state.currentRole = 'assessor';
                            }

                            stopScanner();

                            // Trigger form submission
                            const loginForm = document.getElementById('login-form');
                            if (loginForm) loginForm.dispatchEvent(new Event('submit'));
                        }
                    } catch (err) {
                        console.error("QR Code Error:", err);
                    }
                },
                (errorMessage) => {
                    // console.log("QR Scan Error:", errorMessage);
                }
            ).catch((err) => {
                console.error("Flash/Init Error:", err);
                alert("Camera access failed or another error occurred.");
                stopScanner();
            });
        });

        cancelQrBtn?.addEventListener('click', stopScanner);

        // QR Upload Login
        const qrUploadBtn = document.getElementById('qr-upload-btn');
        const qrInput = document.getElementById('qr-input');

        qrUploadBtn?.addEventListener('click', () => qrInput.click());

        qrInput?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const tempScanner = new Html5Qrcode("qr-reader");
            try {
                const decodedText = await tempScanner.scanFile(file, true);
                const data = JSON.parse(decodedText);
                if (data.u && data.p) {
                    document.getElementById('username').value = data.u;
                    document.getElementById('password').value = data.p;

                    roleBtns.forEach(b => b.classList.remove('active'));
                    const assessorBtn = document.querySelector('.role-btn[data-role="assessor"]');
                    if (assessorBtn) {
                        assessorBtn.classList.add('active');
                        state.currentRole = 'assessor';
                    }

                    const loginForm = document.getElementById('login-form');
                    if (loginForm) loginForm.dispatchEvent(new Event('submit'));
                }
            } catch (err) {
                console.error("QR Upload Error:", err);
                showError("Invalid QR code image. Please upload a clear photo of the Batch QR.");
            } finally {
                e.target.value = '';
            }
        });

        console.log("ITI Assessment Portal Initialized - Modular V1");
    } catch (e) {
        console.error("Initialization Error:", e);
        alert("Init Error: " + e.message);
    }
});
