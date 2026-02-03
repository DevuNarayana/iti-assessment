// Utility Functions

export function showView(viewElement) {
    if (!viewElement) return;

    // Hide all other views first specifically if needed (optional based on existing css)
    document.querySelectorAll('.view').forEach(v => {
        if (v !== viewElement) v.classList.remove('active');
    });

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

export function showError(msg) {
    const errorMsg = document.getElementById('error-message');
    if (errorMsg) errorMsg.textContent = msg;

    // Shake animation
    const card = document.querySelector('.login-card');
    if (card) {
        card.style.animation = 'none';
        void card.offsetWidth; // reflow
        card.style.animation = 'shake 0.4s ease';
    }
}

export function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
}

export function injectStyles() {
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
        }
    `;
    document.head.appendChild(styleSheet);
}

// Mobile Sidebar Toggle
export function toggleSidebar(id) {
    const sidebar = document.getElementById(id);
    if (sidebar) {
        sidebar.classList.toggle('mobile-active');
    }
}
