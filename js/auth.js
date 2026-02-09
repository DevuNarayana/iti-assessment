import { state } from './state.js';
import { showView, showError } from './utils.js';
import { renderAssessorTasks } from './assessor.js';

export function validateLogin(username, password, role) {
    console.log('Login Attempt:', { username, password, role });

    const isValid = (role === 'admin') ? (username === 'admin' && password === 'admin') : false;
    if (isValid) return true;

    if (role === 'assessor') {
        if (username === 'assessor' && password === 'assessor') {
            state.loggedInUser = { role: 'assessor', username: 'assessor' };
            return true;
        }

        const batchMatch = state.batches.find(b => {
            return b.jobRole.trim() === username.trim() && b.batchId.trim() === password.trim();
        });

        if (batchMatch) {
            state.loggedInUser = { role: 'assessor', username: username, batch: batchMatch };
            return true;
        }
    }
    return false;
}

export function loginSuccess(role) {
    const loginView = document.getElementById('login-view');
    const adminView = document.getElementById('admin-view');
    const assessorView = document.getElementById('assessor-view');

    // Animation out
    loginView.style.opacity = '0';
    loginView.style.transform = 'translateY(-20px)';

    setTimeout(() => {
        loginView.classList.remove('active');
        loginView.style.opacity = '';
        loginView.style.transform = '';

        if (role === 'admin') {
            showView(adminView);
        } else {
            showView(assessorView);
            renderAssessorTasks();
            // Trigger GPS early so it's ready for photos
            requestLocation();
        }
    }, 300);
}

export function logout(e) {
    e.preventDefault();
    state.loggedInUser = null;

    const activeView = document.querySelector('.view.active:not(#login-view)');
    const loginView = document.getElementById('login-view');
    const loginForm = document.getElementById('login-form');
    const errorMsg = document.getElementById('error-message');

    if (activeView) {
        activeView.style.opacity = '0';
        activeView.style.transform = 'translateY(20px)';

        setTimeout(() => {
            activeView.classList.remove('active');
            activeView.style.transition = '';
            showView(loginView);
            if (loginForm) loginForm.reset();
            if (errorMsg) errorMsg.textContent = '';
        }, 300);
    }
}
