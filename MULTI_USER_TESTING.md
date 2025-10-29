# Multi-User Testing Guide

## Testing Real-Time Collaboration on a Single Device

You can test the multi-user workspace collaboration feature even with just one device. Here are several methods:

### Method 1: Multiple Chrome Windows (Recommended for Quick Testing)

This is the fastest way to test collaboration:

1. **Create a workspace** in Window 1:
   - Open the extension popup in your first window
   - Click "Create Workspace"
   - Enter a workspace ID (e.g., "TEST123")
   - A new window will open for the workspace

2. **Join the workspace** in Window 2:
   - Open a regular Chrome window (not the workspace window)
   - Open the extension popup in this second window
   - Click "Join Workspace"
   - Enter the same workspace ID ("TEST123")
   - This window will also show the workspace tabs

3. **Test collaboration**:
   - In Window 1 (workspace), open new tabs and navigate to websites
   - In Window 2, watch the tabs appear in real-time
   - Open tabs in Window 2 and see them appear in Window 1
   - Both windows should update within seconds

### Method 2: Use Chrome DevTools to Simulate Different Users

You can use Chrome DevTools to see real-time updates:

1. **Open the workspace** in one window
2. **Open Chrome DevTools** (F12) on a tab in that workspace
3. **Watch the Firebase updates** in real-time:
   - Go to the Network tab
   - Filter by "firestore"
   - See the requests to Firebase as tabs sync
4. **Open another window** and join the workspace
5. **Make changes** and watch the Firebase updates happen in real-time

### Method 3: Check Firebase Console Directly

See the collaboration data in Firebase:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project: `tably-cddfb`
3. Go to Firestore Database
4. Navigate to `syncRooms` → `[your-workspace-id]` → `workspace` → `state`
5. Watch the `tabs` array update in real-time as you add/remove tabs

### Method 4: Test with Network Throttling

Simulate different network conditions:

1. Open Chrome DevTools (F12)
2. Go to the Network tab
3. Click the throttling dropdown (defaults to "No throttling")
4. Select "Slow 3G" or "Fast 3G"
5. Open tabs in one workspace window
6. See how they sync to the other window with the network delay

### Method 5: Use Different Chrome Profiles

If you want to test with completely different users:

1. **Create a second Chrome profile**:
   - Click your profile icon in Chrome
   - Click "Add"
   - Create a new profile with a different name

2. **Install the extension** in the second profile:
   - In the new profile, go to `chrome://extensions`
   - Enable Developer mode
   - Load the unpacked extension

3. **Test collaboration**:
   - User 1 opens workspace from Profile 1
   - User 2 joins workspace from Profile 2
   - Both can collaborate in real-time

### What to Look For During Testing

✅ **Correct behavior:**
- Tabs appear in Firebase within 1-2 seconds
- Both windows show the same tabs
- Tab titles and URLs sync correctly
- Tab order (index) is preserved
- Removing a tab from one window removes it from both
- No duplicate tabs appear

❌ **Issues to report:**
- Tabs don't appear in Firebase
- Tabs appear but don't update in the other window
- Duplicate tabs
- Tabs disappear unexpectedly
- Console errors in the background script

### Debugging Tips

1. **Check the background script console**:
   - Go to `chrome://extensions`
   - Find "Smart Tab Organizer"
   - Click "service worker" or "background page"
   - Watch the logs for sync events

2. **Check Firebase permissions**:
   - Make sure the Firestore rules allow read/write
   - Rules should be set to allow testing (very permissive)

3. **Check the popup console**:
   - Open the extension popup
   - Right-click and select "Inspect"
   - Watch for workspace detection and sync logs

4. **Common issues**:
   - If tabs don't sync: Check if the workspace window is registered
   - If you see "Window is NOT a workspace": Make sure you opened the popup from the correct window
   - If you see Firebase errors: Check internet connection and Firebase permissions

### Expected Console Logs

When collaboration is working, you should see:

**Background script:**
```
✅ Registered workspace window [ID] for room [ROOM_ID]
📤 Syncing tab creation: [TAB_TITLE]
✅ Tab sync sent to Firebase
```

**Popup console:**
```
✅ Window [ID] is part of workspace: [ROOM_ID]
📋 Loading workspace info for [ROOM_ID]...
```

**Firebase updates:**
```
Collection: syncRooms / [ROOM_ID] / workspace / state
Field: tabs (array of tab objects)
```

### Real Device Testing

For the ultimate test, you can:
1. Connect a second device to the same WiFi network
2. Install the extension on both devices
3. Create a workspace on Device 1
4. Join the workspace on Device 2
5. Open tabs on either device and see them sync in real-time

This provides the most realistic multi-user experience!

