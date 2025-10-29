# Firebase Setup Guide - Step by Step

## Quick Start Guide

Follow these steps to set up Firebase for the Workspace Collaboration feature.

---

## Step 1: Create a Firebase Project

1. **Go to Firebase Console**
   - Visit: https://console.firebase.google.com/
   - Sign in with your Google account

2. **Create New Project**
   - Click **"Add project"** or **"Create a project"**
   - Enter a project name (e.g., "TabSync-Collab")
   - Click **"Continue"**

3. **Configure Google Analytics** (Optional)
   - You can enable or disable Google Analytics
   - Click **"Continue"**
   - Choose or create an Analytics account if enabled
   - Click **"Create project"**

4. **Wait for Project Creation**
   - This takes about 30 seconds
   - Click **"Continue"** when ready

---

## Step 2: Enable Firestore Database

1. **Open Firestore Database**
   - In the Firebase Console, click **"Firestore Database"** in the left menu
   - If you see **"Create database"**, click it

2. **Choose Security Rules**
   - Select **"Start in test mode"** (for development/testing)
   - ⚠️ **Important**: Test mode allows anyone to read/write. For production, configure proper rules.
   - Click **"Next"**

3. **Choose Location**
   - Select a location close to you (e.g., `us-central`, `europe-west`, etc.)
   - Click **"Enable"**
   - Wait for Firestore to initialize (~30 seconds)

---

## Step 3: Configure Firestore Security Rules

**For Testing/Development:**
1. Go to **Firestore Database** → **Rules** tab
2. Replace the rules with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to sync rooms for testing
    match /syncRooms/{roomId} {
      allow read, write: if true; // ⚠️ FOR TESTING ONLY
      
      match /workspace/{document=**} {
        allow read, write: if true; // ⚠️ FOR TESTING ONLY
      }
      
      match /sessions/{document=**} {
        allow read, write: if true; // ⚠️ FOR TESTING ONLY
      }
    }
  }
}
```

3. Click **"Publish"**

**⚠️ SECURITY WARNING:**
- The above rules allow **anyone** to read/write data
- Only use for **testing/development**
- For production, implement proper authentication and access control

---

## Step 4: Get Firebase Configuration

1. **Go to Project Settings**
   - Click the **gear icon** (⚙️) next to "Project Overview"
   - Select **"Project settings"**

2. **Add a Web App**
   - Scroll down to **"Your apps"** section
   - Click the **Web icon** (`</>`)

3. **Register App**
   - Enter an app nickname (e.g., "TabSync Extension")
   - **DO NOT** check "Also set up Firebase Hosting"
   - Click **"Register app"**

4. **Copy Configuration**
   - You'll see a code snippet like:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```

5. **Extract the Config Object**
   - Copy just the object part (without `const firebaseConfig =`):
   ```json
   {
     "apiKey": "AIzaSy...",
     "authDomain": "your-project.firebaseapp.com",
     "projectId": "your-project-id",
     "storageBucket": "your-project.appspot.com",
     "messagingSenderId": "123456789",
     "appId": "1:123456789:web:abcdef"
   }
   ```

---

## Step 5: Configure Extension

1. **Open the Extension**
   - Click the extension icon in Chrome
   - Go to the **"Sessions"** tab

2. **Initialize Firebase**
   - Scroll to **"🔥 Real-Time Sync (Phase 2)"** section
   - Paste your Firebase config JSON into the input field:
     ```json
     {
       "apiKey": "AIzaSy...",
       "authDomain": "your-project.firebaseapp.com",
       "projectId": "your-project-id",
       "storageBucket": "your-project.appspot.com",
       "messagingSenderId": "123456789",
       "appId": "1:123456789:web:abcdef"
     }
     ```
   - Click **"Initialize Firebase"**
   - You should see: **"Firebase initialized successfully!"**

3. **Verify Connection**
   - Status should show: **"Connected"** (green)
   - Sync controls should appear

---

## Step 6: Test Workspace Collaboration

1. **Create a Room**
   - Enter a room ID (e.g., "TEST123")
   - Click **"Create Room"**
   - You'll see: "Room created: TEST123"

2. **Create Workspace**
   - Click **"Create Workspace"**
   - A new browser window should open
   - This is your collaboration workspace

3. **Test Sync**
   - Open a few tabs in the workspace window
   - The tabs should sync to Firebase (check console for logs)

4. **Join from Another Browser** (Optional)
   - Install extension in another browser/device
   - Initialize Firebase with same config
   - Enter room ID "TEST123"
   - Click **"Join Workspace"**
   - You should see the same tabs appear!

---

## Troubleshooting

### Firebase Not Initializing

**Problem**: "Firebase initialization failed" error

**Solutions**:
- ✅ Check that all config fields are present
- ✅ Verify JSON format is correct (no trailing commas)
- ✅ Ensure Firestore is enabled in Firebase Console
- ✅ Check browser console for detailed error messages

### Firestore Permission Denied

**Problem**: "Permission denied" errors

**Solutions**:
- ✅ Check Firestore security rules are published
- ✅ Verify rules allow read/write access (for testing)
- ✅ Check Firestore is enabled in Firebase Console

### Tabs Not Syncing

**Problem**: Tabs not appearing in other users' windows

**Solutions**:
- ✅ Verify Firebase is initialized on both sides
- ✅ Check both users are in the same room
- ✅ Ensure workspace windows are open
- ✅ Check browser console for errors
- ✅ Verify network connection

### Firestore Quota Exceeded

**Problem**: "Quota exceeded" errors

**Solutions**:
- ✅ Firebase free tier has limits
- ✅ Check Firebase Console → Usage tab
- ✅ Consider upgrading to Blaze plan for production
- ✅ Reduce sync frequency (already implemented with throttling)

---

## Firebase Console Dashboard

### Useful Sections:

1. **Firestore Database**
   - View synchronized data
   - Check sync rooms and workspace state
   - Monitor document counts

2. **Usage**
   - Monitor read/write operations
   - Check quota limits
   - View billing information

3. **Project Settings**
   - Manage API keys
   - Configure domains
   - View app configurations

---

## Example Firebase Config

Here's what your config should look like:

```json
{
  "apiKey": "AIzaSyC1234567890abcdefghijklmnopqrstuvwxyz",
  "authDomain": "tabsync-collab.firebaseapp.com",
  "projectId": "tabsync-collab",
  "storageBucket": "tabsync-collab.appspot.com",
  "messagingSenderId": "123456789012",
  "appId": "1:123456789012:web:abcdefghijklmnopqrstuv"
}
```

---

## Quick Reference

### Firebase Console Links:
- **Console**: https://console.firebase.google.com/
- **Firestore**: https://console.firebase.google.com/project/_/firestore
- **Rules**: https://console.firebase.google.com/project/_/firestore/rules
- **Settings**: https://console.firebase.google.com/project/_/settings/general

### Required Fields:
- ✅ `apiKey` - API key for Firebase
- ✅ `authDomain` - Authentication domain
- ✅ `projectId` - Your project ID

### Optional Fields (for full features):
- `storageBucket` - File storage
- `messagingSenderId` - Cloud messaging
- `appId` - Application ID

---

## Security Best Practices

### For Production:

1. **Implement Authentication**
   ```javascript
   // Example: Only authenticated users can access
   match /syncRooms/{roomId} {
     allow read, write: if request.auth != null;
   }
   ```

2. **Room Access Control**
   ```javascript
   // Example: Only room members can access
   match /syncRooms/{roomId} {
     allow read, write: if request.auth != null 
       && get(/databases/$(database)/documents/syncRooms/$(roomId)).data.participants.hasAny([request.auth.uid]);
   }
   ```

3. **Rate Limiting**
   - Use Firebase Functions for rate limiting
   - Implement quotas per user
   - Monitor for abuse

4. **Data Validation**
   - Validate URLs before syncing
   - Sanitize tab titles
   - Limit tab count per room

---

## Next Steps

1. ✅ Set up Firebase project
2. ✅ Enable Firestore
3. ✅ Configure security rules
4. ✅ Get configuration JSON
5. ✅ Initialize in extension
6. ✅ Test workspace collaboration

**You're all set!** 🎉

Now you can:
- Create collaboration workspaces
- Sync tabs in real-time
- Collaborate with team members

---

## Need Help?

- **Firebase Docs**: https://firebase.google.com/docs/firestore
- **Firebase Support**: https://firebase.google.com/support
- **Extension Console**: Check browser DevTools console for logs
