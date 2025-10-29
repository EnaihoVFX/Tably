// Smart Tab Organizer Popup - Full Featured Dashboard
console.log('🎨 PopupManager initialized');

class PopupManager {
  constructor() {
    this.isInitialized = false;
    this.sessions = [];
    this.tabs = [];
    this.selectedTabs = new Set();
    this.currentView = 'grid'; // 'grid' or 'list'
    this.searchQuery = '';
    this.currentTabView = 'dashboard'; // 'dashboard' or 'sessions'
    this.init();
  }

  async init() {
    try {
      console.log('🔧 Initializing PopupManager...');
      
      this.setupEventListeners();
      await this.loadSessions();
      await this.loadTabs();
      
      this.isInitialized = true;
      console.log('✅ PopupManager initialized successfully');
    } catch (error) {
      console.error('❌ PopupManager initialization failed:', error);
      this.showStatus('Failed to initialize popup', 'error');
    }
  }

  setupEventListeners() {
    // Navigation tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const view = e.target.dataset.view;
        this.switchTabView(view);
      });
    });

    // View toggle (grid/list)
    document.getElementById('gridViewBtn').addEventListener('click', () => {
      this.setViewMode('grid');
    });

    document.getElementById('listViewBtn').addEventListener('click', () => {
      this.setViewMode('list');
    });

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
    document.getElementById('organizeBtn').addEventListener('click', () => {
      this.organizeTabs();
    });

    document.getElementById('groupSelectedBtn').addEventListener('click', () => {
      this.groupSelectedTabs();
    });

    document.getElementById('ungroupBtn').addEventListener('click', () => {
      this.ungroupAllTabs();
    });

    // Session Management
    document.getElementById('saveBtn').addEventListener('click', () => {
      this.saveSession();
    });

    document.getElementById('sessionNameInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.saveSession();
      }
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.loadSessions();
      this.loadTabs();
    });
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
      this.loadTabs(); // Refresh tabs when switching to dashboard
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
      const tabs = await chrome.tabs.query({});
      this.tabs = tabs;
      this.renderTabs();
    } catch (error) {
      console.error('Error loading tabs:', error);
      this.showStatus('Failed to load tabs', 'error');
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
      tabCountEl.textContent = 'No tabs found';
      return;
    }

    tabCountEl.textContent = `${filteredTabs.length} tab${filteredTabs.length !== 1 ? 's' : ''}${this.searchQuery ? ' (filtered)' : ''}`;

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
      
      const response = await chrome.runtime.sendMessage({ action: 'organizeTabs' });
      
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
      const response = await chrome.runtime.sendMessage({ action: 'getSavedSessions' });
      
      if (response.success) {
        this.sessions = response.sessions;
        this.renderSessions();
      } else {
        console.error('Error loading sessions:', response.error);
        this.showStatus('Failed to load sessions', 'error');
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
      this.showStatus('Failed to load sessions', 'error');
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
