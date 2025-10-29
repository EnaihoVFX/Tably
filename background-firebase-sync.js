// Background Firebase Sync Manager - Works persistently even when popup is closed
class BackgroundFirebaseSync {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.config = {
      apiKey: "AIzaSyC1EmR1SaabQ1FWaPEFuFZEJ-XdS07xoZs",
      authDomain: "tably-cddfb.firebaseapp.com",
      projectId: "tably-cddfb",
      storageBucket: "tably-cddfb.firebasestorage.app",
      messagingSenderId: "481605885317",
      appId: "1:481605885317:web:41fa8c66ac9d4ab547b8ec",
      measurementId: "G-T4Z21DJTSY"
    };
    this.userId = this.generateUserId();
    this.activeWorkspaces = new Map(); // workspaceId -> {windowId, unsubscribe}
    this.initializingWindows = new Set(); // Windows that are being initialized (don't sync during init)
  }

  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async initialize() {
    try {
      // Use Firebase REST API since we can't load SDK in background script
      this.isInitialized = true;
      console.log('✅ Background Firebase Sync initialized');
      return true;
    } catch (error) {
      console.error('❌ Background Firebase initialization failed:', error);
      return false;
    }
  }

  async syncTabToFirebase(workspaceId, tab, action) {
    try {
      if (!this.isInitialized) return;

      // Skip if this window is currently being initialized (prevent duplicate tabs on join)
      if (this.initializingWindows.has(tab.windowId)) {
        console.log('⏭️ Skipping sync during window initialization');
        return;
      }

      // Skip tabs without a URL (not fully loaded yet)
      if (!tab.url || tab.url === 'chrome://newtab/' || tab.url === 'about:newtab') {
        console.log('⏭️ Skipping tab without URL:', tab.title);
        return;
      }

      // Skip system/internal URLs
      if (tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('about:')
      ) {
        console.log('⏭️ Skipping system URL:', tab.url);
        return;
      }

      // Generate sync ID - use stable ID based on URL and title
      const baseUrl = tab.url || 'newtab';
      const title = (tab.title || '').substring(0, 20);
      const syncId = `${baseUrl}_${title}_${tab.pinned ? 'pinned' : ''}`;

      // Create safe tab data
      const safeTabData = {
        syncId: syncId,
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        pinned: tab.pinned || false,
        index: tab.index,
        groupId: tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE ? tab.groupId : null,
        action: action,
        updatedBy: this.userId,
        timestamp: Date.now()
      };

      // Use Firebase REST API to update workspace
      const url = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/(default)/documents/syncRooms/${workspaceId}/workspace/state`;
      
      // First, get current state
      const getResponse = await fetch(url);
      let tabs = [];
      
      if (getResponse.ok) {
        const data = await getResponse.json();
        if (data.fields && data.fields.tabs) {
          tabs = this.decodeFirestoreArray(data.fields.tabs);
        }
      }

      // Update tabs array
      if (action === 'created') {
        const existingIndex = tabs.findIndex(t => t.syncId === safeTabData.syncId);
        if (existingIndex === -1) {
          tabs.push(safeTabData);
        }
      } else if (action === 'updated') {
        const index = tabs.findIndex(t => t.syncId === safeTabData.syncId);
        if (index !== -1) {
          tabs[index] = safeTabData;
        } else {
          tabs.push(safeTabData);
        }
      }

      // Sort tabs by index
      tabs.sort((a, b) => a.index - b.index);

      // Update Firestore
      const updateData = {
        fields: {
          tabs: this.encodeFirestoreArray(tabs),
          lastUpdate: { timestampValue: new Date().toISOString() },
          updatedBy: { stringValue: this.userId }
        }
      };

      await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      console.log(`✅ Synced tab ${action}: ${tab.title || tab.url}`);
    } catch (error) {
      console.error('❌ Error syncing tab to Firebase:', error);
    }
  }

  async syncTabRemovalToFirebase(workspaceId, tabId) {
    try {
      if (!this.isInitialized) return;

      // Get the tab to generate syncId
      let tab;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch (e) {
        return;
      }

      if (!tab) return;

      const syncId = `${tab.url || 'newtab'}_${tab.index}`;

      const url = `https://firestore.googleapis.com/v1/projects/${this.config.projectId}/databases/(default)/documents/syncRooms/${workspaceId}/workspace/state`;
      
      const getResponse = await fetch(url);
      if (!getResponse.ok) return;

      const data = await getResponse.json();
      let tabs = [];
      
      if (data.fields && data.fields.tabs) {
        tabs = this.decodeFirestoreArray(data.fields.tabs);
      }

      tabs = tabs.filter(t => t.syncId !== syncId);

      const updateData = {
        fields: {
          tabs: this.encodeFirestoreArray(tabs),
          lastUpdate: { timestampValue: new Date().toISOString() },
          updatedBy: { stringValue: this.userId }
        }
      };

      await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      console.log(`✅ Synced tab removal: ${tab.title || tab.url}`);
    } catch (error) {
      console.error('❌ Error syncing tab removal:', error);
    }
  }

  encodeFirestoreArray(array) {
    return {
      arrayValue: {
        values: array.map(item => ({
          mapValue: {
            fields: {
              syncId: { stringValue: item.syncId || '' },
              url: { stringValue: item.url || '' },
              title: { stringValue: item.title || '' },
              pinned: { booleanValue: item.pinned || false },
              index: { integerValue: item.index || 0 }
            }
          }
        }))
      }
    };
  }

  decodeFirestoreArray(firestoreArray) {
    if (!firestoreArray.arrayValue || !firestoreArray.arrayValue.values) {
      return [];
    }
    
    return firestoreArray.arrayValue.values.map(item => {
      const fields = item.mapValue.fields;
      return {
        syncId: fields.syncId?.stringValue || '',
        url: fields.url?.stringValue || '',
        title: fields.title?.stringValue || '',
        pinned: fields.pinned?.booleanValue || false,
        index: fields.index?.integerValue || 0
      };
    });
  }

  async startWorkspaceSync(workspaceId, windowId) {
    // Store workspace info
    this.activeWorkspaces.set(workspaceId, { windowId });
    
    // Save to persistent storage
    await chrome.storage.local.set({ activeWorkspaces: Array.from(this.activeWorkspaces.entries()) });
    
    console.log(`✅ Started workspace sync for ${workspaceId} in window ${windowId}`);
  }

  async markWindowInitializing(windowId) {
    this.initializingWindows.add(windowId);
    console.log(`🔧 Marking window ${windowId} as initializing`);
  }

  async unmarkWindowInitializing(windowId) {
    this.initializingWindows.delete(windowId);
    console.log(`✅ Window ${windowId} initialization complete`);
  }

  async stopWorkspaceSync(workspaceId) {
    this.activeWorkspaces.delete(workspaceId);
    await chrome.storage.local.set({ activeWorkspaces: Array.from(this.activeWorkspaces.entries()) });
    console.log(`✅ Stopped workspace sync for ${workspaceId}`);
  }

  async loadActiveWorkspaces() {
    try {
      const result = await chrome.storage.local.get(['activeWorkspaces']);
      if (result.activeWorkspaces) {
        this.activeWorkspaces = new Map(result.activeWorkspaces);
        console.log(`📚 Loaded ${this.activeWorkspaces.size} active workspaces`);
        return true;
      }
    } catch (error) {
      console.error('Error loading active workspaces:', error);
    }
    return false;
  }
}

// Global instance
const backgroundFirebaseSync = new BackgroundFirebaseSync();

