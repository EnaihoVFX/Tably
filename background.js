// Smart Tab Organizer - Full Featured with Enhanced Stability
console.log('🚀 Smart Tab Organizer loading...');

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

class TabGroupManager {
  constructor() {
    this.aiManager = new AIAPIManager();
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
      const result = await chrome.storage.local.get(['sessions']);
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
}

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
        tabGroupManager.getSavedSessions()
          .then(sessions => sendResponse({ success: true, sessions }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'groupTabs':
        tabGroupManager.groupTabs(request.tabIds, request.groupName)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
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