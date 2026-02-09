# Security Hardening Guide 🔒

## Overview
This application is a **Client-Side SPA (Single Page Application)**.
This means all code, including API keys, is visible to anyone who inspects the website source.

**You cannot "hide" keys in a client-side app.**
Instead, you must restrict **WHAT** those keys can do.

---

## 1. Cloudinary Security (Critical) ☁️
To prevent unauthorized users from uploading junk or deleting your photos:

1.  Go to [Cloudinary Settings > Upload](https://cloudinary.com/console/settings/upload).
2.  Find your **Upload Preset** (`g5bnz7sq` in your config).
3.  **Edit the Preset**:
    -   **Mode**: Ensure it is "Unsigned".
    -   **Incoming Transformations**: Limit the size/format if possible.
    -   **Add-ons**: You can enable "Moderation" to block explicit content.
4.  **Strict Mode (Recommended)**:
    -   Create a signed upload preset instead (requires a backend server).
    -   *Current Setup:* Since we don't have a backend server, we rely on the Unsigned preset.
    -   **Risk**: Anyone with your Cloud Name + Preset can upload photos to your account.
    -   **Mitigation**: Monitor your usage in the dashboard. If you see spikes, regenerate the preset name.

---

## 2. Firebase Security Rules (Critical) 🔥
Go to [Firebase Console > Firestore Database > Rules](https://console.firebase.google.com/).

### Recommended Rules
Replace your current rules with these to ensure only your app (and authorized users) can write data.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Allow anyone to READ (needed for login validation/viewing)
    // You can tighten this if you implement Firebase Auth later.
    match /{document=**} {
      allow read: if true;
    }

    // restrict WRITE access
    // Only allow creating assessments if the data has the correct shape
    match /assessments/{assessmentId} {
      allow create: if request.resource.data.keys().hasAll(['batchId', 'photos', 'timestamp', 'type']);
      // Prevent deleting unless you are an admin (requires implementing Auth)
      // For now, allow delete if you are testing, but turn off in production
      allow delete: if true; 
    }
    
    // Protect SSC and Batches from being modified by public
    match /sscs/{sscId} {
       allow write: if false; // Only allow manual edits in Console or Authenticated Admin
    }
     match /batches/{batchId} {
       allow write: if false;
    }
  }
}
```

## 3. API Key Restrictions (Google Cloud) 🔑
1.  Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials).
2.  Find the API Key used in `FIREBASE_CONFIG`.
3.  **Edit API Key**:
    -   **Application Restrictions**: Select **HTTP Referrers (Websites)**.
    -   Add your Vercel domain: `https://kptech-portal.vercel.app/*`
    -   Add localhost for testing: `http://localhost:*`
4.  **Save**.
    -   Now, even if someone steals your key, they cannot use it from their own website/server.

---

## 4. Best Practices
-   **Never commit `js/config.js`** to a public GitHub repo if you can avoid it.
-   Add `js/config.js` to `.gitignore` and manually set up environment variables if you move to a build process (like Vite/Next.js) in the future.
