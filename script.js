// Version 56.0 - Modular Refactor
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
    initAdminListeners,
    deleteSsc,            // Exported for window
    deleteBatch,          // Exported for window
    deleteEvidence        // Should be in admin, assumed created or reused
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

// Initialize App
document.addEventListener('DOMContentLoaded', async () => {
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
            }
        });
    });

    console.log("ITI Assessment Portal Initialized - Modular V1");
});
