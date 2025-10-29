# Firebase Connection Debugging Guide

## Check Firestore is Enabled

1. Go to https://console.firebase.google.com/project/tably-cddfb/firestore
2. Make sure Firestore Database is enabled
3. Check if "Native mode" or "Datastore mode" is selected (should be Native mode)

## Check Security Rules

Go to Firestore → Rules and make sure you have:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to sync rooms
    match /syncRooms/{roomId} {
      allow read, write: if true; // For testing - restrict in production!
      
      match /workspace/{document=**} {
        allow read, write: if true; // For testing - restrict in production!
      }
    }
    
    // Allow test collection
    match /_test/{document=**} {
      allow read, write: if true; // For testing
    }
  }
}
```

## Test Connection Manually

Open browser console in popup and run:

```javascript
// Check if Firebase SDK loaded
console.log('Firebase:', typeof firebase !== 'undefined' ? 'Loaded' : 'NOT LOADED');

// Check Firebase version
if (typeof firebase !== 'undefined') {
  console.log('SDK Version:', firebase.SDK_VERSION);
  console.log('Apps:', firebase.apps);
}

// Try manual initialization
const config = {
  apiKey: "AIzaSyC1EmR1SaabQ1FWaPEFuFZEJ-XdS07xoZs",
  authDomain: "tably-cddfb.firebaseapp.com",
  projectId: "tably-cddfb",
  storageBucket: "tably-cddfb.firebasestorage.app",
  messagingSenderId: "481605885317",
  appId: "1:481605885317:web:41fa8c66ac9d4ab547b8ec",
  measurementId: "G-T4Z21DJTSY"
};

try {
  firebase.initializeApp(config);
  const db = firebase.firestore();
  console.log('✅ Firebase initialized');
  
  // Test read
  db.collection('_test').doc('connection').get().then(doc => {
    console.log('✅ Read test:', doc.exists ? 'exists' : 'not found');
  }).catch(err => console.error('❌ Read error:', err));
  
  // Test write
  db.collection('_test').doc('connection').set({ test: true }).then(() => {
    console.log('✅ Write test successful');
  }).catch(err => console.error('❌ Write error:', err));
} catch (error) {
  console.error('❌ Initialization error:', error);
}
```

## Common Issues

1. **Firestore not enabled**: Enable it in Firebase Console
2. **Security rules too restrictive**: Use the rules above for testing
3. **Wrong project ID**: Make sure projectId matches your Firebase project
4. **CORS issues**: Shouldn't happen with Chrome extensions, but check network tab

