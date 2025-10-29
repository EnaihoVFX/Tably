// Smart Tab Organizer - Full Featured with Enhanced Stability
console.log('🚀 Smart Tab Organizer loading...');

// Import background Firebase sync
importScripts('background-firebase-sync.js');

class AIAPIManager {
  constructor() {
    this.isAvailable = false;
    this.model = null;
    this.safetyTimeout = 15000; // 15 second safety timeout for AI processing
    this.maxRetries = 2;
  }

  async initialize() {
    try {
      console.log('🤖 Initializing AI API...');
      
      // Check if LanguageModel API is available
      if (typeof LanguageModel === 'undefined') {
        console.log('⚠️ LanguageModel API not available');
        return false;
      }

      const availability = await LanguageModel.availability();
      if (!availability) {
        console.log('⚠️ LanguageModel not available');
        return false;
      }

      this.model = await LanguageModel.create({
        modelId: 'gemini-2.0-flash-exp',
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      });

      // Debug: Log available methods
      console.log('🤖 AI Model methods:', Object.getOwnPropertyNames(this.model));
      console.log('🤖 AI Model prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.model)));
      
      // Log the actual method names
      const prototypeMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.model));
      console.log('🤖 Available AI methods:', ...prototypeMethods);
      console.log('🤖 Method details:', prototypeMethods.map(method => ({
        name: method,
        type: typeof this.model[method]
      })));
      
      // Try to find any method that might be for generating content
      const possibleMethods = prototypeMethods.filter(method => 
        method.toLowerCase().includes('generate') || 
        method.toLowerCase().includes('complete') || 
        method.toLowerCase().includes('predict') ||
        method.toLowerCase().includes('ask') ||
        method.toLowerCase().includes('chat')
      );
      console.log('🤖 Possible generation methods:', ...possibleMethods);
      
      // Also log all methods to see what's available
      console.log('🤖 All methods:', prototypeMethods.join(', '));

      this.isAvailable = true;
      console.log('✅ AI API initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ AI API initialization failed:', error);
      return false;
    }
  }

  async categorizeTabs(tabs) {
    if (!this.isAvailable || !this.model) {
      throw new Error('AI not available');
    }

    const tabData = tabs.map(tab => ({
      title: tab.title,
      url: tab.url
    }));

    const prompt = `Categorize these browser tabs into logical groups. Return only a JSON array of objects with "name" and "tabs" (array of indices). Be concise and practical.

Tabs: ${JSON.stringify(tabData)}

Example: [{"name": "Work", "tabs": [0,1,2]}, {"name": "Social", "tabs": [3,4]}]`;

    try {
      // Safety timeout wrapper - try different method names
      let result;
      try {
        // Try to find and use any method that might generate content
        const prototypeMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(this.model));
        console.log('🤖 All prototype methods:', prototypeMethods.join(', '));
        
        // Try common method names first - prioritize promptStreaming
        const commonMethods = ['promptStreaming', 'prompt', 'generateContent', 'generateText', 'generate', 'complete', 'predict', 'ask', 'chat', 'respond'];
        let foundMethod = null;
        
        for (const method of commonMethods) {
          if (this.model[method] && typeof this.model[method] === 'function') {
            foundMethod = method;
            console.log('🤖 Found method:', method);
            break;
          }
        }
        
        if (foundMethod) {
          console.log('🤖 Trying method:', foundMethod);
          console.log('🤖 Prompt:', prompt.substring(0, 100) + '...');
          
          // If it's promptStreaming, handle differently
          if (foundMethod === 'promptStreaming') {
            console.log('🤖 Using streaming method...');
            const stream = await this.model.promptStreaming(prompt);
            let fullText = '';
            for await (const chunk of stream) {
              fullText += chunk;
            }
            result = fullText;
            console.log('🤖 Streaming completed, got text:', fullText.substring(0, 100) + '...');
          } else {
            result = await Promise.race([
              this.model[foundMethod](prompt),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI safety timeout')), this.safetyTimeout)
              )
            ]);
            console.log('🤖 AI call completed, processing result...');
          }
        } else {
          // Try any method that might work
          const possibleMethods = prototypeMethods.filter(method => 
            method.toLowerCase().includes('generate') || 
            method.toLowerCase().includes('complete') || 
            method.toLowerCase().includes('predict') ||
            method.toLowerCase().includes('ask') ||
            method.toLowerCase().includes('chat') ||
            method.toLowerCase().includes('prompt') ||
            method.toLowerCase().includes('respond')
          );
          
          if (possibleMethods.length > 0) {
            console.log('🤖 Trying filtered method:', possibleMethods[0]);
            result = await Promise.race([
              this.model[possibleMethods[0]](prompt),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI safety timeout')), this.safetyTimeout)
              )
            ]);
          } else {
            console.log('🤖 No suitable methods found, trying direct call...');
            // Last resort: try calling the model directly
            result = await Promise.race([
              this.model(prompt),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('AI safety timeout')), this.safetyTimeout)
              )
            ]);
          }
        }
      } catch (methodError) {
        console.log('AI method error:', methodError);
        throw methodError;
      }

      // Handle different response formats
      console.log('🤖 AI Response structure:', result);
      let text;
      if (result && result.response) {
        text = await result.response.text();
      } else if (result && result.text) {
        text = await result.text();
      } else if (typeof result === 'string') {
        text = result;
      } else if (result && typeof result.then === 'function') {
        // Handle promise-based response
        const resolved = await result;
        text = resolved.response ? await resolved.response.text() : resolved.text ? await resolved.text() : resolved;
      } else {
        console.log('🤖 AI Response structure:', result);
        throw new Error('Unexpected AI response format');
      }
      
      console.log('🤖 AI Response text:', text);
      
      // Clean up markdown code blocks if present
      text = text.trim();
      if (text.startsWith('```')) {
        // Remove ```json or ``` from start
        text = text.replace(/^```(?:json)?\s*\n?/, '');
        // Remove ``` from end
        text = text.replace(/\n?```\s*$/, '');
        text = text.trim();
        console.log('🤖 Cleaned text:', text);
      }
      
      // Parse JSON response safely
      const categories = JSON.parse(text);
      return this.convertToGroups(categories, tabs);
    } catch (error) {
      console.error('AI categorization failed:', error);
      throw error;
    }
  }

  convertToGroups(categories, tabs) {
    const groups = [];
    const colors = ['blue', 'red', 'green', 'yellow', 'orange', 'pink', 'purple', 'cyan'];
    
    categories.forEach((category, index) => {
      if (category.tabs && category.tabs.length > 0) {
        groups.push({
          name: category.name,
          color: colors[index % colors.length],
          tabs: category.tabs // Keep as indices, not tab objects
        });
      }
    });

    return groups;
  }
}

class FirebaseSyncManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.syncEnabled = false;
    this.currentRoomId = null;
    this.unsubscribeListeners = [];
    this.collaborationWindows = new Map(); // roomId -> windowId
    this.syncThrottle = new Map(); // Prevent infinite sync loops
    this.userId = this.generateUserId();
  }

  generateUserId() {
    // Generate a unique user ID for this session
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async initialize(config) {
    try {
      console.log('🔥 Initializing Firebase Sync...');
      
      if (!config || !config.apiKey || !config.authDomain || !config.projectId) {
        console.log('⚠️ Firebase config not provided');
        return false;
      }

      // Store config for use in popup
      this.config = config;
      this.isInitialized = true;
      this.syncEnabled = true;
      console.log('✅ Firebase Sync initialized successfully (popup-based)');
      return true;
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
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
      this.currentRoomId = roomId;

      // Create room document
      await this.db.collection('syncRooms').doc(roomId).set({
        sessionName: sessionName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        owner: 'user', // Could be enhanced with actual user ID
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

  async syncSessionToRoom(roomId, sessionData) {
    try {
      if (!this.isInitialized || !this.db) {
        return { success: false, error: 'Firebase not initialized' };
      }

      const sessionRef = this.db.collection('syncRooms').doc(roomId).collection('sessions').doc('current');
      
      await sessionRef.set({
        ...sessionData,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        syncedBy: 'user'
      });

      console.log(`✅ Synced session to room: ${roomId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error syncing session:', error);
      return { success: false, error: error.message };
    }
  }

  async joinSyncRoom(roomId, callback) {
    try {
      if (!this.isInitialized || !this.db) {
        return { success: false, error: 'Firebase not initialized' };
      }

      this.currentRoomId = roomId;

      // Subscribe to real-time updates
      const unsubscribe = this.db.collection('syncRooms')
        .doc(roomId)
        .collection('sessions')
        .doc('current')
        .onSnapshot((doc) => {
          if (doc.exists()) {
            const sessionData = doc.data();
            console.log('📥 Received sync update:', sessionData);
            if (callback) {
              callback(sessionData);
            }
          }
        }, (error) => {
          console.error('❌ Sync listener error:', error);
        });

      this.unsubscribeListeners.push(unsubscribe);
      console.log(`✅ Joined sync room: ${roomId}`);
      return { success: true };
    } catch (error) {
      console.error('❌ Error joining sync room:', error);
      return { success: false, error: error.message };
    }
  }

  async leaveSyncRoom() {
    try {
      // Unsubscribe from all listeners
      this.unsubscribeListeners.forEach(unsubscribe => unsubscribe());
      this.unsubscribeListeners = [];
      this.currentRoomId = null;
      console.log('✅ Left sync room');
      return { success: true };
    } catch (error) {
      console.error('❌ Error leaving sync room:', error);
      return { success: false, error: error.message };
    }
  }

  generateRoomId() {
    // Generate a short, shareable room ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let roomId = '';
    for (let i = 0; i < 6; i++) {
      roomId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return roomId;
  }

  async getRoomInfo(roomId) {
    try {
      if (!this.isInitialized || !this.db) {
        return { success: false, error: 'Firebase not initialized' };
      }

      const roomDoc = await this.db.collection('syncRooms').doc(roomId).get();
      
      if (!roomDoc.exists) {
        return { success: false, error: 'Room not found' };
      }

      return { success: true, roomData: roomDoc.data() };
    } catch (error) {
      console.error('❌ Error getting room info:', error);
      return { success: false, error: error.message };
    }
  }

  // Workspace Collaboration Methods
  async createCollaborationWorkspace(roomId) {
    try {
      if (!this.isInitialized || !this.db) {
        return { success: false, error: 'Firebase not initialized' };
      }

      // Create a new window for collaboration
      const window = await chrome.windows.create({
        type: 'normal',
        focused: true
      });

      // Store the window ID
      this.collaborationWindows.set(roomId, window.id);

      // Initialize workspace in Firebase
      await this.db.collection('syncRooms').doc(roomId).collection('workspace').doc('state').set({
        windowId: window.id,
        tabs: [],
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: this.userId
      });

      // Start listening to tab changes for this window
      this.startWindowTabSync(roomId, window.id);

      console.log(`✅ Created collaboration workspace for room ${roomId} in window ${window.id}`);
      return { success: true, windowId: window.id };
    } catch (error) {
      console.error('❌ Error creating workspace:', error);
      return { success: false, error: error.message };
    }
  }

  async joinCollaborationWorkspace(roomId) {
    try {
      if (!this.isInitialized || !this.db) {
        return { success: false, error: 'Firebase not initialized' };
      }

      // Check if room exists
      const roomDoc = await this.db.collection('syncRooms').doc(roomId).get();
      if (!roomDoc.exists) {
        return { success: false, error: 'Room not found. Create a room first.' };
      }

      // Create a new window for this user
      const window = await chrome.windows.create({
        type: 'normal',
        focused: true
      });

      // Store the window ID
      this.collaborationWindows.set(roomId, window.id);

      // Start listening to workspace changes
      this.startWorkspaceSync(roomId, window.id);

      // Start listening to tab changes
      this.startWindowTabSync(roomId, window.id);

      // Initial sync - load existing tabs from workspace
      const workspaceDoc = await this.db.collection('syncRooms')
        .doc(roomId)
        .collection('workspace')
        .doc('state')
        .get();
      
      if (workspaceDoc.exists()) {
        const workspaceData = workspaceDoc.data();
        if (workspaceData.tabs && workspaceData.tabs.length > 0) {
          await this.syncTabsToWindow(workspaceData.tabs, window.id);
        }
      }

      console.log(`✅ Joined collaboration workspace for room ${roomId} in window ${window.id}`);
      return { success: true, windowId: window.id };
    } catch (error) {
      console.error('❌ Error joining workspace:', error);
      return { success: false, error: error.message };
    }
  }

  async startWorkspaceSync(roomId, windowId) {
    try {
      // Listen to workspace state changes
      const unsubscribe = this.db.collection('syncRooms')
        .doc(roomId)
        .collection('workspace')
        .doc('state')
        .onSnapshot(async (doc) => {
          if (doc.exists()) {
            const workspaceData = doc.data();
            
            // Skip if this update came from us (prevent loops)
            if (workspaceData.updatedBy === this.userId) {
              return;
            }

            // Sync tabs to this window
            await this.syncTabsToWindow(workspaceData.tabs || [], windowId);
          }
        }, (error) => {
          console.error('❌ Workspace sync listener error:', error);
        });

      this.unsubscribeListeners.push(unsubscribe);
    } catch (error) {
      console.error('❌ Error starting workspace sync:', error);
    }
  }

  async startWindowTabSync(roomId, windowId) {
    try {
      console.log(`🔄 Starting tab sync for room ${roomId} in window ${windowId}`);
      
      // Listen to tab creation
      chrome.tabs.onCreated.addListener(async (tab) => {
        console.log(`📝 Tab created: ${tab.title}, window: ${tab.windowId}, target window: ${windowId}`);
        if (tab.windowId === windowId && !this.syncThrottle.get(`create_${tab.id}`)) {
          this.syncThrottle.set(`create_${tab.id}`, true);
          setTimeout(() => this.syncThrottle.delete(`create_${tab.id}`), 1000);
          
          console.log(`🔄 Syncing tab created in workspace window ${windowId}`);
          await this.syncTabToFirebase(roomId, tab, 'created');
        } else if (tab.windowId === windowId) {
          console.log(`⚠️ Tab ${tab.id} in workspace window but already throttled`);
        } else {
          console.log(`ℹ️ Tab ${tab.id} not in workspace window (${tab.windowId} != ${windowId})`);
        }
      });

      // Listen to tab updates (URL changes, title changes)
      chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        if (tab.windowId === windowId && !this.syncThrottle.get(`update_${tabId}`)) {
          this.syncThrottle.set(`update_${tabId}`, true);
          setTimeout(() => this.syncThrottle.delete(`update_${tabId}`), 1000);

          // Only sync if URL or title changed
          if (changeInfo.url || changeInfo.title) {
            console.log(`🔄 Syncing tab updated in workspace window ${windowId}: ${changeInfo.url || changeInfo.title}`);
            await this.syncTabToFirebase(roomId, tab, 'updated');
          }
        }
      });

      // Listen to tab removal
      chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
        if (removeInfo.windowId === windowId && !this.syncThrottle.get(`remove_${tabId}`)) {
          this.syncThrottle.set(`remove_${tabId}`, true);
          setTimeout(() => this.syncThrottle.delete(`remove_${tabId}`), 1000);
          
          console.log(`🔄 Syncing tab removed from workspace window ${windowId}`);
          await this.syncTabRemovalToFirebase(roomId, tabId);
        }
      });

      // Listen to tab moves/reorders
      chrome.tabs.onMoved.addListener(async (tabId, moveInfo) => {
        if (moveInfo.windowId === windowId) {
          await this.syncTabOrderToFirebase(roomId, windowId);
        }
      });

      console.log(`✅ Started tab sync for window ${windowId} in room ${roomId}`);
    } catch (error) {
      console.error('❌ Error starting window tab sync:', error);
    }
  }

  generateTabSyncId(tab) {
    // Generate a stable ID for syncing tabs across users
    // Use URL + index as the identifier (URLs are unique enough)
    return `${tab.url || 'newtab'}_${tab.index}`;
  }

  async syncTabToFirebase(roomId, tab, action) {
    try {
      if (!this.isInitialized || !this.db) {
        console.log('⚠️ Firebase not initialized, skipping tab sync');
        return;
      }

      // Skip system/internal URLs
      if (tab.url && (
        tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:')
      )) {
        console.log(`⚠️ Skipping system URL: ${tab.url}`);
        return;
      }

      console.log(`🔄 Syncing tab ${action} for room ${roomId}: ${tab.title || tab.url}`);

      // Create safe tab data (no sensitive information)
      const safeTabData = {
        syncId: this.generateTabSyncId(tab), // Stable ID for cross-user sync
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
      if (workspaceDoc.exists()) {
        tabs = workspaceDoc.data().tabs || [];
        console.log(`📋 Current tabs in workspace: ${tabs.length}`);
      } else {
        console.log('⚠️ Workspace state document does not exist, creating...');
        // Create the workspace state if it doesn't exist
        await workspaceRef.set({
          windowId: tab.windowId,
          tabs: [],
          lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
          updatedBy: this.userId
        });
      }

      if (action === 'created') {
        // Add new tab (check if it doesn't already exist)
        const existingIndex = tabs.findIndex(t => t.syncId === safeTabData.syncId);
        if (existingIndex === -1) {
          tabs.push(safeTabData);
          console.log(`✅ Added new tab to workspace: ${safeTabData.title}`);
        } else {
          console.log(`⚠️ Tab already exists in workspace: ${safeTabData.title}`);
        }
      } else if (action === 'updated') {
        // Update existing tab
        const index = tabs.findIndex(t => t.syncId === safeTabData.syncId);
        if (index !== -1) {
          tabs[index] = safeTabData;
          console.log(`✅ Updated tab in workspace: ${safeTabData.title}`);
        } else {
          tabs.push(safeTabData);
          console.log(`✅ Added updated tab to workspace: ${safeTabData.title}`);
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

      console.log(`✅ Synced tab ${action} to Firebase for room ${roomId} (${tabs.length} total tabs)`);
    } catch (error) {
      console.error(`❌ Error syncing tab ${action} to Firebase:`, error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        roomId: roomId,
        tabId: tab.id,
        action: action
      });
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
        // Tab might already be removed, try to find it in current tabs
        return;
      }

      if (!tab) return;

      const syncId = this.generateTabSyncId(tab);

      const workspaceRef = this.db.collection('syncRooms').doc(roomId).collection('workspace').doc('state');
      const workspaceDoc = await workspaceRef.get();
      
      if (!workspaceDoc.exists()) {
        return;
      }

      let tabs = workspaceDoc.data().tabs || [];
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

  async syncTabOrderToFirebase(roomId, windowId) {
    try {
      if (!this.isInitialized || !this.db) {
        return;
      }

      // Get current tabs
      const tabs = await chrome.tabs.query({ windowId: windowId });
      
      // Filter out system tabs
      const validTabs = tabs.filter(tab => 
        tab.url && 
        !tab.url.startsWith('chrome://') && 
        !tab.url.startsWith('chrome-extension://') &&
        !tab.url.startsWith('about:')
      );
      
      // Update workspace state with new order
      const workspaceRef = this.db.collection('syncRooms').doc(roomId).collection('workspace').doc('state');
      
      const safeTabs = validTabs.map(tab => ({
        syncId: this.generateTabSyncId(tab),
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
        pinned: tab.pinned || false,
        index: tab.index,
        groupId: tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE ? tab.groupId : null,
        updatedBy: this.userId,
        timestamp: Date.now()
      }));

      await workspaceRef.set({
        tabs: safeTabs,
        lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: this.userId
      }, { merge: true });

      console.log(`✅ Synced tab order for window ${windowId}`);
    } catch (error) {
      console.error('❌ Error syncing tab order:', error);
    }
  }

  async syncTabsToWindow(tabsData, windowId) {
    try {
      // Prevent sync loops
      if (this.syncThrottle.get(`sync_${windowId}`)) {
        return;
      }
      this.syncThrottle.set(`sync_${windowId}`, true);
      setTimeout(() => this.syncThrottle.delete(`sync_${windowId}`), 2000);

      // Get current tabs in window
      const currentTabs = await chrome.tabs.query({ windowId: windowId });
      const currentSyncIds = new Set(currentTabs.map(t => this.generateTabSyncId(t)));
      const syncedSyncIds = new Set(tabsData.map(t => t.syncId));

      // Create tabs that don't exist
      for (const tabData of tabsData) {
        if (!currentSyncIds.has(tabData.syncId)) {
          // Check if URL is valid and not sensitive
          if (tabData.url && 
              !tabData.url.startsWith('chrome://') && 
              !tabData.url.startsWith('chrome-extension://') &&
              !tabData.url.startsWith('about:')) {
            try {
              await chrome.tabs.create({
                windowId: windowId,
                url: tabData.url,
                active: false,
                pinned: tabData.pinned || false,
                index: tabData.index !== undefined ? tabData.index : -1
              });
            } catch (error) {
              console.error(`Failed to create tab: ${tabData.url}`, error);
            }
          }
        } else {
          // Update existing tab if URL or title changed
          const currentTab = currentTabs.find(t => this.generateTabSyncId(t) === tabData.syncId);
          if (currentTab) {
            const needsUpdate = 
              (tabData.url && currentTab.url !== tabData.url) ||
              (tabData.pinned !== undefined && currentTab.pinned !== tabData.pinned);

            if (needsUpdate && tabData.url && 
                !tabData.url.startsWith('chrome://') && 
                !tabData.url.startsWith('chrome-extension://')) {
              try {
                await chrome.tabs.update(currentTab.id, {
                  url: tabData.url !== currentTab.url ? tabData.url : undefined,
                  pinned: tabData.pinned !== undefined ? tabData.pinned : undefined
                });
              } catch (error) {
                console.error(`Failed to update tab ${currentTab.id}:`, error);
              }
            }
          }
        }
      }

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

  async leaveCollaborationWorkspace(roomId) {
    try {
      // Stop listening
      const windowId = this.collaborationWindows.get(roomId);
      if (windowId) {
        // Optionally close the collaboration window
        // await chrome.windows.remove(windowId);
      }
      
      this.collaborationWindows.delete(roomId);
      
      // Leave sync room will handle unsubscribing listeners
      await this.leaveSyncRoom();
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error leaving workspace:', error);
      return { success: false, error: error.message };
    }
  }
}

class TabGroupManager {
  constructor() {
    this.aiManager = new AIAPIManager();
    this.firebaseSync = new FirebaseSyncManager();
    this.isInitialized = false;
    this.lastOrganizationTime = 0;
    this.organizationCooldown = 30000; // 30 seconds
  }

  async initialize() {
    try {
      console.log('🔧 Initializing Tab Group Manager...');
      
      // Initialize AI with timeout protection
      const aiReady = await Promise.race([
        this.aiManager.initialize(),
        new Promise(resolve => setTimeout(() => resolve(false), 10000))
      ]);

      if (aiReady) {
        console.log('✅ AI features enabled');
      } else {
        console.log('⚠️ AI features disabled - using fallback categorization');
      }

      await this.loadSavedSessions();
      this.isInitialized = true;
      console.log('✅ Tab Group Manager initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Tab Group Manager initialization failed:', error);
      this.isInitialized = false;
      return false;
    }
  }

  async categorizeTabs(tabs) {
    try {
      // Try AI categorization first
      if (this.aiManager.isAvailable) {
        return await this.aiManager.categorizeTabs(tabs);
      }
    } catch (error) {
      console.log('🔄 AI failed, using fallback categorization');
    }

    // Fallback categorization
    return this.fallbackCategorization(tabs);
  }

  fallbackCategorization(tabs) {
    const groups = [];
    const categories = {
      work: { name: 'Work', color: 'blue', tabs: [] },
      social: { name: 'Social', color: 'green', tabs: [] },
      news: { name: 'News', color: 'red', tabs: [] },
      development: { name: 'Development', color: 'purple', tabs: [] },
      other: { name: 'Other', color: 'grey', tabs: [] }
    };

    tabs.forEach((tab, index) => {
      const url = tab.url.toLowerCase();
      const title = tab.title.toLowerCase();

      if (url.includes('gmail') || url.includes('slack') || url.includes('linkedin') || 
          url.includes('teams') || url.includes('zoom') || url.includes('calendar')) {
        categories.work.tabs.push(index);
      } else if (url.includes('twitter') || url.includes('facebook') || url.includes('instagram') || 
                 url.includes('youtube') || url.includes('tiktok') || url.includes('reddit')) {
        categories.social.tabs.push(index);
      } else if (url.includes('news') || url.includes('cnn') || url.includes('bbc') || 
                 url.includes('reuters') || url.includes('nytimes')) {
        categories.news.tabs.push(index);
      } else if (url.includes('github') || url.includes('stackoverflow') || url.includes('dev') || 
                 url.includes('codepen') || url.includes('jsfiddle') || title.includes('code')) {
        categories.development.tabs.push(index);
      } else {
        categories.other.tabs.push(index);
      }
    });

    // Only include categories with tabs
    Object.values(categories).forEach(category => {
      if (category.tabs.length > 0) {
        groups.push(category);
      }
    });

    return groups;
  }

  async createGroups(groups, tabs) {
    console.log(`🔧 Creating ${groups.length} groups...`);
    console.log(`⚠️ NOTE: Chrome Canary may have tab grouping limitations`);
    
    try {
      for (const group of groups) {
        if (group.tabs.length === 0) continue;
        
        console.log(`📦 Processing group: ${group.name} with ${group.tabs.length} tabs`);
        
        // Get the actual tab objects
        const groupTabs = group.tabs
          .map(index => tabs[index])
          .filter(tab => tab && !tab.pinned); // Simple filter: exists and not pinned
        
        if (groupTabs.length === 0) {
          console.log(`⚠️ No valid tabs for group "${group.name}"`);
          continue;
        }

        try {
          const tabIds = groupTabs.map(tab => tab.id);
          console.log(`🏗️ Attempting to group ${tabIds.length} tabs for "${group.name}"`);
          console.log(`🔧 Tab IDs:`, tabIds);
          
          // ULTRA-SIMPLE approach: Just try to group, let Chrome handle it
          const groupId = await chrome.tabs.group({ tabIds });
          
          console.log(`✅ Group created with ID: ${groupId}`);
          
          // Update group appearance
          await chrome.tabGroups.update(groupId, {
            title: group.name,
            color: group.color || 'grey'
          });
          
          // Delay between groups
          await new Promise(resolve => setTimeout(resolve, 150));
          
        } catch (groupError) {
          console.error(`❌ Error creating group "${group.name}":`, groupError);
          console.log(`🔍 Debug info:`, {
            groupName: group.name,
            tabCount: groupTabs.length,
            tabIds: groupTabs.map(t => t.id),
            tabUrls: groupTabs.map(t => t.url?.substring(0, 30))
          });
        }
      }
    } catch (error) {
      console.error('❌ Error in createGroups:', error);
    }
  }

  async organizeTabs() {
    try {
      const now = Date.now();
      if (now - this.lastOrganizationTime < this.organizationCooldown) {
        console.log('⏰ Tabs already organized recently, skipping auto-organization');
        return;
      }

      console.log('🔄 Starting tab organization...');
      
      // Small delay to ensure tabs are in a stable state
      await new Promise(resolve => setTimeout(resolve, 300));
      const allTabs = await chrome.tabs.query({});
      console.log(`📊 Total tabs: ${allTabs.length}`);
      
      // Filter out ungroupable tabs BEFORE sending to AI
      const groupableTabs = allTabs.filter(tab => {
        // Exclude chrome:// URLs, chrome-extension://, and other system tabs
        if (tab.url && (
          tab.url.startsWith('chrome://') || 
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:')
        )) {
          return false;
        }
        return true;
      });
      
      console.log(`📊 Groupable tabs: ${groupableTabs.length}`);
      console.log(`📊 Tab URLs:`, groupableTabs.map((t, i) => `[${i}] ${t.url?.substring(0, 50)}...`));
      
      if (groupableTabs.length < 2) {
        console.log('📝 Not enough tabs to organize');
        return;
      }

      const groups = await this.categorizeTabs(groupableTabs);
      await this.createGroups(groups, groupableTabs);
      
      this.lastOrganizationTime = now;
      console.log('✅ Tab organization completed');
    } catch (error) {
      console.error('❌ Error organizing tabs:', error);
    }
  }

  async groupTabs(tabIds, groupName = null) {
    try {
      console.log(`📦 Grouping ${tabIds.length} tabs manually...`);
      
      if (!tabIds || tabIds.length < 2) {
        return { success: false, error: 'Need at least 2 tabs to group' };
      }

      // Filter out invalid tabs
      const tabs = await chrome.tabs.query({});
      const validTabIds = tabIds.filter(id => tabs.some(t => t.id === id));
      
      if (validTabIds.length < 2) {
        return { success: false, error: 'Not enough valid tabs to group' };
      }

      // Create group
      const groupId = await chrome.tabs.group({ tabIds: validTabIds });
      
      // Generate group name if not provided
      if (!groupName) {
        // Try to infer name from domain
        const sampleTab = tabs.find(t => validTabIds.includes(t.id));
        if (sampleTab && sampleTab.url) {
          try {
            const domain = new URL(sampleTab.url).hostname.replace('www.', '');
            groupName = domain.split('.')[0];
            groupName = groupName.charAt(0).toUpperCase() + groupName.slice(1);
          } catch (e) {
            groupName = 'New Group';
          }
        } else {
          groupName = 'New Group';
        }
      }

      // Update group appearance
      const colors = ['blue', 'red', 'green', 'yellow', 'orange', 'pink', 'purple', 'cyan'];
      const colorIndex = Math.floor(Math.random() * colors.length);
      
      await chrome.tabGroups.update(groupId, {
        title: groupName,
        color: colors[colorIndex]
      });

      console.log(`✅ Created group "${groupName}" with ${validTabIds.length} tabs`);
      return { success: true, message: `Grouped ${validTabIds.length} tabs as "${groupName}"` };
    } catch (error) {
      console.error('❌ Error grouping tabs:', error);
      return { success: false, error: error.message };
    }
  }

  async ungroupAllTabs() {
    try {
      console.log('🗂️ Starting ungroup all tabs...');
      
      const tabs = await chrome.tabs.query({});
      const groupedTabs = tabs.filter(tab => tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE);
      
      if (groupedTabs.length === 0) {
        console.log('📝 No grouped tabs found');
        return { success: true, message: 'No grouped tabs found' };
      }

      console.log(`📊 Found ${groupedTabs.length} grouped tabs to ungroup`);
      
      // Try to ungroup all at once first
      try {
        await chrome.tabs.ungroup(groupedTabs.map(tab => tab.id));
        console.log('✅ All tabs ungrouped successfully');
        return { success: true, message: 'All tabs ungrouped successfully' };
      } catch (batchError) {
        console.log('⚠️ Batch ungroup failed, trying individual ungrouping...');
        
        // Fallback to individual ungrouping
        let successCount = 0;
        for (const tab of groupedTabs) {
          try {
            await chrome.tabs.ungroup(tab.id);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
          } catch (error) {
            console.error(`Failed to ungroup tab ${tab.id}:`, error);
          }
        }
        
        console.log(`✅ Ungrouped ${successCount}/${groupedTabs.length} tabs`);
        return { 
          success: true, 
          message: `Ungrouped ${successCount}/${groupedTabs.length} tabs` 
        };
      }
    } catch (error) {
      console.error('❌ Error in ungroupAllTabs:', error);
      return { success: false, error: error.message };
    }
  }

  async saveSession(name) {
    try {
      console.log(`💾 Saving session: ${name}`);
      
      const tabs = await chrome.tabs.query({});
      const tabGroups = await chrome.tabGroups.query({});
      
      const session = {
        name,
        timestamp: Date.now(),
        tabs: tabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          url: tab.url,
          groupId: tab.groupId
        })),
        groups: tabGroups.map(group => ({
          id: group.id,
          title: group.title,
          color: group.color,
          collapsed: group.collapsed
        }))
      };

      const result = await chrome.storage.local.get(['sessions']);
      const sessions = result.sessions || [];
      
      // Remove existing session with same name
      const filteredSessions = sessions.filter(s => s.name !== name);
      filteredSessions.push(session);
      
      await chrome.storage.local.set({ sessions: filteredSessions });
      console.log(`✅ Session saved: ${name}`);
      
      return { success: true, message: `Session "${name}" saved successfully` };
    } catch (error) {
      console.error('❌ Error saving session:', error);
      return { success: false, error: error.message };
    }
  }

  async loadSession(name, options = {}) {
    try {
      console.log(`📂 Loading session: ${name}`);
      
      const result = await chrome.storage.local.get(['sessions']);
      const sessions = result.sessions || [];
      const session = sessions.find(s => s.name === name);
      
      if (!session) {
        return { success: false, error: `Session "${name}" not found` };
      }

      // Get existing tabs before making changes
      const existingTabs = await chrome.tabs.query({});
      const tabsToClose = existingTabs.filter(tab => !tab.pinned);

      // Restore tabs FIRST to ensure we always have tabs open
      const restoredTabs = [];
      for (const tabData of session.tabs) {
        try {
          // Skip invalid URLs
          if (!tabData.url || tabData.url.startsWith('chrome://') || 
              tabData.url.startsWith('chrome-extension://')) {
            continue;
          }
          
          const tab = await chrome.tabs.create({
            url: tabData.url,
            active: false
          });
          restoredTabs.push({ ...tab, originalGroupId: tabData.groupId });
        } catch (error) {
          console.error(`Failed to restore tab: ${tabData.url}`, error);
        }
      }

      // Only close old tabs if we successfully restored at least one tab
      if (options.replace !== false && restoredTabs.length > 0 && tabsToClose.length > 0) {
        // Close existing tabs (but keep pinned tabs)
        try {
          await chrome.tabs.remove(tabsToClose.map(tab => tab.id));
        } catch (error) {
          console.error('Error closing tabs:', error);
          // Continue even if closing fails
        }
      }

      // Restore groups
      const groupMap = new Map();
      for (const groupData of session.groups) {
        const groupTabs = restoredTabs.filter(tab => tab.originalGroupId === groupData.id);
        if (groupTabs.length > 0) {
          try {
            const groupId = await chrome.tabs.group({
              tabIds: groupTabs.map(tab => tab.id)
            });
            
            await chrome.tabGroups.update(groupId, {
              title: groupData.title,
              color: groupData.color,
              collapsed: groupData.collapsed
            });
            
            groupMap.set(groupData.id, groupId);
          } catch (error) {
            console.error('Error restoring group:', error);
          }
        }
      }

      // Activate the first restored tab
      if (restoredTabs.length > 0) {
        await chrome.tabs.update(restoredTabs[0].id, { active: true });
      }

      console.log(`✅ Session loaded: ${name}`);
      return { success: true, message: `Session "${name}" loaded successfully` };
    } catch (error) {
      console.error('❌ Error loading session:', error);
      return { success: false, error: error.message };
    }
  }

  async getSavedSessions() {
    try {
      // Add timeout to prevent hanging
      const storagePromise = chrome.storage.local.get(['sessions']);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Storage read timeout')), 5000);
      });
      
      const result = await Promise.race([storagePromise, timeoutPromise]);
      return result.sessions || [];
    } catch (error) {
      console.error('❌ Error getting saved sessions:', error);
      return [];
    }
  }

  async loadSavedSessions() {
    try {
      const sessions = await this.getSavedSessions();
      console.log(`📚 Loaded ${sessions.length} saved sessions`);
    } catch (error) {
      console.error('❌ Error loading saved sessions:', error);
    }
  }

  async generateShareableLink(sessionName) {
    try {
      console.log(`🔗 Generating shareable link for session: ${sessionName}`);
      
      const result = await chrome.storage.local.get(['sessions']);
      const sessions = result.sessions || [];
      const session = sessions.find(s => s.name === sessionName);
      
      if (!session) {
        return { success: false, error: `Session "${sessionName}" not found` };
      }

      // Create a shareable session object (remove sensitive data)
      const shareableSession = {
        name: session.name,
        timestamp: session.timestamp,
        tabs: session.tabs.map(tab => ({
          title: tab.title,
          url: tab.url,
          groupId: tab.groupId
        })),
        groups: session.groups.map(group => ({
          title: group.title,
          color: group.color,
          collapsed: group.collapsed,
          id: group.id
        }))
      };

      // Encode session data as base64 URL-safe string
      const sessionData = JSON.stringify(shareableSession);
      const encodedData = btoa(sessionData)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      // Create shareable URL using a custom protocol or data URL
      // For Chrome extensions, we'll use a data URL that can be opened
      const shareableUrl = `chrome-extension://${chrome.runtime.id}/import.html?data=${encodedData}`;
      
      // Also create a shorter version for clipboard
      const shortUrl = `tabsession://${encodedData}`;
      
      console.log(`✅ Generated shareable link for session: ${sessionName}`);
      
      return { 
        success: true, 
        url: shareableUrl,
        shortUrl: shortUrl,
        encodedData: encodedData
      };
    } catch (error) {
      console.error('❌ Error generating shareable link:', error);
      return { success: false, error: error.message };
    }
  }

  async importSharedSession(encodedData) {
    try {
      console.log(`📥 Importing shared session...`);
      
      // Decode the base64 data
      let decodedData;
      try {
        // Restore padding if needed
        let data = encodedData.replace(/-/g, '+').replace(/_/g, '/');
        while (data.length % 4) {
          data += '=';
        }
        decodedData = atob(data);
      } catch (e) {
        return { success: false, error: 'Invalid session data format' };
      }

      // Parse JSON
      let sessionData;
      try {
        sessionData = JSON.parse(decodedData);
      } catch (e) {
        return { success: false, error: 'Invalid session data' };
      }

      // Import the session
      const session = {
        name: sessionData.name || `Imported Session ${new Date().toLocaleString()}`,
        timestamp: sessionData.timestamp || Date.now(),
        tabs: sessionData.tabs || [],
        groups: sessionData.groups || []
      };

      // Save to local storage
      const result = await chrome.storage.local.get(['sessions']);
      const sessions = result.sessions || [];
      
      // Remove existing session with same name if any
      const filteredSessions = sessions.filter(s => s.name !== session.name);
      filteredSessions.push(session);
      
      await chrome.storage.local.set({ sessions: filteredSessions });
      
      console.log(`✅ Imported shared session: ${session.name}`);
      
      return { 
        success: true, 
        message: `Session "${session.name}" imported successfully`,
        session: session
      };
    } catch (error) {
      console.error('❌ Error importing shared session:', error);
      return { success: false, error: error.message };
    }
  }

  async initializeFirebaseSync(config) {
    return await this.firebaseSync.initialize(config);
  }

  async createSyncRoom(sessionName) {
    return await this.firebaseSync.createSyncRoom(sessionName);
  }

  async syncSessionToRoom(roomId, sessionName) {
    try {
      const result = await chrome.storage.local.get(['sessions']);
      const sessions = result.sessions || [];
      const session = sessions.find(s => s.name === sessionName);
      
      if (!session) {
        return { success: false, error: `Session "${sessionName}" not found` };
      }

      const sessionData = {
        name: session.name,
        timestamp: session.timestamp,
        tabs: session.tabs,
        groups: session.groups
      };

      return await this.firebaseSync.syncSessionToRoom(roomId, sessionData);
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async joinSyncRoom(roomId, callback) {
    const result = await this.firebaseSync.joinSyncRoom(roomId, async (sessionData) => {
      // Auto-import synced session
      if (sessionData && callback) {
        callback(sessionData);
      }
    });
    return result;
  }

  async leaveSyncRoom() {
    return await this.firebaseSync.leaveSyncRoom();
  }

  async getRoomInfo(roomId) {
    return await this.firebaseSync.getRoomInfo(roomId);
  }

  async createCollaborationWorkspace(roomId) {
    return await this.firebaseSync.createCollaborationWorkspace(roomId);
  }

  async joinCollaborationWorkspace(roomId) {
    return await this.firebaseSync.joinCollaborationWorkspace(roomId);
  }

  async leaveCollaborationWorkspace(roomId) {
    return await this.firebaseSync.leaveCollaborationWorkspace(roomId);
  }
}

// Workspace window tracking for tab sync
const workspaceWindows = new Map(); // windowId -> roomId
const pendingSyncData = new Map(); // roomId -> array of pending sync operations

// Initialize Firebase sync on startup
(async () => {
  try {
    await backgroundFirebaseSync.initialize();
    await backgroundFirebaseSync.loadActiveWorkspaces();
    
    // Restore workspace windows from storage
    const result = await chrome.storage.local.get(['activeWorkspaces']);
    if (result.activeWorkspaces) {
      for (const [workspaceId, data] of result.activeWorkspaces) {
        workspaceWindows.set(data.windowId, workspaceId);
        // Re-inject collaboration indicator for existing tabs
        try {
          const tabs = await chrome.tabs.query({ windowId: data.windowId });
          for (const tab of tabs) {
            if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['collaboration-indicator.js']
              }).catch(() => {});
            }
          }
        } catch (e) {
          console.error('Error restoring workspace indicators:', e);
        }
      }
    }
  } catch (error) {
    console.error('Error initializing Firebase sync:', error);
  }
})();

// Listen for tab changes and sync to Firebase via background Firebase sync
chrome.tabs.onCreated.addListener(async (tab) => {
  const roomId = workspaceWindows.get(tab.windowId);
  console.log(`🔍 Tab created in window ${tab.windowId}, roomId: ${roomId}`);
  if (roomId) {
    try {
      console.log(`📤 Syncing tab creation: ${tab.title || tab.url}`);
      // Sync directly via background Firebase sync (works even when popup is closed)
      await backgroundFirebaseSync.syncTabToFirebase(roomId, tab, 'created');
      console.log('✅ Tab sync sent to Firebase');
    } catch (error) {
      console.error('Failed to sync tab creation:', error);
    }
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  const roomId = workspaceWindows.get(tab.windowId);
  console.log(`🔍 Tab updated in window ${tab.windowId}, roomId: ${roomId}, changes:`, changeInfo);
  if (roomId && (changeInfo.url || changeInfo.title)) {
    try {
      console.log(`📤 Syncing tab update: ${tab.title || tab.url}`);
      // Sync directly via background Firebase sync (works even when popup is closed)
      await backgroundFirebaseSync.syncTabToFirebase(roomId, tab, 'updated');
      console.log('✅ Tab update sync sent to Firebase');
    } catch (error) {
      console.error('Failed to sync tab update:', error);
    }
  }
});

chrome.tabs.onRemoved.addListener(async (tabId, removeInfo) => {
  const roomId = workspaceWindows.get(removeInfo.windowId);
  console.log(`🔍 Tab removed from window ${removeInfo.windowId}, roomId: ${roomId}`);
  if (roomId) {
    try {
      console.log(`📤 Syncing tab removal: ${tabId}`);
      // Sync directly via background Firebase sync (works even when popup is closed)
      await backgroundFirebaseSync.syncTabRemovalToFirebase(roomId, tabId);
      console.log('✅ Tab removal sync sent to Firebase');
    } catch (error) {
      console.error('Failed to sync tab removal:', error);
    }
  }
});

// Initialize the extension
const tabGroupManager = new TabGroupManager();

// Enhanced message handler with comprehensive error handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  try {
    console.log('📨 Received message:', request);
    
    // Validate request
    if (!request || typeof request.action !== 'string') {
      sendResponse({ error: 'Invalid request format' });
      return true;
    }

    // Handle different actions
    switch (request.action) {
      case 'organizeTabs':
        tabGroupManager.organizeTabs()
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'ungroupAllTabs':
        tabGroupManager.ungroupAllTabs()
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'saveSession':
        tabGroupManager.saveSession(request.name)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'loadSession':
        tabGroupManager.loadSession(request.name, request.options)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'getSavedSessions':
        console.log('📚 Background: Handling getSavedSessions request');
        // Ensure tabGroupManager is initialized
        if (!tabGroupManager) {
          console.error('❌ tabGroupManager not initialized');
          sendResponse({ success: false, error: 'Extension not initialized' });
          return true;
        }
        
        // Use a timeout to ensure response is always sent
        const timeoutId = setTimeout(() => {
          console.error('❌ getSavedSessions timeout - sending error response');
          sendResponse({ success: false, error: 'Timeout getting sessions' });
        }, 7000); // 7 second timeout
        
        tabGroupManager.getSavedSessions()
          .then(sessions => {
            clearTimeout(timeoutId);
            console.log(`📚 Background: Returning ${sessions.length} sessions`);
            sendResponse({ success: true, sessions });
          })
          .catch(error => {
            clearTimeout(timeoutId);
            console.error('❌ Background: Error getting sessions:', error);
            sendResponse({ success: false, error: error.message });
          });
        return true; // Keep the channel open for async response

      case 'groupTabs':
        tabGroupManager.groupTabs(request.tabIds, request.groupName)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'generateShareableLink':
        tabGroupManager.generateShareableLink(request.sessionName)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'importSharedSession':
        tabGroupManager.importSharedSession(request.encodedData)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'initializeFirebaseSync':
        tabGroupManager.initializeFirebaseSync(request.config)
          .then(result => sendResponse({ success: result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'createSyncRoom':
        tabGroupManager.createSyncRoom(request.sessionName)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'syncSessionToRoom':
        tabGroupManager.syncSessionToRoom(request.roomId, request.sessionName)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'joinSyncRoom':
        tabGroupManager.joinSyncRoom(request.roomId, (sessionData) => {
          // Send session update to popup
          chrome.runtime.sendMessage({
            action: 'syncUpdate',
            sessionData: sessionData
          }).catch(() => {}); // Ignore errors if popup is closed
        })
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'leaveSyncRoom':
        tabGroupManager.leaveSyncRoom()
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'getRoomInfo':
        tabGroupManager.getRoomInfo(request.roomId)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'createCollaborationWorkspace':
        tabGroupManager.createCollaborationWorkspace(request.roomId)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'joinCollaborationWorkspace':
        tabGroupManager.joinCollaborationWorkspace(request.roomId)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'leaveCollaborationWorkspace':
        tabGroupManager.leaveCollaborationWorkspace(request.roomId)
          .then(result => {
            // Remove window from tracking
            for (const [windowId, roomId] of workspaceWindows.entries()) {
              if (roomId === request.roomId) {
                workspaceWindows.delete(windowId);
              }
            }
            sendResponse(result);
          })
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'registerWorkspaceWindow':
        console.log(`📥 Background: Received registerWorkspaceWindow request:`, request);
        // Handle asynchronously
        (async () => {
          try {
            workspaceWindows.set(request.windowId, request.roomId);
            console.log(`✅ Registered workspace window ${request.windowId} for room ${request.roomId}`);
            
            // Save to persistent storage
            await chrome.storage.local.set({ 
              activeWorkspaces: Array.from(workspaceWindows.entries()).map(([winId, roomId]) => [roomId, { windowId: winId }])
            });
            
            // Start background Firebase sync for this workspace
            await backgroundFirebaseSync.startWorkspaceSync(request.roomId, request.windowId);
            
            // Start tab sync for this workspace window
            await backgroundFirebaseSync.startWindowTabSync(request.roomId, request.windowId);
            console.log(`🔄 Started tab sync for workspace window ${request.windowId}`);
            
            // Inject collaboration indicator into the window
            try {
              const tabs = await chrome.tabs.query({ windowId: request.windowId });
              for (const tab of tabs) {
                if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                  await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['collaboration-indicator.js']
                  }).catch(() => {});
                }
              }
              
              // Also inject into new tabs created in this window
              chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo, tab) {
                if (tab.windowId === request.windowId && changeInfo.status === 'complete') {
                  if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
                    chrome.scripting.executeScript({
                      target: { tabId: tab.id },
                      files: ['collaboration-indicator.js']
                    }).catch(() => {});
                  }
                }
              });
            } catch (e) {
              console.error('Error injecting collaboration indicator:', e);
            }
            
            sendResponse({ success: true });
          } catch (error) {
            console.error('❌ Error in registerWorkspaceWindow:', error);
            sendResponse({ success: false, error: error.message });
          }
        })();
        return true;

      case 'getCurrentWindowId':
        // Get current window ID from sender
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.windows.get(tabs[0].windowId, (win) => {
              sendResponse({ windowId: win.id });
            });
          } else {
            sendResponse({ windowId: null });
          }
        });
        return true;

      case 'isCollaborationWindow':
        // Check if this window is a collaboration window
        const checkWindowId = request.windowId || (sender.tab ? sender.tab.windowId : null);
        console.log(`🔍 Checking if window ${checkWindowId} is a collaboration window...`);
        console.log(`📋 Workspace windows map:`, Array.from(workspaceWindows.entries()));
        
        if (!checkWindowId) {
          console.log('⚠️ No window ID provided');
          sendResponse({ isCollaboration: false, workspaceId: null });
          return true;
        }
        
        const isCollaboration = workspaceWindows.has(checkWindowId);
        let workspaceId = null;
        if (isCollaboration) {
          workspaceId = workspaceWindows.get(checkWindowId);
          console.log(`✅ Window ${checkWindowId} is workspace: ${workspaceId}`);
        } else {
          console.log(`ℹ️ Window ${checkWindowId} is NOT a workspace`);
        }
        
        sendResponse({ isCollaboration, workspaceId });
        return true;

      case 'getPendingSyncData':
        // Return all pending sync data
        const allPendingData = [];
        for (const [roomId, ops] of pendingSyncData.entries()) {
          allPendingData.push(...ops);
        }
        sendResponse({ pendingData: allPendingData });
        return true;

      case 'analyzeContent':
        // Acknowledge content analysis messages
        sendResponse({ success: true, message: 'Content analysis received' });
        return true;

      case 'test':
        sendResponse({ success: true, message: 'Test successful!' });
        return true;

      default:
        console.log(`⚠️ Unknown action: ${request.action}`);
        sendResponse({ error: 'Unknown action', receivedAction: request.action });
        return true;
    }
  } catch (error) {
    console.error('❌ Error in message handler:', error);
    sendResponse({ success: false, error: error.message });
    return true;
  }
});

// Initialize the extension
tabGroupManager.initialize()
  .then(success => {
    if (success) {
      console.log('🎉 Smart Tab Organizer extension loaded successfully!');
    } else {
      console.log('⚠️ Smart Tab Organizer loaded with limited functionality');
    }
  })
  .catch(error => {
    console.error('❌ Failed to initialize extension:', error);
  });