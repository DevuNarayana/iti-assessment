import { db, collection, addDoc, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '../firebase-config.js';
import { state } from './state.js';
import { showView } from './utils.js';

// Camera State
let currentStream = null;
let cameraType = '';
let capturedPhotos = [];
let currentGeoLocation = null;
let photoLimits = {
    'Theory': 2,
    'Practical': 2,
    'Viva': 1,
    'Group': 1
};

// Geo Helper
export function requestLocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            currentGeoLocation = {
                lat: position.coords.latitude.toFixed(6),
                lng: position.coords.longitude.toFixed(6)
            };
        }, (err) => {
            console.warn("Location error:", err);
            currentGeoLocation = null;
        }, { enableHighAccuracy: true });
    }
}

export function startAssessment(type) {
    cameraType = type;
    capturedPhotos = [];
    openCameraModal(type);
}

export function openCameraModal(type) {
    const modal = document.getElementById('camera-modal');
    const title = document.getElementById('camera-title');
    const counter = document.getElementById('photo-counter');

    if (title) title.textContent = `${type} Assessment`;
    if (counter) counter.textContent = `0/${photoLimits[type]}`;

    requestLocation();
    if (modal) modal.classList.remove('hidden');
    initCamera();
    updateGallery();
}

export async function initCamera() {
    stopCamera();

    try {
        const constraints = {
            video: { facingMode: 'environment' },
            audio: false
        };

        console.log('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const video = document.getElementById('camera-feed');

        if (video) {
            video.srcObject = stream;
            currentStream = stream;
            video.muted = true;
            video.setAttribute('playsinline', '');

            video.onloadedmetadata = () => {
                video.play().catch(e => console.error("Video play failed:", e));
            };
        }
    } catch (err) {
        console.error('Primary Camera Error:', err);
        // Fallback
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            const video = document.getElementById('camera-feed');
            if (video) {
                video.muted = true;
                video.srcObject = stream;
                currentStream = stream;
                video.play();
            }
        } catch (fallbackErr) {
            console.error('Full Camera Failure:', fallbackErr);
            alert('Unable to access camera.');
            closeCamera();
        }
    }
}

export function stopCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
}

export function closeCamera() {
    stopCamera();
    const modal = document.getElementById('camera-modal');
    if (modal) modal.classList.add('hidden');
}

export function initCameraListeners() {
    document.getElementById('close-camera-btn')?.addEventListener('click', closeCamera);

    document.getElementById('capture-btn')?.addEventListener('click', () => {
        const limit = photoLimits[cameraType];
        if (capturedPhotos.length >= limit) return;

        const video = document.getElementById('camera-feed');
        const canvas = document.getElementById('camera-canvas');
        const context = canvas.getContext('2d');

        const targetRatio = 4 / 3;
        let sourceWidth = video.videoWidth;
        let sourceHeight = video.videoHeight;
        let sourceX = 0;
        let sourceY = 0;

        if (sourceWidth / sourceHeight > targetRatio) {
            const newWidth = sourceHeight * targetRatio;
            sourceX = (sourceWidth - newWidth) / 2;
            sourceWidth = newWidth;
        } else {
            const newHeight = sourceWidth / targetRatio;
            sourceY = (sourceHeight - newHeight) / 2;
            sourceHeight = newHeight;
        }

        canvas.width = 1024;
        canvas.height = 768;

        context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 1024, 768);

        // Metadata Overlay
        const now = new Date();
        const timestampStr = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString('en-GB');

        const barHeight = 40;
        context.fillStyle = 'rgba(0, 0, 0, 0.6)';
        context.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);

        context.fillStyle = 'white';
        context.font = '20px Outfit, Calibri, Arial, sans-serif';
        context.textAlign = 'left';

        let overlayText = timestampStr;
        if (currentGeoLocation) {
            overlayText += ` | GPS: ${currentGeoLocation.lat}, ${currentGeoLocation.lng}`;
        }
        context.fillText(overlayText, 20, canvas.height - 12);

        const photoUrl = canvas.toDataURL('image/jpeg', 0.8);
        capturedPhotos.push(photoUrl);
        updateGallery();
    });

    document.getElementById('submit-photos-btn')?.addEventListener('click', submitPhotos);
}

// Separate function for submit logic
async function submitPhotos() {
    const submitBtn = document.getElementById('submit-photos-btn');
    const defaultText = 'Submit';

    if (capturedPhotos.length === 0) {
        alert("No photos captured!");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Preparing...';

    try {
        const batchId = state.loggedInUser?.batch?.batchId || 'Default';

        const uploadPromises = capturedPhotos.map(async (photoData, i) => {
            submitBtn.textContent = `Uploading ${i + 1}/${capturedPhotos.length}...`;
            const formData = new FormData();
            formData.append('file', photoData);
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

        const assessmentData = {
            batchId: batchId,
            type: cameraType,
            photos: uploadedUrls,
            timestamp: new Date().toISOString(),
            username: state.loggedInUser?.username || 'unknown'
        };

        await addDoc(collection(db, "assessments"), assessmentData);

        alert(`${cameraType} photos submitted successfully!`);
        closeCamera();
    } catch (err) {
        console.error("Submission Error:", err);
        alert("Error submitting photos: " + err.message);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = defaultText;
    }
}

function updateGallery() {
    const gallery = document.getElementById('camera-gallery');
    const counter = document.getElementById('photo-counter');
    const submitBtn = document.getElementById('submit-photos-btn');
    const captureBtn = document.getElementById('capture-btn');
    const limit = photoLimits[cameraType];

    if (counter) counter.textContent = `${capturedPhotos.length}/${limit}`;

    if (capturedPhotos.length >= limit) {
        if (captureBtn) captureBtn.disabled = true;
        if (submitBtn) submitBtn.disabled = false;
    } else {
        if (captureBtn) captureBtn.disabled = false;
        if (submitBtn) submitBtn.disabled = true;
    }

    if (gallery) {
        gallery.innerHTML = capturedPhotos.map((photo, index) => `
            <div class="gallery-item" style="position: relative;">
                <img src="${photo}" class="gallery-thumb">
                <button data-index="${index}" class="delete-photo-btn"
                    style="position: absolute; top: -5px; right: -5px; background: red; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; font-size: 12px; cursor: pointer;">×</button>
            </div>
        `).join('');

        // Re-attach listeners for dynamic delete buttons
        document.querySelectorAll('.delete-photo-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.index);
                deletePhoto(idx);
            });
        });
    }
}

export function deletePhoto(index) {
    capturedPhotos.splice(index, 1);
    updateGallery();
}

// Lightbox
export function openLightbox(src) {
    const modal = document.getElementById('lightbox-modal');
    const img = document.getElementById('lightbox-img');
    if (img) img.src = src;
    if (modal) modal.classList.remove('hidden');
}

export function closeLightbox() {
    const modal = document.getElementById('lightbox-modal');
    if (modal) modal.classList.add('hidden');
}
