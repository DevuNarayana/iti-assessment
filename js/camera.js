import { db, collection, addDoc, CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from '../firebase-config.js';
import { state } from './state.js';
import { showView } from './utils.js';

// Camera State
let currentStream = null;
let cameraType = '';
let capturedPhotos = [];
let currentGeoLocation = null;
let currentAddress = null;
let watchId = null;
let lastGeocodeTime = 0;
let isGeocoding = false;
let photoLimits = {
    'Theory': 2,
    'Practical': 2,
    'Viva': 1,
    'Group': 1
};

// Geo Helper
export function requestLocation() {
    if ("geolocation" in navigator) {
        // If already watching, don't restart (idempotent)
        if (watchId) {
            console.log("Location tracking already active.");
            // Force a UI update in case the modal just opened
            if (currentGeoLocation) updateGpsUI(true);
            return;
        }

        watchId = navigator.geolocation.watchPosition((position) => {
            currentGeoLocation = {
                lat: position.coords.latitude.toFixed(6),
                lng: position.coords.longitude.toFixed(6)
            };
            updateGpsUI(true);

            // Debounce geocoding - max once every 3 seconds
            const now = Date.now();
            if (!isGeocoding && now - lastGeocodeTime > 3000) {
                reverseGeocode(position.coords.latitude, position.coords.longitude);
            }
        }, (err) => {
            console.warn("Location error:", err);
            updateGpsUI(false);
        }, { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 });
    }
}

async function reverseGeocode(lat, lng) {
    isGeocoding = true;
    lastGeocodeTime = Date.now();

    const liveAddr = document.getElementById('live-address');
    if (liveAddr && !currentAddress) liveAddr.textContent = "Resolving address...";

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await response.json();

        if (data.address) {
            const addr = data.address;
            // Enhanced fallback logic for Indian addresses
            const town = addr.city_district || addr.suburb || addr.neighbourhood || addr.town || addr.village || addr.city || addr.county || 'Unknown Town';
            const state = addr.state || addr.region || 'Unknown State';
            currentAddress = { town, state };

            const addrOverlay = document.getElementById('address-overlay');
            if (addrOverlay && liveAddr) {
                liveAddr.textContent = `${town}, ${state}`;
                addrOverlay.classList.remove('hidden');
            }
        }
    } catch (err) {
        console.error("Reverse geocoding error:", err);
    } finally {
        isGeocoding = false;
    }
}

function updateGpsUI(isFixed) {
    const badge = document.getElementById('gps-indicator');
    const statusText = document.getElementById('gps-status-text');
    if (badge && statusText) {
        if (isFixed) {
            badge.classList.remove('searching');
            badge.classList.add('fixed');
            statusText.textContent = 'GPS Fixed';
        } else {
            badge.classList.add('searching');
            badge.classList.remove('fixed');
            statusText.textContent = 'Searching GPS...';
        }
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

    // Start or verify location request
    requestLocation();

    // Immediately show existing address if we have it
    if (currentAddress) {
        const addrOverlay = document.getElementById('address-overlay');
        const liveAddr = document.getElementById('live-address');
        if (addrOverlay && liveAddr) {
            liveAddr.textContent = `${currentAddress.town}, ${currentAddress.state}`;
            addrOverlay.classList.remove('hidden');
        }
    }

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
    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}

export function closeCamera() {
    stopCamera();
    const modal = document.getElementById('camera-modal');
    if (modal) modal.classList.add('hidden');

    // Hide GPS/Address overlays
    const badge = document.getElementById('gps-indicator');
    const addrOverlay = document.getElementById('address-overlay');
    if (badge) {
        badge.classList.add('searching');
        badge.classList.remove('fixed');
        const statusText = document.getElementById('gps-status-text');
        if (statusText) statusText.textContent = 'Searching GPS...';
    }
    if (addrOverlay) addrOverlay.classList.add('hidden');
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

        // Metadata Overlay - Multi-line style
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const timestampStr = `${dateStr}, ${timeStr}`;

        const hasAddress = currentAddress !== null;

        // Remove background box - User requested no background
        context.shadowColor = 'black';
        context.shadowBlur = 4;
        context.shadowOffsetX = 2;
        context.shadowOffsetY = 2;

        context.fillStyle = 'white';
        context.font = '700 28px "Outfit", sans-serif';
        context.textAlign = 'right';

        let startY = canvas.height - (hasAddress ? 100 : 40);
        const rightMargin = canvas.width - 40;

        // Line 1: Date & Time
        context.fillText(timestampStr, rightMargin, startY);

        if (hasAddress) {
            // Line 2: Town
            startY += 40;
            context.font = '500 24px "Outfit", sans-serif';
            context.fillText(currentAddress.town, rightMargin, startY);

            // Line 3: State
            startY += 35;
            context.fillText(currentAddress.state, rightMargin, startY);
        } else {
            // Pending State or Lat/Lng Fallback
            startY += 40;
            context.font = 'italic 20px "Outfit", sans-serif';
            if (isGeocoding) {
                context.fillText("Resolving address...", rightMargin, startY);
            } else if (currentGeoLocation) {
                context.fillText(`${currentGeoLocation.lat}, ${currentGeoLocation.lng}`, rightMargin, startY);
            }
        }

        // Reset shadow for future draws
        context.shadowBlur = 0;
        context.shadowOffsetX = 0;
        context.shadowOffsetY = 0;

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
            username: state.loggedInUser?.username || 'unknown',
            location: currentGeoLocation ? { ...currentGeoLocation, address: currentAddress } : null
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
