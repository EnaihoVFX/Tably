# Alternative Firebase Setup (If CSP Issues Persist)

If you're still getting Content Security Policy errors, here's an alternative approach:

## Option 1: Download Firebase Files Locally

1. **Download Firebase files**:
   - Download: https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js
   - Download: https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js
   - Save them in your extension folder as `firebase-app.js` and `firebase-firestore.js`

2. **Update popup.html**:
   ```html
   <script src="firebase-app.js"></script>
   <script src="firebase-firestore.js"></script>
   ```

3. **Update background.js**:
   ```javascript
   importScripts('firebase-app.js');
   importScripts('firebase-firestore.js');
   ```

## Option 2: Use Firebase v8 (More Compatible)

1. **Update popup.html**:
   ```html
   <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js"></script>
   <script src="https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js"></script>
   ```

2. **Update background.js**:
   ```javascript
   importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
   importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js');
   ```

3. **Update Firebase code** to use v8 syntax (if needed)

## Option 3: Use Firebase CDN with Different CSP

Update manifest.json:
```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self' https://www.gstatic.com https://firebaseapp.com; object-src 'self'"
  }
}
```

## Option 4: Use Firebase REST API (No SDK)

Instead of Firebase SDK, use Firebase REST API directly:

```javascript
// Example: Write to Firestore using REST API
async function writeToFirestore(collection, doc, data) {
  const url = `https://firestore.googleapis.com/v1/projects/tably-cddfb/databases/(default)/documents/${collection}/${doc}`;
  
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fields: convertToFirestoreFields(data)
    })
  });
  
  return response.json();
}
```

Try Option 1 first (downloading files locally) as it's the most reliable approach.
