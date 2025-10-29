// Smart Tab Organizer Popup - Full Featured Dashboard
console.log('🎨 PopupManager initialized');

// Check if Firebase is loaded
function checkFirebase() {
  if (typeof firebase !== 'undefined') {
    console.log('✅ Firebase SDK loaded');
    return true;
  } else {
    console.error('❌ Firebase SDK not loaded');
    return false;
  }
}

// Wait for Firebase SDK to load
function waitForFirebase(maxAttempts = 20) {
  return new Promise((resolve) => {
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      if (typeof firebase !== 'undefined') {
        clearInterval(checkInterval);
        console.log('✅ Firebase SDK loaded after', attempts, 'attempts');
        console.log('Firebase object:', {
          apps: firebase.apps ? firebase.apps.length : 'no apps',
          SDK_VERSION: firebase.SDK_VERSION || 'unknown'
        });
        resolve(true);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        console.error('❌ Firebase SDK failed to load after', maxAttempts, 'attempts');
        console.error('Available globals:', Object.keys(window).filter(k => k.includes('firebase')));
        resolve(false);
      }
    }, 100);
  });
}

class PopupManager {
  constructor() {
    this.isInitialized = false;
    this.sessions = [];
    this.tabs = [];
    this.selectedTabs = new Set();
    this.currentView = 'grid'; // 'grid' or 'list'
    this.searchQuery = '';
    this.currentTabView = 'dashboard'; // 'dashboard' or 'sessions'
    this.currentWindowId = null; // Current window ID
    this.currentWorkspaceId = null; // Current workspace ID if window is part of one
    this.availableWindows = []; // List of all windows
    this.workspaceInfo = null; // Workspace info (participants, tabs, etc.)
    this.workspaceListener = null; // Firebase listener for workspace updates
    this.checkingWorkspace = false; // Flag to prevent multiple simultaneous checks
    this.init();
  }

  async init() {
    try {
      console.log('🔧 Initializing PopupManager...');
      
      // Detect current window first (with timeout, don't block)
      const windowDetectionPromise = Promise.race([
        this.detectCurrentWindow(),
        new Promise((resolve) => setTimeout(() => {
          console.warn('⏱️ Window detection taking too long, continuing...');
          resolve();
        }, 2000))
      ]);
      
      // Don't wait for window detection - continue initialization
      windowDetectionPromise.catch(error => {
        console.error('⚠️ Window detection failed:', error);
      });
      
      // Setup event listeners immediately (non-blocking)
      try {
        console.log('📋 Setting up event listeners...');
        this.setupEventListeners();
        console.log('✅ Event listeners setup');
      } catch (error) {
        console.error('⚠️ Error setting up event listeners:', error);
      }
      
      // Load sessions with timeout (non-blocking)
      console.log('📚 Loading sessions...');
      this.loadSessions().catch(error => {
        console.error('⚠️ Error loading sessions:', error);
      });
      
      // Wait a bit for window detection, then load tabs
      setTimeout(() => {
        // Load tabs with timeout (non-blocking)
        console.log('📑 Loading tabs...');
        this.loadTabs().catch(error => {
          console.error('⚠️ Error loading tabs:', error);
        });
      }, 100);
      
      // Mark as initialized immediately so UI can function
      this.isInitialized = true;
      console.log('✅ PopupManager initialized successfully');
      
      // Refresh when popup opens (check on focus) - debounced
      let refreshTimeout = null;
      window.addEventListener('focus', () => {
        if (this.isInitialized) {
          clearTimeout(refreshTimeout);
          refreshTimeout = setTimeout(() => {
            console.log('🔄 Popup focused, refreshing...');
            this.detectCurrentWindow().then(() => {
              this.loadTabs();
              // Delay workspace check to avoid conflicts
              setTimeout(() => {
                this.checkWorkspaceStatus().catch(() => {});
              }, 200);
            });
          }, 100);
        }
      });
      
      // Also refresh immediately on load (in case of cached popup) - but only once
      let initialRefreshDone = false;
      setTimeout(() => {
        if (this.isInitialized && !initialRefreshDone) {
          initialRefreshDone = true;
          console.log('🔄 Refreshing tabs on popup open...');
          this.detectCurrentWindow().then(() => {
            this.loadTabs();
            // Delay workspace check
            setTimeout(() => {
              this.checkWorkspaceStatus().catch(() => {});
            }, 300);
          });
        }
      }, 500);
      
      // Auto-connect to Firebase in background (non-blocking)
      console.log('🚀 Starting Firebase auto-connect...');
      this.autoConnectFirebase().catch(error => {
        console.error('Background Firebase connect error:', error);
      });
    } catch (error) {
      console.error('❌ PopupManager initialization failed:', error);
      this.isInitialized = true; // Still mark as initialized so UI works
      this.showStatus('Failed to initialize popup', 'error');
    }
  }

  async detectCurrentWindow() {
    try {
      console.log('🔍 Detecting current window...');
      
      // Get the current active tab to determine which window we're in
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab && activeTab.windowId) {
        this.currentWindowId = activeTab.windowId;
        console.log(`✅ Detected current window: ${this.currentWindowId}`);
      } else {
        // Fallback: get all windows and use the first one
        const windows = await chrome.windows.getAll();
        if (windows.length > 0) {
          this.currentWindowId = windows[0].id;
          console.log(`⚠️ Using fallback window: ${this.currentWindowId}`);
        }
      }
      
      console.log('✅ Window detection completed');
      
      // Check if this window is part of a workspace (non-blocking, don't wait, fire and forget)
      // Delay to ensure Firebase might be ready
      setTimeout(() => {
        this.checkWorkspaceStatus().catch(error => {
          console.warn('⚠️ Error checking workspace status (non-critical):', error.message);
        });
      }, 500);
      
      // Load all windows for the selector (non-blocking, don't wait, fire and forget)
      setTimeout(() => {
        this.loadAvailableWindows().catch(error => {
          console.warn('⚠️ Error loading windows (non-critical):', error.message);
        });
      }, 0);
      
    } catch (error) {
      console.error('❌ Error detecting current window:', error);
      // Set a default window ID if detection fails
      try {
        const windows = await chrome.windows.getAll();
        if (windows.length > 0) {
          this.currentWindowId = windows[0].id;
          console.log(`✅ Set fallback window: ${this.currentWindowId}`);
        }
      } catch (e) {
        console.error('Failed to get fallback window:', e);
      }
    }
  }

  async checkWorkspaceStatus() {
    // Prevent multiple simultaneous checks
    if (this.checkingWorkspace) {
      console.log('⏸️ Workspace check already in progress, skipping...');
      return;
    }

    try {
      if (!this.currentWindowId) {
        console.log('⚠️ No window ID available for workspace check');
        return;
      }
      
      this.checkingWorkspace = true;
      console.log(`🔍 Checking workspace status for window ${this.currentWindowId}...`);
      
      // Reset workspace state before checking
      this.currentWorkspaceId = null;
      this.workspaceInfo = null;
      
      // Set a timeout to prevent infinite checking
      const checkTimeout = setTimeout(() => {
        console.log('⏱️ Workspace check timeout, resetting flag');
        this.checkingWorkspace = false;
      }, 10000); // 10 second timeout
      
      // First try: check via background script (with shorter timeout)
      let response = null;
      try {
        // First, test if background script is responsive
        const testResponse = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'test' },
            (response) => {
              if (chrome.runtime.lastError) {
                resolve(null);
                return;
              }
              resolve(response);
            }
          );
        });
        
        if (testResponse) {
          console.log('✅ Background script is responsive');
        } else {
          console.warn('⚠️ Background script not responding to test message');
        }
        
        const responsePromise = new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { action: 'isCollaborationWindow', windowId: this.currentWindowId },
            (response) => {
              if (chrome.runtime.lastError) {
                console.warn('⚠️ Chrome runtime error:', chrome.runtime.lastError.message);
                resolve(null);
                return;
              }
              resolve(response);
            }
          );
        });
        
        const timeoutPromise = new Promise((resolve) => {
          setTimeout(() => {
            console.log('⏱️ Background check timeout, trying Firebase fallback...');
            resolve(null);
          }, 2000); // Increased to 2 seconds
        });
        
        response = await Promise.race([responsePromise, timeoutPromise]);
        
        if (response && response.isCollaboration) {
          console.log(`✅ Background check found workspace: ${response.workspaceId}`);
        }
      } catch (error) {
        console.warn('⚠️ Background check failed:', error.message);
      }
      
      // Fallback: check Firebase directly if Firebase is initialized
      if (!response && window.popupFirebaseHandler && window.popupFirebaseHandler.db && window.popupFirebaseHandler.isInitialized) {
        console.log('🔄 Trying Firebase fallback for workspace detection...');
        console.log(`🔍 Looking for workspaces with windowId matching: ${this.currentWindowId}`);
        try {
          // Check all syncRooms to find which one has this window
          const roomsSnapshot = await window.popupFirebaseHandler.db
            .collection('syncRooms')
            .limit(50) // Limit to prevent too many reads
            .get();
          
          console.log(`📋 Checking ${roomsSnapshot.docs.length} rooms in Firebase...`);
          
          if (roomsSnapshot.docs.length === 0) {
            console.log('ℹ️ No workspaces found in Firebase. Create a workspace first!');
          } else {
            console.log(`📋 Found ${roomsSnapshot.docs.length} rooms to check`);
            for (const roomDoc of roomsSnapshot.docs) {
              try {
                console.log(`🔍 Checking room: ${roomDoc.id}`);
                const roomData = roomDoc.data();
                console.log(`📋 Room data:`, roomData);
                
                const workspaceStateRef = roomDoc.ref.collection('workspace').doc('state');
                const workspaceState = await workspaceStateRef.get();
                
                if (workspaceState.exists()) {
                  const stateData = workspaceState.data();
                  const windowId = stateData.windowId;
                  const currentWindowId = this.currentWindowId;
                  
                  console.log(`📋 Room ${roomDoc.id} workspace state:`, stateData);
                  
                  // Convert both to numbers for comparison
                  const windowIdNum = typeof windowId === 'number' ? windowId : parseInt(windowId);
                  const currentWindowIdNum = typeof currentWindowId === 'number' ? currentWindowId : parseInt(currentWindowId);
                  
                  console.log(`📋 Room ${roomDoc.id}: windowId=${windowId} (${windowIdNum}), current=${currentWindowId} (${currentWindowIdNum}), match=${windowIdNum === currentWindowIdNum}`);
                  
                  // Compare as numbers
                  if (windowIdNum === currentWindowIdNum || windowId == currentWindowId) {
                    response = {
                      isCollaboration: true,
                      workspaceId: roomDoc.id
                    };
                    console.log(`✅ Found workspace via Firebase: ${roomDoc.id} for window ${currentWindowId}`);
                    break;
                  }
                } else {
                  console.log(`⚠️ Room ${roomDoc.id} has no workspace state document`);
                  
                  // If this is an active workspace, create the missing state document
                  if (roomData && roomData.isActive) {
                    console.log(`🔄 Room ${roomDoc.id} is active but missing state, attempting to create...`);
                    try {
                      await workspaceStateRef.set({
                        windowId: this.currentWindowId,
                        tabs: [],
                        lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
                        updatedBy: window.popupFirebaseHandler.userId
                      });
                      console.log(`✅ Created missing workspace state for ${roomDoc.id}`);
                      
                      // Now check if this window matches
                      response = {
                        isCollaboration: true,
                        workspaceId: roomDoc.id
                      };
                      console.log(`✅ Created state and detected workspace: ${roomDoc.id}`);
                      break;
                    } catch (createError) {
                      console.warn(`⚠️ Could not create workspace state:`, createError.message);
                    }
                  } else {
                    console.log(`ℹ️ Room ${roomDoc.id} is not active, skipping`);
                  }
                }
              } catch (docError) {
                console.warn(`⚠️ Error checking room ${roomDoc.id}:`, docError.message);
                // Skip rooms that don't have workspace state
                continue;
              }
            }
          }
        } catch (firebaseError) {
          console.warn('⚠️ Firebase fallback failed:', firebaseError.message);
          console.error('Firebase error details:', firebaseError);
        }
      } else if (!response && (!window.popupFirebaseHandler || !window.popupFirebaseHandler.db || !window.popupFirebaseHandler.isInitialized)) {
        console.log('⏳ Firebase not ready yet, workspace check will retry later');
        console.log('Firebase status:', {
          handler: !!window.popupFirebaseHandler,
          db: !!window.popupFirebaseHandler?.db,
          initialized: window.popupFirebaseHandler?.isInitialized
        });
      }
      
      console.log(`📊 Workspace check complete: window ${this.currentWindowId}, workspace: ${response?.workspaceId || 'none'}`);
      console.log('Response object:', response);
      
      if (response && response.isCollaboration && response.workspaceId) {
        this.currentWorkspaceId = response.workspaceId;
        console.log(`✅ Window ${this.currentWindowId} is part of workspace: ${this.currentWorkspaceId}`);
        this.updateWorkspaceIndicator();
        // Load workspace info and start listening for updates
        await this.loadWorkspaceInfo();
        this.startWorkspaceListener();
      } else {
        this.currentWorkspaceId = null;
        this.workspaceInfo = null;
        this.stopWorkspaceListener();
        console.log(`ℹ️ Window ${this.currentWindowId} is not part of a workspace`);
        console.log('💡 Tip: Make sure you created/joined the workspace and opened the popup from that workspace window');
        this.updateWorkspaceIndicator();
      }
    } catch (error) {
      console.error('❌ Error checking workspace status:', error);
      // Don't fail - just continue without workspace info
      this.currentWorkspaceId = null;
      this.workspaceInfo = null;
      this.updateWorkspaceIndicator();
      } finally {
        this.checkingWorkspace = false;
        if (typeof checkTimeout !== 'undefined') {
          clearTimeout(checkTimeout);
        }
      }
  }

  async loadWorkspaceInfo() {
    try {
      if (!this.currentWorkspaceId || !window.popupFirebaseHandler || !window.popupFirebaseHandler.db) {
        return;
      }

      console.log(`📋 Loading workspace info for ${this.currentWorkspaceId}...`);
      
      // Get room info
      const roomDoc = await window.popupFirebaseHandler.db
        .collection('syncRooms')
        .doc(this.currentWorkspaceId)
        .get();
      
      if (!roomDoc.exists) {
        console.warn('⚠️ Workspace room not found');
        return;
      }

      const roomData = roomDoc.data();
      
      // Get workspace state (tabs)
      const workspaceDoc = await window.popupFirebaseHandler.db
        .collection('syncRooms')
        .doc(this.currentWorkspaceId)
        .collection('workspace')
        .doc('state')
        .get();
      
      const workspaceData = workspaceDoc.exists ? workspaceDoc.data() : null;
      
      this.workspaceInfo = {
        roomId: this.currentWorkspaceId,
        sessionName: roomData.sessionName || 'Unnamed Workspace',
        participants: roomData.participants || [],
        createdAt: roomData.createdAt,
        tabs: workspaceData?.tabs || [],
        lastUpdate: workspaceData?.lastUpdate,
        updatedBy: workspaceData?.updatedBy
      };
      
      console.log(`✅ Loaded workspace info: ${this.workspaceInfo.participants.length} participants, ${this.workspaceInfo.tabs.length} tabs`);
      this.updateWorkspaceIndicator();
    } catch (error) {
      console.error('❌ Error loading workspace info:', error);
    }
  }

  startWorkspaceListener() {
    try {
      if (!this.currentWorkspaceId || !window.popupFirebaseHandler || !window.popupFirebaseHandler.db) {
        return;
      }

      // Stop existing listener if any
      this.stopWorkspaceListener();

      console.log(`👂 Starting workspace listener for ${this.currentWorkspaceId}...`);
      
      // Listen to workspace state changes
      this.workspaceListener = window.popupFirebaseHandler.db
        .collection('syncRooms')
        .doc(this.currentWorkspaceId)
        .collection('workspace')
        .doc('state')
        .onSnapshot((doc) => {
          if (doc.exists()) {
            const workspaceData = doc.data();
            if (this.workspaceInfo) {
              this.workspaceInfo.tabs = workspaceData.tabs || [];
              this.workspaceInfo.lastUpdate = workspaceData.lastUpdate;
              this.workspaceInfo.updatedBy = workspaceData.updatedBy;
              console.log(`🔄 Workspace updated: ${this.workspaceInfo.tabs.length} tabs`);
              this.updateWorkspaceIndicator();
            }
          }
        }, (error) => {
          console.error('❌ Workspace listener error:', error);
        });
    } catch (error) {
      console.error('❌ Error starting workspace listener:', error);
    }
  }

  stopWorkspaceListener() {
    if (this.workspaceListener) {
      this.workspaceListener();
      this.workspaceListener = null;
      console.log('🛑 Stopped workspace listener');
    }
  }

  async loadAvailableWindows() {
    try {
      const windows = await chrome.windows.getAll({ populate: false });
      this.availableWindows = windows.map(win => ({
        id: win.id,
        title: win.title || `Window ${win.id}`,
        focused: win.focused
      }));
      console.log(`✅ Loaded ${this.availableWindows.length} windows`);
      this.updateWindowSelector();
    } catch (error) {
      console.error('❌ Error loading windows:', error);
    }
  }

  updateWorkspaceIndicator() {
    const header = document.querySelector('.header p');
    const workspaceBanner = document.getElementById('workspaceBanner');
    
    if (this.currentWorkspaceId && this.workspaceInfo) {
      // Update header subtitle
      if (header) {
        header.textContent = `Workspace: ${this.currentWorkspaceId} • ${this.workspaceInfo.participants.length} participant${this.workspaceInfo.participants.length !== 1 ? 's' : ''}`;
      }
      
      // Show workspace banner
      if (workspaceBanner) {
        workspaceBanner.style.display = 'block';
        const workspaceInfo = document.getElementById('workspaceInfo');
        if (workspaceInfo) {
          workspaceInfo.innerHTML = `
            <div class="workspace-header">
              <strong>🔗 ${this.workspaceInfo.sessionName || this.currentWorkspaceId}</strong>
              <span class="workspace-id">ID: ${this.currentWorkspaceId}</span>
            </div>
            <div class="workspace-details">
              <div class="workspace-participants">
                👥 ${this.workspaceInfo.participants.length} participant${this.workspaceInfo.participants.length !== 1 ? 's' : ''}
              </div>
              <div class="workspace-tabs-count">
                📑 ${this.workspaceInfo.tabs.length} synced tab${this.workspaceInfo.tabs.length !== 1 ? 's' : ''}
              </div>
            </div>
          `;
        }
      }
    } else {
      // Hide workspace banner
      if (workspaceBanner) {
        workspaceBanner.style.display = 'none';
      }
      
      // Update header subtitle
      if (header) {
        header.textContent = 'AI-powered tab management';
      }
    }
  }

  updateWindowSelector() {
    const windowSelector = document.getElementById('windowSelector');
    if (!windowSelector) return;
    
    // Clear existing options
    windowSelector.innerHTML = '';
    
    // Add options for each window
    this.availableWindows.forEach(win => {
      const option = document.createElement('option');
      option.value = win.id;
      option.textContent = `${win.focused ? '⭐ ' : ''}Window ${win.id}${this.currentWorkspaceId && win.id === this.currentWindowId ? ` (Workspace: ${this.currentWorkspaceId})` : ''}`;
      option.selected = win.id === this.currentWindowId;
      windowSelector.appendChild(option);
    });
    
    // Show selector if there are multiple windows
    if (this.availableWindows.length > 1) {
      windowSelector.style.display = 'block';
    } else {
      windowSelector.style.display = 'none';
    }
  }

  async autoConnectFirebase() {
    try {
      // Wait for Firebase SDK to load (with timeout)
      console.log('⏳ Waiting for Firebase SDK to load...');
      const firebaseLoaded = await Promise.race([
        waitForFirebase(20), // Try for 2 seconds
        new Promise((resolve) => setTimeout(() => resolve(false), 2000))
      ]);

      if (!firebaseLoaded) {
        console.error('❌ Firebase SDK not loaded after timeout');
        document.getElementById('syncStatus').textContent = 'Firebase SDK not loaded';
        return;
      }

      // Use the default Tably Firebase configuration
      const defaultFirebaseConfig = {
        apiKey: "AIzaSyC1EmR1SaabQ1FWaPEFuFZEJ-XdS07xoZs",
        authDomain: "tably-cddfb.firebaseapp.com",
        projectId: "tably-cddfb",
        storageBucket: "tably-cddfb.firebasestorage.app",
        messagingSenderId: "481605885317",
        appId: "1:481605885317:web:41fa8c66ac9d4ab547b8ec",
        measurementId: "G-T4Z21DJTSY"
      };

      console.log('📱 Auto-connecting to Tably Firebase...');
      
      document.getElementById('syncStatus').textContent = 'Connecting...';
      
      // Auto-initialize Firebase with timeout
      const initPromise = this.initializeFirebase();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Firebase initialization timeout')), 10000);
      });

      try {
        await Promise.race([initPromise, timeoutPromise]);
        console.log('✅ Firebase connected successfully');
      } catch (error) {
        console.error('Auto-connect failed:', error);
        document.getElementById('syncStatus').textContent = 'Connection failed';
        // Don't show error to user, just set status
      }
      
      // Process pending sync data in background (non-blocking)
      setTimeout(() => {
        this.processPendingSyncData().catch(error => {
          console.error('Error processing pending sync data:', error);
        });
      }, 100);
    } catch (error) {
      console.error('❌ Error in autoConnectFirebase:', error);
      document.getElementById('syncStatus').textContent = 'Connection failed';
    }
  }

  async processPendingSyncData() {
    try {
      // Request pending sync data from background script
      const response = await chrome.runtime.sendMessage({
        action: 'getPendingSyncData'
      });
      
      if (response && response.pendingData && response.pendingData.length > 0) {
        console.log(`📤 Processing ${response.pendingData.length} pending sync operations`);
        
        // Process in batches to avoid blocking
        for (const op of response.pendingData) {
          try {
            if (op.action === 'syncTabToFirebase') {
              await window.popupFirebaseHandler.syncTabToFirebase(op.roomId, op.tab, op.syncAction);
            } else if (op.action === 'syncTabRemovalToFirebase') {
              await window.popupFirebaseHandler.syncTabRemovalToFirebase(op.roomId, op.tabId);
            }
            // Small delay to prevent blocking
            await new Promise(resolve => setTimeout(resolve, 10));
          } catch (error) {
            console.error('Failed to process pending sync operation:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error processing pending sync data:', error);
    }
  }

  setupEventListeners() {
    try {
      // Navigation tabs
      const navTabs = document.querySelectorAll('.nav-tab');
      if (navTabs.length > 0) {
        navTabs.forEach(tab => {
          tab.addEventListener('click', (e) => {
            const view = e.target.dataset.view;
            this.switchTabView(view);
          });
        });
      }

      // View toggle (grid/list)
      const gridViewBtn = document.getElementById('gridViewBtn');
      if (gridViewBtn) {
        gridViewBtn.addEventListener('click', () => {
          this.setViewMode('grid');
        });
      }

      const listViewBtn = document.getElementById('listViewBtn');
      if (listViewBtn) {
        listViewBtn.addEventListener('click', () => {
          this.setViewMode('list');
        });
      }

    // Search bar
    const searchBar = document.getElementById('searchBar');
    const searchBarSessions = document.getElementById('searchBarSessions');
    
    if (searchBar) {
      searchBar.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderTabs();
      });
    }
    
    if (searchBarSessions) {
      searchBarSessions.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderSessions();
      });
    }

      // Dashboard actions
      const organizeBtn = document.getElementById('organizeBtn');
      if (organizeBtn) {
        organizeBtn.addEventListener('click', () => {
          this.organizeTabs();
        });
      }

      const groupSelectedBtn = document.getElementById('groupSelectedBtn');
      if (groupSelectedBtn) {
        groupSelectedBtn.addEventListener('click', () => {
          this.groupSelectedTabs();
        });
      }

      const ungroupBtn = document.getElementById('ungroupBtn');
      if (ungroupBtn) {
        ungroupBtn.addEventListener('click', () => {
          this.ungroupAllTabs();
        });
      }

      // Session Management
      const saveBtn = document.getElementById('saveBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => {
          this.saveSession();
        });
      }

      const sessionNameInput = document.getElementById('sessionNameInput');
      if (sessionNameInput) {
        sessionNameInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.saveSession();
          }
        });
      }

      const refreshBtn = document.getElementById('refreshBtn');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          this.loadSessions();
          this.loadTabs();
        });
      }

      // Import shared session
      const importBtn = document.getElementById('importBtn');
      if (importBtn) {
        importBtn.addEventListener('click', () => {
          this.showImportDialog();
        });
      }

      const importUrlInput = document.getElementById('importUrlInput');
      if (importUrlInput) {
        importUrlInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            this.importSharedSession();
          }
        });
      }

      const importConfirmBtn = document.getElementById('importConfirmBtn');
      if (importConfirmBtn) {
        importConfirmBtn.addEventListener('click', () => {
          this.importSharedSession();
        });
      }

      const importCancelBtn = document.getElementById('importCancelBtn');
      if (importCancelBtn) {
        importCancelBtn.addEventListener('click', () => {
          this.hideImportDialog();
        });
      }

      const shareCloseBtn = document.getElementById('shareCloseBtn');
      if (shareCloseBtn) {
        shareCloseBtn.addEventListener('click', () => {
          this.hideShareDialog();
        });
      }

      // Firebase Sync - auto-connects, no manual config needed
      const createWorkspaceBtn = document.getElementById('createWorkspaceBtn');
      if (createWorkspaceBtn) {
        createWorkspaceBtn.addEventListener('click', () => {
          this.createWorkspace();
        });
      }

      const joinWorkspaceBtn = document.getElementById('joinWorkspaceBtn');
      if (joinWorkspaceBtn) {
        joinWorkspaceBtn.addEventListener('click', () => {
          this.joinWorkspace();
        });
      }

      const leaveWorkspaceBtn = document.getElementById('leaveWorkspaceBtn');
      if (leaveWorkspaceBtn) {
        leaveWorkspaceBtn.addEventListener('click', () => {
          this.leaveWorkspace();
        });
      }

      // Listen for sync updates
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'syncUpdate') {
          this.handleSyncUpdate(message.sessionData);
        }
      });

      // Window selector
      const windowSelector = document.getElementById('windowSelector');
      if (windowSelector) {
        windowSelector.addEventListener('change', (e) => {
          const windowId = parseInt(e.target.value);
          if (windowId && windowId !== this.currentWindowId) {
            this.switchWindow(windowId);
          }
        });
      }
    } catch (error) {
      console.error('⚠️ Error in setupEventListeners:', error);
      throw error; // Re-throw to be caught by init()
    }
  }

  async createWorkspace() {
    try {
      const workspaceIdInput = document.getElementById('workspaceIdInput');
      if (!workspaceIdInput) {
        console.error('workspaceIdInput element not found');
        this.showStatus('Error: Workspace input not found', 'error');
        return;
      }
      
      let workspaceId = workspaceIdInput.value.trim().toUpperCase();
      
      // Generate workspace ID if not provided
      if (!workspaceId) {
        workspaceId = this.generateWorkspaceId();
        workspaceIdInput.value = workspaceId;
      }

      this.showStatus('Creating workspace...', 'loading');

      const response = await window.popupFirebaseHandler.createCollaborationWorkspace(workspaceId);

      if (response.success) {
        this.showStatus(`Workspace "${workspaceId}" created! New window opened. Open the popup from the workspace window to see workspace features.`, 'success');
        workspaceIdInput.value = workspaceId;
        
        // Wait a moment for the window to be created and registered
        setTimeout(async () => {
          // Switch to the workspace window
          try {
            await chrome.windows.update(response.windowId, { focused: true });
            console.log(`🔄 Switched to workspace window ${response.windowId}`);
            
            // Wait a bit for the window switch to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Refresh window detection to get the new workspace window
            await this.detectCurrentWindow();
            // Check workspace status - should now detect the workspace
            await this.checkWorkspaceStatus();
            // Reload tabs to show workspace tabs
            await this.loadTabs();
          } catch (error) {
            console.warn('⚠️ Could not switch to workspace window:', error);
            // Fallback: just refresh detection
            await this.detectCurrentWindow();
            await this.checkWorkspaceStatus();
            await this.loadTabs();
          }
        }, 1000);
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error creating workspace:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async joinWorkspace() {
    try {
      const workspaceIdInput = document.getElementById('workspaceIdInput');
      if (!workspaceIdInput) {
        console.error('workspaceIdInput element not found');
        this.showStatus('Error: Workspace input not found', 'error');
        return;
      }
      
      const workspaceId = workspaceIdInput.value.trim().toUpperCase();
      
      if (!workspaceId) {
        this.showStatus('Please enter a workspace ID', 'error');
        return;
      }

      this.showStatus(`Joining workspace "${workspaceId}"...`, 'loading');

      const response = await window.popupFirebaseHandler.joinCollaborationWorkspace(workspaceId);

      if (response.success) {
        this.showStatus(`Joined workspace "${workspaceId}"! New window opened. Open the popup from the workspace window to see workspace features.`, 'success');
        workspaceIdInput.value = workspaceId;
        
        // Wait a moment for the window to be created and registered
        setTimeout(async () => {
          // Switch to the workspace window
          try {
            await chrome.windows.update(response.windowId, { focused: true });
            console.log(`🔄 Switched to workspace window ${response.windowId}`);
            
            // Wait a bit for the window switch to complete
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Refresh window detection to get the new workspace window
            await this.detectCurrentWindow();
            // Check workspace status - should now detect the workspace
            await this.checkWorkspaceStatus();
            // Reload tabs to show workspace tabs
            await this.loadTabs();
          } catch (error) {
            console.warn('⚠️ Could not switch to workspace window:', error);
            // Fallback: just refresh detection
            await this.detectCurrentWindow();
            await this.checkWorkspaceStatus();
            await this.loadTabs();
          }
        }, 1000);
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error joining workspace:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async leaveWorkspace() {
    try {
      const workspaceIdInput = document.getElementById('workspaceIdInput');
      if (!workspaceIdInput) {
        console.error('workspaceIdInput element not found');
        this.showStatus('Error: Workspace input not found', 'error');
        return;
      }
      
      const workspaceId = workspaceIdInput.value.trim().toUpperCase();
      
      if (!workspaceId) {
        this.showStatus('Please enter a workspace ID', 'error');
        return;
      }

      this.showStatus('Leaving workspace...', 'loading');

      const response = await chrome.runtime.sendMessage({
        action: 'leaveCollaborationWorkspace',
        roomId: workspaceId // backend still uses roomId internally
      });

      if (response.success) {
        this.showStatus('Left workspace', 'success');
        workspaceIdInput.value = '';
        this.currentWorkspaceId = null;
        this.workspaceInfo = null;
        this.updateWorkspaceIndicator();
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error leaving workspace:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async detectWorkspace() {
    try {
      this.showStatus('Detecting workspace...', 'loading');
      
      // Reset checking flag to allow new check
      this.checkingWorkspace = false;
      
      // Force a fresh workspace check
      await this.checkWorkspaceStatus();
      
      if (this.currentWorkspaceId) {
        this.showStatus(`Found workspace: ${this.currentWorkspaceId}`, 'success');
      } else {
        this.showStatus('No workspace detected in current window', 'error');
      }
    } catch (error) {
      console.error('Error detecting workspace:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  generateWorkspaceId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  async initializeFirebase() {
    try {
      // Quick check: Is Firebase SDK loaded?
      if (typeof firebase === 'undefined') {
        console.error('❌ Firebase SDK not loaded');
        return false;
      }

      console.log('✅ Firebase SDK is loaded, version:', firebase.SDK_VERSION || 'unknown');

      // Wait for popupFirebaseHandler to be available
      let attempts = 0;
      while (!window.popupFirebaseHandler && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.popupFirebaseHandler) {
        console.error('❌ popupFirebaseHandler not available after waiting');
        return false;
      }

      console.log('✅ popupFirebaseHandler is available');

      // Always use the default Tably Firebase configuration
      const defaultFirebaseConfig = {
        apiKey: "AIzaSyC1EmR1SaabQ1FWaPEFuFZEJ-XdS07xoZs",
        authDomain: "tably-cddfb.firebaseapp.com",
        projectId: "tably-cddfb",
        storageBucket: "tably-cddfb.firebasestorage.app",
        messagingSenderId: "481605885317",
        appId: "1:481605885317:web:41fa8c66ac9d4ab547b8ec",
        measurementId: "G-T4Z21DJTSY"
      };

      const config = defaultFirebaseConfig;

      console.log('📋 Initializing Firebase with config:', {
        projectId: config.projectId,
        authDomain: config.authDomain
      });

      // Initialize Firebase in popup (quick operation)
      const success = await window.popupFirebaseHandler.initialize(config);

      if (success) {
        console.log('✅ Firebase initialized successfully');
        document.getElementById('syncControls').style.display = 'block';
        document.getElementById('syncStatus').textContent = 'Connected';
        document.getElementById('syncStatus').classList.add('connected');
        
        // Reload workspace info if we're in a workspace, or check again
        setTimeout(() => {
          // Re-check workspace status after Firebase is ready (only if not already checking)
          if (this.currentWindowId && !this.checkingWorkspace) {
            console.log('🔄 Re-checking workspace status after Firebase initialized...');
            this.checkWorkspaceStatus().catch(() => {});
          }
        }, 1000);
        
        return true;
      } else {
        console.error('❌ Firebase initialization returned false');
        document.getElementById('syncStatus').textContent = 'Connection failed';
        return false;
      }
    } catch (error) {
      console.error('❌ Error initializing Firebase:', error);
      console.error('Error stack:', error.stack);
      document.getElementById('syncStatus').textContent = 'Connection failed';
      return false;
    }
  }

  async createSyncRoom() {
    try {
      const sessionName = prompt('Enter session name to sync:');
      if (!sessionName) return;

      this.showStatus('Creating sync room...', 'loading');

      const response = await window.popupFirebaseHandler.createSyncRoom(sessionName);

      if (response.success) {
        document.getElementById('roomIdInput').value = response.roomId;
        this.showStatus(`Room created: ${response.roomId}`, 'success');
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error creating sync room:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async syncSessionToRoom(roomId, sessionName) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'syncSessionToRoom',
        roomId: roomId,
        sessionName: sessionName
      });

      if (response.success) {
        this.showStatus('Session synced successfully!', 'success');
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error syncing session:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async joinSyncRoom() {
    try {
      const roomIdInput = document.getElementById('roomIdInput');
      const roomId = roomIdInput.value.trim().toUpperCase();
      
      if (!roomId) {
        this.showStatus('Please enter a room ID', 'error');
        return;
      }

      this.showStatus(`Joining room ${roomId}...`, 'loading');

      const response = await chrome.runtime.sendMessage({
        action: 'joinSyncRoom',
        roomId: roomId
      });

      if (response.success) {
        this.showStatus(`Joined room: ${roomId}`, 'success');
        roomIdInput.value = roomId;
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error joining sync room:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async leaveSyncRoom() {
    try {
      this.showStatus('Leaving sync room...', 'loading');

      const response = await chrome.runtime.sendMessage({
        action: 'leaveSyncRoom'
      });

      if (response.success) {
        this.showStatus('Left sync room', 'success');
        document.getElementById('roomIdInput').value = '';
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error leaving sync room:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async handleSyncUpdate(sessionData) {
    try {
      console.log('📥 Received sync update:', sessionData);
      
      // Import the synced session
      const response = await chrome.runtime.sendMessage({
        action: 'importSharedSession',
        encodedData: btoa(JSON.stringify(sessionData))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=/g, '')
      });

      if (response.success) {
        this.showStatus('Session updated from sync!', 'success');
        await this.loadSessions();
      }
    } catch (error) {
      console.error('Error handling sync update:', error);
    }
  }

  switchTabView(view) {
    this.currentTabView = view;
    this.searchQuery = ''; // Clear search when switching views
    
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.classList.remove('active');
      if (tab.dataset.view === view) {
        tab.classList.add('active');
      }
    });

    document.querySelectorAll('.tab-view').forEach(viewEl => {
      viewEl.classList.remove('active');
    });

    if (view === 'dashboard') {
      document.getElementById('dashboardView').classList.add('active');
      const searchBar = document.getElementById('searchBar');
      if (searchBar) searchBar.value = '';
      // Refresh window info and tabs when switching to dashboard
      this.detectCurrentWindow().then(() => {
        this.loadTabs(); // Refresh tabs when switching to dashboard
        // Refresh workspace status
        this.checkWorkspaceStatus().catch(() => {});
      });
    } else {
      document.getElementById('sessionsView').classList.add('active');
      const searchBarSessions = document.getElementById('searchBarSessions');
      if (searchBarSessions) searchBarSessions.value = '';
      this.renderSessions();
    }
  }

  setViewMode(mode) {
    this.currentView = mode;
    
    document.getElementById('gridViewBtn').classList.toggle('active', mode === 'grid');
    document.getElementById('listViewBtn').classList.toggle('active', mode === 'list');
    
    const container = document.getElementById('tabsContainer');
    container.className = mode === 'grid' ? 'tabs-grid' : 'tabs-list';
    
    this.renderTabs();
  }

  async loadTabs() {
    try {
      console.log('📥 Loading tabs...');
      console.log(`🔍 Current window ID: ${this.currentWindowId || 'not set'}`);
      
      // Load tabs for current window only (or all if window not detected yet)
      const queryOptions = this.currentWindowId 
        ? { windowId: this.currentWindowId }
        : {};
      
      // Add timeout to prevent hanging
      const tabsPromise = chrome.tabs.query(queryOptions);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Load tabs timeout')), 3000);
      });
      
      const tabs = await Promise.race([tabsPromise, timeoutPromise]);
      this.tabs = tabs || [];
      console.log(`✅ Loaded ${this.tabs.length} tabs from window ${this.currentWindowId || 'all'}`);
      
      this.renderTabs();
    } catch (error) {
      console.error('⚠️ Error loading tabs:', error);
      // Don't show error to user, just use empty tabs
      this.tabs = [];
      this.renderTabs();
    }
  }

  async switchWindow(windowId) {
    try {
      this.currentWindowId = windowId;
      await this.checkWorkspaceStatus();
      await this.loadTabs();
      this.updateWindowSelector();
      console.log(`✅ Switched to window ${windowId}`);
    } catch (error) {
      console.error('❌ Error switching window:', error);
    }
  }

  getFilteredTabs() {
    if (!this.searchQuery) {
      return this.tabs;
    }

    return this.tabs.filter(tab => {
      const title = (tab.title || '').toLowerCase();
      const url = (tab.url || '').toLowerCase();
      return title.includes(this.searchQuery) || url.includes(this.searchQuery);
    });
  }

  renderTabs() {
    const container = document.getElementById('tabsContainer');
    const filteredTabs = this.getFilteredTabs();
    const tabCountEl = document.getElementById('tabCount');

    if (filteredTabs.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-state-icon">🔍</div>
          <div>No tabs found</div>
        </div>
      `;
      let countText = 'No tabs found';
      if (this.currentWindowId) {
        countText += ` in Window ${this.currentWindowId}`;
      }
      if (this.currentWorkspaceId) {
        countText += ` (Workspace: ${this.currentWorkspaceId})`;
      }
      tabCountEl.textContent = countText;
      return;
    }

    let countText = `${filteredTabs.length} tab${filteredTabs.length !== 1 ? 's' : ''}`;
    if (this.currentWindowId) {
      countText += ` in Window ${this.currentWindowId}`;
    }
    if (this.currentWorkspaceId) {
      countText += ` • Workspace: ${this.currentWorkspaceId}`;
    }
    if (this.searchQuery) {
      countText += ' (filtered)';
    }
    tabCountEl.textContent = countText;

    container.innerHTML = filteredTabs.map(tab => {
      const isSelected = this.selectedTabs.has(tab.id);
      const viewClass = this.currentView;
      
      // Create a better fallback icon based on domain
      let favIcon = tab.favIconUrl;
      if (!favIcon || favIcon.startsWith('chrome://') || favIcon.startsWith('chrome-extension://')) {
        const domain = tab.url ? new URL(tab.url).hostname.replace('www.', '') : '';
        const iconColor = this.getDomainColor(domain);
        const iconLetter = domain.charAt(0).toUpperCase() || '?';
        // Properly encode SVG to avoid breaking HTML
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="${iconColor}" rx="4"/><text x="16" y="22" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold">${iconLetter}</text></svg>`;
        favIcon = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
      }
      
      const domain = tab.url ? new URL(tab.url).hostname.replace('www.', '') : '';
      
      // Get group info if available
      const groupInfo = tab.groupId !== chrome.tabGroups.TAB_GROUP_ID_NONE 
        ? `<div class="tab-group-indicator">Grouped</div>` 
        : '';

      return `
        <div class="tab-item ${viewClass} ${isSelected ? 'selected' : ''}" 
             data-tab-id="${tab.id}"
             data-action="select-tab"
             title="Click to select, double-click to switch">
          <img src="${favIcon}" class="tab-icon ${viewClass}" alt="" data-favicon>
          <div class="tab-content">
            <div class="tab-title">${this.escapeHtml(tab.title || 'Untitled')}</div>
            <div class="tab-url">${this.escapeHtml(domain)}</div>
            ${groupInfo}
          </div>
        </div>
      `;
    }).join('');

    // Attach event listeners to tab items
    container.querySelectorAll('[data-action="select-tab"]').forEach(item => {
      const tabId = parseInt(item.dataset.tabId);
      
      // Single click to select
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleTabSelection(tabId);
      });
      
      // Double click to switch
      item.addEventListener('dblclick', (e) => {
        e.preventDefault();
        this.switchToTab(tabId);
      });
    });

    // Handle image load errors - create fallback icon
    container.querySelectorAll('[data-favicon]').forEach(img => {
      img.addEventListener('error', () => {
        // Get the tab ID from parent
        const tabItem = img.closest('[data-tab-id]');
        if (tabItem) {
          const tabId = parseInt(tabItem.dataset.tabId);
          const tab = this.tabs.find(t => t.id === tabId);
          if (tab) {
            const domain = tab.url ? new URL(tab.url).hostname.replace('www.', '') : '';
            const iconColor = this.getDomainColor(domain);
            const iconLetter = domain.charAt(0).toUpperCase() || '?';
            const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="${iconColor}" rx="4"/><text x="16" y="22" text-anchor="middle" fill="white" font-family="Arial" font-size="14" font-weight="bold">${iconLetter}</text></svg>`;
            img.src = `data:image/svg+xml,${encodeURIComponent(svgContent)}`;
          }
        }
      });
    });

    // Update group selected button state
    document.getElementById('groupSelectedBtn').disabled = this.selectedTabs.size < 2;
  }

  toggleTabSelection(tabId) {
    if (this.selectedTabs.has(tabId)) {
      this.selectedTabs.delete(tabId);
    } else {
      this.selectedTabs.add(tabId);
    }
    this.renderTabs();
  }

  async switchToTab(tabId) {
    try {
      await chrome.tabs.update(tabId, { active: true });
      const tab = await chrome.tabs.get(tabId);
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
    } catch (error) {
      console.error('Error switching to tab:', error);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getDomainColor(domain) {
    // Generate consistent colors based on domain
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8C471', '#82E0AA', '#F1948A', '#85C1E9', '#D7BDE2'
    ];
    
    if (!domain) return '#95A5A6';
    
    let hash = 0;
    for (let i = 0; i < domain.length; i++) {
      hash = domain.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }

  async organizeTabs() {
    try {
      this.showStatus('Organizing tabs...', 'loading');
      
      const response = await chrome.runtime.sendMessage({ 
        action: 'organizeTabs',
        windowId: this.currentWindowId // Send current window ID
      });
      
      if (response.success) {
        this.showStatus('Tabs organized successfully!', 'success');
        await this.loadTabs();
        this.selectedTabs.clear();
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error organizing tabs:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async groupSelectedTabs() {
    try {
      if (this.selectedTabs.size < 2) {
        this.showStatus('Please select at least 2 tabs', 'error');
        return;
      }

      this.showStatus('Grouping tabs...', 'loading');
      
      const tabIds = Array.from(this.selectedTabs);
      const response = await chrome.runtime.sendMessage({ 
        action: 'groupTabs',
        tabIds: tabIds
      });
      
      if (response.success) {
        this.showStatus(`Grouped ${tabIds.length} tabs successfully!`, 'success');
        this.selectedTabs.clear();
        await this.loadTabs();
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error grouping tabs:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async ungroupAllTabs() {
    try {
      console.log('🗂️ Starting ungroup all tabs...');
      this.showStatus('Ungrouping tabs...', 'loading');
      
      const response = await chrome.runtime.sendMessage({ action: 'ungroupAllTabs' });
      
      console.log('📥 Received response:', response);
      
      if (response.success) {
        this.showStatus(response.message || 'All tabs ungrouped successfully!', 'success');
        await this.loadTabs();
        this.selectedTabs.clear();
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error ungrouping tabs:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async saveSession() {
    try {
      const sessionName = document.getElementById('sessionNameInput').value.trim();
      
      if (!sessionName) {
        this.showStatus('Please enter a session name', 'error');
        return;
      }

      this.showStatus('Saving session...', 'loading');
      
      const response = await chrome.runtime.sendMessage({ 
        action: 'saveSession', 
        name: sessionName 
      });
      
      if (response.success) {
        this.showStatus(response.message, 'success');
        document.getElementById('sessionNameInput').value = '';
        await this.loadSessions();
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async loadSession(sessionName) {
    try {
      this.showStatus(`Loading session: ${sessionName}...`, 'loading');
      
      const response = await chrome.runtime.sendMessage({
        action: 'loadSession',
        name: sessionName,
        options: { replace: true }
      });
      
      if (response.success) {
        this.showStatus(response.message, 'success');
        await this.loadTabs();
        // Switch to dashboard view to see loaded tabs
        setTimeout(() => this.switchTabView('dashboard'), 1000);
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error loading session:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async deleteSession(sessionName) {
    try {
      if (!confirm(`Are you sure you want to delete session "${sessionName}"?`)) {
        return;
      }

      this.showStatus('Deleting session...', 'loading');
      
      const response = await chrome.runtime.sendMessage({ action: 'getSavedSessions' });
      
      if (response.success) {
        const sessions = response.sessions.filter(s => s.name !== sessionName);
        
        await chrome.storage.local.set({ sessions: sessions });
        
        this.showStatus('Session deleted successfully', 'success');
        await this.loadSessions();
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  async loadSessions() {
    try {
      console.log('📥 Loading sessions...');
      
      // Load directly from storage - faster and more reliable than going through background script
      // since we're just reading data, not doing any processing
      const result = await chrome.storage.local.get(['sessions']);
      this.sessions = result.sessions || [];
      this.renderSessions();
      console.log(`✅ Loaded ${this.sessions.length} sessions`);
    } catch (error) {
      console.error('⚠️ Error loading sessions:', error);
      // Don't show error to user, just use empty sessions
      this.sessions = [];
      this.renderSessions();
    }
  }

  renderSessions() {
    const sessionList = document.getElementById('sessionList');
    
    if (this.sessions.length === 0) {
      sessionList.innerHTML = '<div class="status">No saved sessions</div>';
      return;
    }

    // Filter sessions by search query if applicable
    let filteredSessions = this.sessions;
    if (this.searchQuery) {
      filteredSessions = this.sessions.filter(session => 
        session.name.toLowerCase().includes(this.searchQuery)
      );
    }

    if (filteredSessions.length === 0) {
      sessionList.innerHTML = `<div class="status">No sessions match "${this.searchQuery}"</div>`;
      return;
    }

    // Clear and rebuild session list
    sessionList.innerHTML = '';
    
    filteredSessions.forEach((session, index) => {
      const date = new Date(session.timestamp);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString();
      const tabCount = session.tabs ? session.tabs.length : 0;
      const safeSessionName = this.escapeHtml(session.name);
      
      const sessionItem = document.createElement('div');
      sessionItem.className = 'session-item';
      sessionItem.innerHTML = `
        <div>
          <div class="session-name">${safeSessionName}</div>
          <div class="session-date">${dateStr} ${timeStr} • ${tabCount} tabs</div>
        </div>
        <div class="session-actions">
          <button class="primary" data-action="load-session" data-session-index="${index}">Load</button>
          <button class="secondary" data-action="share-session" data-session-index="${index}">Share</button>
          <button class="danger" data-action="delete-session" data-session-index="${index}">Delete</button>
        </div>
      `;
      
      sessionList.appendChild(sessionItem);
    });

    // Attach event listeners to session buttons using index to avoid escaping issues
    sessionList.querySelectorAll('[data-action="load-session"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(btn.dataset.sessionIndex);
        const session = filteredSessions[index];
        if (session) {
          this.loadSession(session.name);
        }
      });
    });

    sessionList.querySelectorAll('[data-action="share-session"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(btn.dataset.sessionIndex);
        const session = filteredSessions[index];
        if (session) {
          this.shareSession(session.name);
        }
      });
    });

    sessionList.querySelectorAll('[data-action="delete-session"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const index = parseInt(btn.dataset.sessionIndex);
        const session = filteredSessions[index];
        if (session) {
          this.deleteSession(session.name);
        }
      });
    });
  }

  async shareSession(sessionName) {
    try {
      this.showStatus('Generating shareable link...', 'loading');
      
      const response = await chrome.runtime.sendMessage({
        action: 'generateShareableLink',
        sessionName: sessionName
      });
      
      if (response.success) {
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(response.shortUrl);
          this.showStatus('Shareable link copied to clipboard!', 'success');
          
          // Show the link in a dialog
          this.showShareDialog(response.shortUrl, response.url);
        } catch (clipboardError) {
          // Fallback: show dialog with the link
          this.showShareDialog(response.shortUrl, response.url);
        }
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error sharing session:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  showShareDialog(shortUrl, fullUrl) {
    const dialog = document.getElementById('shareDialog');
    const linkInput = document.getElementById('shareLinkInput');
    linkInput.value = shortUrl;
    dialog.style.display = 'block';
    
    // Highlight the input
    linkInput.select();
    linkInput.setSelectionRange(0, linkInput.value.length);
  }

  hideShareDialog() {
    const dialog = document.getElementById('shareDialog');
    dialog.style.display = 'none';
  }

  async showImportDialog() {
    const dialog = document.getElementById('importDialog');
    const urlInput = document.getElementById('importUrlInput');
    urlInput.value = '';
    dialog.style.display = 'block';
    urlInput.focus();
  }

  hideImportDialog() {
    const dialog = document.getElementById('importDialog');
    dialog.style.display = 'none';
  }

  async importSharedSession() {
    try {
      const urlInput = document.getElementById('importUrlInput');
      const url = urlInput.value.trim();
      
      if (!url) {
        this.showStatus('Please enter a shared session URL', 'error');
        return;
      }

      this.showStatus('Importing shared session...', 'loading');
      
      // Extract encoded data from URL
      let encodedData = '';
      
      // Check for different URL formats
      if (url.startsWith('tabsession://')) {
        encodedData = url.replace('tabsession://', '');
      } else if (url.includes('?data=')) {
        encodedData = url.split('?data=')[1].split('&')[0];
      } else if (url.includes('chrome-extension://')) {
        const urlObj = new URL(url);
        encodedData = urlObj.searchParams.get('data') || '';
      } else {
        // Assume it's just the encoded data
        encodedData = url;
      }
      
      if (!encodedData) {
        this.showStatus('Invalid session URL format', 'error');
        return;
      }
      
      const response = await chrome.runtime.sendMessage({
        action: 'importSharedSession',
        encodedData: encodedData
      });
      
      if (response.success) {
        this.showStatus(response.message, 'success');
        this.hideImportDialog();
        await this.loadSessions();
      } else {
        this.showStatus(`Error: ${response.error}`, 'error');
      }
    } catch (error) {
      console.error('Error importing shared session:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    }
  }

  showStatus(message, type = 'info') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.className = `status ${type}`;
    status.style.display = 'block';
    
    // Auto-hide success messages
    if (type === 'success') {
      setTimeout(() => {
        status.style.display = 'none';
      }, 3000);
    }
  }
}

// Initialize popup manager
const popupManager = new PopupManager();
