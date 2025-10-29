// Firebase operations handled in popup context
class PopupFirebaseHandler {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.config = null;
    this.userId = this.generateUserId();
    this.workspaceWindows = new Map(); // roomId -> windowId
  }

  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async initialize(config) {
    try {
      console.log('🔥 Initializing Firebase in popup...');
      console.log('📋 Config:', { apiKey: config?.apiKey?.substring(0, 10) + '...', projectId: config?.projectId });
      
      if (typeof firebase === 'undefined') {
        console.error('⚠️ Firebase SDK not loaded in popup');
        return false;
      }

      if (!config || !config.apiKey || !config.authDomain || !config.projectId) {
        console.error('⚠️ Firebase config not provided:', config);
        return false;
      }

      // Check if Firebase is already initialized
      try {
        if (firebase.apps && firebase.apps.length > 0) {
          console.log('✅ Firebase already initialized');
          // Use existing app
          const app = firebase.app();
          this.db = firebase.firestore(app);
          this.config = config;
          this.isInitialized = true;
          
          // Test connection (non-blocking)
          this.testConnection().catch(error => {
            console.error('Connection test error (non-blocking):', error);
          });
          
          return true;
        }
      } catch (e) {
        console.log('⚠️ Error checking existing apps:', e);
        // Apps might not be available, continue with initialization
      }

      // Initialize Firebase
      try {
        firebase.initializeApp(config);
        console.log('✅ Firebase app initialized');
      } catch (error) {
        // App might already be initialized with different name
        if (error.code === 'app/duplicate-app') {
          console.log('⚠️ Firebase app already initialized, using existing');
          const app = firebase.app();
          this.db = firebase.firestore(app);
          this.config = config;
          this.isInitialized = true;
          
          // Test connection (non-blocking)
          this.testConnection().catch(error => {
            console.error('Connection test error (non-blocking):', error);
          });
          
          return true;
        }
        console.error('❌ Error initializing Firebase app:', error);
        throw error;
      }

      // Initialize Firestore
      this.db = firebase.firestore();
      this.config = config;
      this.isInitialized = true;
      
      console.log('✅ Firebase initialized in popup');
      
      // Test connection (non-blocking - don't fail init if test fails)
      this.testConnection().catch(error => {
        console.error('Connection test error (non-blocking):', error);
      });
      
      return true;
    } catch (error) {
      console.error('❌ Firebase initialization failed in popup:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      return false;
    }
  }

  async testConnection() {
    try {
      console.log('🧪 Testing Firebase connection...');
      console.log('📋 DB instance:', this.db ? 'exists' : 'null');
      
      if (!this.db) {
        console.error('❌ Firestore DB instance is null');
        return false;
      }
      
      // Try to read from a test collection (with shorter timeout)
      const testPromise = this.db.collection('_test').doc('connection').get();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Connection test timeout')), 5000);
      });
      
      const testDoc = await Promise.race([testPromise, timeoutPromise]);
      console.log('✅ Firebase connection test successful - read works');
      
      // Also try to write (will fail if permissions are wrong, but will test connection)
      try {
        const writePromise = this.db.collection('_test').doc('connection').set({
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          test: true,
          userId: this.userId
        }, { merge: true });
        const writeTimeout = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Write test timeout')), 5000);
        });
        
        await Promise.race([writePromise, writeTimeout]);
        console.log('✅ Firebase write test successful');
      } catch (writeError) {
        console.log('⚠️ Firebase write test failed (might be permissions):', writeError.message);
        // Don't fail the test if write fails, read is enough to confirm connection
      }
      
      return true;
    } catch (error) {
      console.error('❌ Firebase connection test failed:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack?.substring(0, 500)
      });
      
      // If it's a permission error, try a simpler test
      if (error.code === 'permission-denied' || error.message.includes('permission')) {
        console.log('🔄 Trying simpler connection test...');
        try {
          // Just try to access the database without reading/writing
          const simpleTest = this.db.collection('_test').limit(1);
          await simpleTest.get();
          console.log('✅ Simple connection test successful');
          return true;
        } catch (simpleError) {
          console.error('❌ Simple connection test also failed:', simpleError);
        }
      }
      
      return false;
    }
  }

  async createSyncRoom(sessionName) {
    try {
      if (!this.isInitialized || !this.db) {
        return { success: false, error: 'Firebase not initialized' };
      }

      // Generate a unique room ID
      const roomId = this.generateRoomId();

      // Create room document
      await this.db.collection('syncRooms').doc(roomId).set({
        sessionName: sessionName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        owner: 'user',
        participants: ['user'],
        isActive: true
      });

      console.log(`✅ Created sync room: ${roomId}`);
      return { success: true, roomId: roomId };
    } catch (error) {
      console.error('❌ Error creating sync room:', error);
      return { success: false, error: error.message };
    }
  }

  async createCollaborationWorkspace(roomId) {
    try {
      if (!this.isInitialized || !this.db) {
        return { success: false, error: 'Firebase not initialized' };
      }

      console.log(`🏗️ Creating workspace for room ${roomId}...`);

      // Create a new window for collaboration
      const window = await chrome.windows.create({
        type: 'normal',
        focused: true
      });

      console.log(`✅ Created window ${window.id} for workspace`);

      // Ensure the syncRoom document exists first
      const roomRef = this.db.collection('syncRooms').doc(roomId);
      const roomDoc = await roomRef.get();
      
      if (!roomDoc.exists) {
        console.log(`📝 Creating syncRoom document for ${roomId}...`);
        await roomRef.set({
          sessionName: `Workspace ${roomId}`,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          owner: 'user',
          participants: ['user'],
          isActive: true
        });
        console.log(`✅ Created syncRoom document for ${roomId}`);
      }

      // Initialize workspace state in Firebase
      const workspaceStateRef = roomRef.collection('workspace').doc('state');
      console.log(`📝 Creating workspace state document...`);
      
      try {
        await workspaceStateRef.set({
          windowId: window.id,
          tabs: [],
          lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: this.userId
        });
        console.log(`✅ Created workspace state document for ${roomId}`);
        
        // Verify it was created
        const verifyDoc = await workspaceStateRef.get();
        if (verifyDoc.exists) {
          console.log(`✅ Verified workspace state document exists`);
        } else {
          console.error(`❌ Workspace state document was not created!`);
        }
      } catch (setError) {
        console.error(`❌ Error setting workspace state:`, setError);
        throw setError;
      }

      // Start listening to workspace changes
      this.startWorkspaceSync(roomId, window.id);

      // Register this window for tab sync
      console.log(`📤 Sending registerWorkspaceWindow message: roomId=${roomId}, windowId=${window.id}`);
      const registerResponse = await chrome.runtime.sendMessage({
        action: 'registerWorkspaceWindow',
        roomId: roomId,
        windowId: window.id
      });
      console.log(`📥 Received registerWorkspaceWindow response:`, registerResponse);

      console.log(`✅ Created collaboration workspace for room ${roomId} in window ${window.id}`);
      return { success: true, windowId: window.id };
    } catch (error) {
      console.error('❌ Error creating workspace:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack?.substring(0, 500)
      });
      return { success: false, error: error.message };
    }
  }

  async joinCollaborationWorkspace(roomId) {
    try {
      if (!this.isInitialized || !this.db) {
        return { success: false, error: 'Firebase not initialized' };
      }

      // Check if workspace exists
      const roomDoc = await this.db.collection('syncRooms').doc(roomId).get();
      try {
        const roomData = roomDoc.data();
        if (!roomData) {
          return { success: false, error: 'Workspace not found. Create a workspace first.' };
        }
      } catch (e) {
        return { success: false, error: 'Workspace not found. Create a workspace first.' };
      }

      // Create a new window for this user
      const window = await chrome.windows.create({
        type: 'normal',
        focused: true
      });

      // Make sure workspace state exists (create if joining first workspace)
      const workspaceStateRef = this.db.collection('syncRooms')
        .doc(roomId)
        .collection('workspace')
        .doc('state');
      
      const workspaceDoc = await workspaceStateRef.get();
      if (!workspaceDoc.exists) {
        console.log(`📝 Creating initial workspace state for ${roomId}...`);
        await workspaceStateRef.set({
          windowId: window.id,
          tabs: [],
          lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: this.userId
        });
      }

      // Mark window as initializing to prevent duplicate tab sync
      await chrome.runtime.sendMessage({
        action: 'markWindowInitializing',
        windowId: window.id
      });

      // Start listening to workspace changes
      this.startWorkspaceSync(roomId, window.id);

      // Register this window for tab sync
      await chrome.runtime.sendMessage({
        action: 'registerWorkspaceWindow',
        roomId: roomId,
        windowId: window.id
      });

      // Initial sync - load existing tabs from workspace
      const workspaceDocCheck = await workspaceStateRef.get();
      
      try {
        const workspaceData = workspaceDocCheck.exists ? workspaceDocCheck.data() : null;
        if (workspaceData && workspaceData.tabs && workspaceData.tabs.length > 0) {
          console.log(`📥 Loading ${workspaceData.tabs.length} existing tabs into workspace window...`);
          await this.syncTabsToWindow(workspaceData.tabs, window.id);
        }
      } catch (e) {
        // Document might not exist yet, that's okay
      }

      // Wait a bit for tabs to finish loading, then unmark as initializing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      await chrome.runtime.sendMessage({
        action: 'unmarkWindowInitializing',
        windowId: window.id
      });
      
      console.log('✅ Workspace window fully initialized');

      console.log(`✅ Joined collaboration workspace for room ${roomId} in window ${window.id}`);
      return { success: true, windowId: window.id };
    } catch (error) {
      console.error('❌ Error joining workspace:', error);
      return { success: false, error: error.message };
    }
  }

  async startWorkspaceSync(roomId, windowId) {
    try {
      let lastTabCount = 0;
      let syncDebounce = null;
      
      // Listen to workspace state changes
      this.db.collection('syncRooms')
        .doc(roomId)
        .collection('workspace')
        .doc('state')
        .onSnapshot(async (doc) => {
          if (!doc) return;
          
          try {
            const workspaceData = doc.data();
            if (!workspaceData) return;
            
            // Skip if this update came from us (prevent loops)
            if (workspaceData.updatedBy === this.userId) {
              console.log('⏭️ Skipping sync from own update');
              return;
            }

            const tabs = workspaceData.tabs || [];
            const tabCount = tabs.length;
            
            // Only sync if there are tabs and count has actually changed
            if (tabCount === 0 || tabCount === lastTabCount) {
              console.log('⏭️ Skipping sync - no tabs or count unchanged');
              return;
            }

            lastTabCount = tabCount;

            // Debounce rapid changes
            if (syncDebounce) {
              clearTimeout(syncDebounce);
            }
            
            syncDebounce = setTimeout(async () => {
              console.log(`🔄 Syncing ${tabs.length} tabs to window ${windowId} from ${workspaceData.updatedBy}`);
              console.log(`Current userId: ${this.userId}, updatedBy: ${workspaceData.updatedBy}`);
              
              // Don't sync if the update came from us
              if (workspaceData.updatedBy !== this.userId) {
                await this.syncTabsToWindow(tabs, windowId);
              } else {
                console.log('⏭️ Skipping sync to our own window');
              }
            }, 500);

          } catch (error) {
            console.error('Error processing workspace snapshot:', error);
          }
        }, (error) => {
          console.error('❌ Workspace sync listener error:', error);
        });

      console.log(`✅ Started workspace sync for room ${roomId} in window ${windowId}`);
    } catch (error) {
      console.error('❌ Error starting workspace sync:', error);
    }
  }

  async syncTabsToWindow(tabsData, windowId) {
    try {
      // Get current tabs in window
      const currentTabs = await chrome.tabs.query({ windowId: windowId });
      const currentSyncIds = new Set(currentTabs.map(t => this.generateTabSyncId(t)));
      const syncedSyncIds = new Set(tabsData.map(t => t.syncId));

      console.log(`📊 Syncing tabs: current=${currentTabs.length}, Firebase=${tabsData.length}`);
      console.log('Current sync IDs:', Array.from(currentSyncIds));
      console.log('Firebase sync IDs:', Array.from(syncedSyncIds));

      // Create tabs that don't exist
      let createdCount = 0;
      for (const tabData of tabsData) {
        if (!currentSyncIds.has(tabData.syncId)) {
          // Check if URL is valid and not sensitive
          if (tabData.url && 
              !tabData.url.startsWith('chrome://') && 
              !tabData.url.startsWith('chrome-extension://') &&
              !tabData.url.startsWith('about:')) {
            try {
              console.log(`➕ Creating new tab: ${tabData.url}`);
              await chrome.tabs.create({
                windowId: windowId,
                url: tabData.url,
                active: false,
                pinned: tabData.pinned || false,
                index: tabData.index !== undefined ? tabData.index : -1
              });
              createdCount++;
            } catch (error) {
              console.error(`Failed to create tab: ${tabData.url}`, error);
            }
          }
        }
      }
      
      console.log(`✅ Created ${createdCount} new tabs`);

      // Remove tabs that were deleted (but keep pinned tabs)
      for (const currentTab of currentTabs) {
        const syncId = this.generateTabSyncId(currentTab);
        if (!syncedSyncIds.has(syncId) && !currentTab.pinned) {
          try {
            await chrome.tabs.remove(currentTab.id);
          } catch (error) {
            console.error(`Failed to remove tab ${currentTab.id}:`, error);
          }
        }
      }

      console.log(`✅ Synced ${tabsData.length} tabs to window ${windowId}`);
    } catch (error) {
      console.error('❌ Error syncing tabs to window:', error);
    }
  }

  generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let roomId = '';
    for (let i = 0; i < 6; i++) {
      roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return roomId;
  }

  generateTabSyncId(tab) {
    // Use a more stable ID that doesn't depend on index (which can change)
    // Base it on URL and title instead
    const baseUrl = tab.url || 'newtab';
    const title = (tab.title || '').substring(0, 20);
    return `${baseUrl}_${title}_${tab.pinned ? 'pinned' : ''}`;
  }

  async syncTabToFirebase(roomId, tab, action) {
    try {
      if (!this.isInitialized || !this.db) {
        return;
      }

      // Skip system/internal URLs
      if (tab.url && (
        tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')
      )) {
        return;
      }

      // Create safe tab data (no sensitive information)
      const safeTabData = {
        syncId: this.generateTabSyncId(tab),
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

      // Update workspace state
      const workspaceRef = this.db.collection('syncRooms').doc(roomId).collection('workspace').doc('state');
      const workspaceDoc = await workspaceRef.get();
      
      let tabs = [];
      try {
        const docData = workspaceDoc.data();
        if (docData) {
          tabs = docData.tabs || [];
        }
      } catch (e) {
        // Document doesn't exist yet, start with empty tabs
      }

      if (action === 'created') {
        // Add new tab (check if it doesn't already exist)
        const existingIndex = tabs.findIndex(t => t.syncId === safeTabData.syncId);
        if (existingIndex === -1) {
          tabs.push(safeTabData);
        }
      } else if (action === 'updated') {
        // Update existing tab
        const index = tabs.findIndex(t => t.syncId === safeTabData.syncId);
        if (index !== -1) {
          tabs[index] = safeTabData;
        } else {
          tabs.push(safeTabData);
        }
      }

      // Sort tabs by index
      tabs.sort((a, b) => a.index - b.index);

      // Update workspace state
      await workspaceRef.set({
        tabs: tabs,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: this.userId
      }, { merge: true });

      console.log(`✅ Synced tab ${action}: ${tab.title || tab.url}`);
    } catch (error) {
      console.error('❌ Error syncing tab to Firebase:', error);
    }
  }

  async syncTabRemovalToFirebase(roomId, tabId) {
    try {
      if (!this.isInitialized || !this.db) {
        return;
      }

      // Get the tab to generate syncId
      let tab;
      try {
        tab = await chrome.tabs.get(tabId);
      } catch (e) {
        // Tab might already be removed
        return;
      }

      if (!tab) return;

      const syncId = `${tab.url || 'newtab'}_${(tab.title || '').substring(0, 20)}_${tab.pinned ? 'pinned' : ''}`;

      const workspaceRef = this.db.collection('syncRooms').doc(roomId).collection('workspace').doc('state');
      const workspaceDoc = await workspaceRef.get();
      
      let tabs = [];
      try {
        const docData = workspaceDoc.data();
        if (docData) {
          tabs = docData.tabs || [];
        }
      } catch (e) {
        // Document doesn't exist, nothing to remove
        return;
      }

      tabs = tabs.filter(t => t.syncId !== syncId);

      await workspaceRef.set({
        tabs: tabs,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: this.userId
      }, { merge: true });

      console.log(`✅ Synced tab removal: ${tab.title || tab.url}`);
    } catch (error) {
      console.error('❌ Error syncing tab removal:', error);
    }
  }
}

// Listen for tab sync requests from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Popup received message:', message);
  
  if (message.action === 'syncTabToFirebase') {
    console.log(`📥 Syncing tab to Firebase: ${message.tab.title || message.tab.url}`);
    window.popupFirebaseHandler.syncTabToFirebase(message.roomId, message.tab, message.action)
      .then(() => {
        console.log('✅ Tab synced to Firebase successfully');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('❌ Failed to sync tab to Firebase:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
  
  if (message.action === 'syncTabRemovalToFirebase') {
    console.log(`📥 Syncing tab removal to Firebase: ${message.tabId}`);
    window.popupFirebaseHandler.syncTabRemovalToFirebase(message.roomId, message.tabId)
      .then(() => {
        console.log('✅ Tab removal synced to Firebase successfully');
        sendResponse({ success: true });
      })
      .catch(error => {
        console.error('❌ Failed to sync tab removal to Firebase:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }
});

// Global instance
window.popupFirebaseHandler = new PopupFirebaseHandler();
