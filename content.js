// Smart Content Script with Enhanced Stability
console.log('🧠 Smart Content Script loading...');

class ContentScript {
  constructor() {
    this.isInitialized = false;
    this.observer = null;
    this.lastAnalysisTime = 0;
    this.analysisCooldown = 2000; // 2 seconds between analyses
    this.messageCount = 0;
    this.maxMessagesPerMinute = 30;
    this.messageResetTime = Date.now();
    this.performanceObserver = null;
    this.isSlowPerformance = false;
  }

  async init() {
    try {
      console.log('🔧 Initializing Smart Content Script...');
      
      // Monitor performance
      this.monitorPerformance();
      
      // Start observing page changes with smart filtering
      this.observePageChanges();
      
      // Add visual indicators
      this.addVisualIndicators();
      
      this.isInitialized = true;
      console.log('✅ Smart Content Script initialized successfully');
    } catch (error) {
      console.error('❌ Content Script initialization failed:', error);
    }
  }

  monitorPerformance() {
    try {
      if (typeof PerformanceObserver !== 'undefined') {
        this.performanceObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const longTasks = entries.filter(entry => entry.duration > 50);
          
          if (longTasks.length > 3) {
            this.isSlowPerformance = true;
            console.log('⚠️ Slow performance detected, adapting behavior');
          } else {
            this.isSlowPerformance = false;
          }
        });
        
        this.performanceObserver.observe({ entryTypes: ['longtask'] });
      }
    } catch (error) {
      console.error('Performance monitoring failed:', error);
    }
  }

  observePageChanges() {
    try {
      if (!document.body) {
        console.log('Document body not ready, retrying...');
        setTimeout(() => this.observePageChanges(), 1000);
        return;
      }

      // Smart filtering for relevant changes
      const shouldObserve = (mutation) => {
        // Only observe significant DOM changes
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);
          return addedNodes.some(node => 
            node.nodeType === Node.ELEMENT_NODE && 
            (node.tagName === 'ARTICLE' || 
             node.tagName === 'MAIN' || 
             node.classList?.contains('content') ||
             node.classList?.contains('post'))
          );
        }
        return false;
      };

      this.observer = new MutationObserver((mutations) => {
        const relevantMutations = mutations.filter(shouldObserve);
        
        if (relevantMutations.length > 0) {
          console.log(`📊 Detected ${relevantMutations.length} relevant changes`);
          this.analyzeNewContent();
        }
      });

      // Adaptive observation based on performance
      const observeOptions = {
        childList: true,
        subtree: this.isSlowPerformance ? false : true, // Reduce scope if slow
        attributes: false,
        characterData: false
      };

      this.observer.observe(document.body, observeOptions);
      console.log('👁️ Page change observer started');
    } catch (error) {
      console.error('❌ Failed to start page observer:', error);
    }
  }

  analyzeNewContent() {
    try {
      const now = Date.now();
      
      // Rate limiting
      if (now - this.lastAnalysisTime < this.analysisCooldown) {
        console.log('⏰ Analysis cooldown active, skipping');
        return;
      }

      // Message rate limiting
      if (now - this.messageResetTime > 60000) {
        this.messageCount = 0;
        this.messageResetTime = now;
      }

      if (this.messageCount >= this.maxMessagesPerMinute) {
        console.log('⚠️ Message rate limit reached, skipping analysis');
        return;
      }

      this.lastAnalysisTime = now;
      this.messageCount++;

      // Adaptive delay based on performance
      const delay = this.isSlowPerformance ? 3000 : 1000;
      
      setTimeout(() => {
        this.performAnalysis();
      }, delay);
    } catch (error) {
      console.error('❌ Error in analyzeNewContent:', error);
    }
  }

  async performAnalysis() {
    try {
      console.log('🔍 Performing content analysis...');
      
      // Smart content filtering
      if (this.shouldSkipAnalysis()) {
        console.log('⏭️ Skipping analysis - not relevant content');
        return;
      }

      const metadata = this.extractContentMetadata();
      
      if (metadata && Object.keys(metadata).length > 0) {
        console.log('📤 Sending content metadata to background');
        
        chrome.runtime.sendMessage({
          action: 'analyzeContent',
          metadata: metadata,
          url: window.location.href,
          timestamp: Date.now()
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Message send error:', chrome.runtime.lastError);
          } else {
            console.log('✅ Content analysis acknowledged');
          }
        });
      }
    } catch (error) {
      console.error('❌ Error in performAnalysis:', error);
    }
  }

  shouldSkipAnalysis() {
    try {
      // Skip if page is not fully loaded
      if (document.readyState !== 'complete') {
        return true;
      }

      // Skip if no meaningful content
      const textContent = document.body?.textContent || '';
      if (textContent.length < 100) {
        return true;
      }

      // Skip if it's a system page
      const url = window.location.href.toLowerCase();
      if (url.includes('chrome://') || url.includes('chrome-extension://') || 
          url.includes('about:') || url.includes('data:')) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error in shouldSkipAnalysis:', error);
      return true; // Skip on error
    }
  }

  extractContentMetadata() {
    try {
      const metadata = {
        title: document.title,
        url: window.location.href,
        textContent: this.extractTextContent(),
        images: this.extractImages(),
        links: this.extractLinks(),
        timestamp: Date.now()
      };

      return metadata;
    } catch (error) {
      console.error('❌ Error extracting metadata:', error);
      return null;
    }
  }

  extractTextContent() {
    try {
      // Focus on main content areas
      const contentSelectors = [
        'main', 'article', '.content', '.post', '.entry',
        '[role="main"]', '.main-content', '#content'
      ];

      let content = '';
      
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          content = element.textContent;
          break;
        }
      }

      // Fallback to body if no main content found
      if (!content) {
        content = document.body?.textContent || '';
      }

      // Limit content size for performance
      return content.substring(0, 2000);
    } catch (error) {
      console.error('Error extracting text content:', error);
      return '';
    }
  }

  extractImages() {
    try {
      const images = Array.from(document.querySelectorAll('img'))
        .slice(0, 5) // Limit to first 5 images
        .map(img => ({
          src: img.src,
          alt: img.alt,
          width: img.width,
          height: img.height
        }))
        .filter(img => img.src && !img.src.startsWith('data:'));

      return images;
    } catch (error) {
      console.error('Error extracting images:', error);
      return [];
    }
  }

  extractLinks() {
    try {
      const links = Array.from(document.querySelectorAll('a[href]'))
        .slice(0, 10) // Limit to first 10 links
        .map(link => ({
          href: link.href,
          text: link.textContent?.trim(),
          title: link.title
        }))
        .filter(link => link.href && !link.href.startsWith('javascript:'));

      return links;
    } catch (error) {
      console.error('Error extracting links:', error);
      return [];
    }
  }

  addVisualIndicators() {
    try {
      // Add subtle visual indicator that extension is active
      const indicator = document.createElement('div');
      indicator.id = 'smart-tab-organizer-indicator';
      indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 8px;
        height: 8px;
        background: #4CAF50;
        border-radius: 50%;
        z-index: 10000;
        opacity: 0.7;
        pointer-events: none;
      `;
      
      if (document.head) {
        document.head.appendChild(indicator);
      }
    } catch (error) {
      console.error('Error adding visual indicators:', error);
    }
  }

  handleError(error, context) {
    console.error(`❌ Error in ${context}:`, error);
    
    // Send error to background for logging
    try {
      chrome.runtime.sendMessage({
        action: 'logError',
        error: error.message,
        context: context,
        url: window.location.href,
        timestamp: Date.now()
      });
    } catch (sendError) {
      console.error('Failed to send error to background:', sendError);
    }
  }

  cleanup() {
    try {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      
      if (this.performanceObserver) {
        this.performanceObserver.disconnect();
        this.performanceObserver = null;
      }
      
      const indicator = document.getElementById('smart-tab-organizer-indicator');
      if (indicator) {
        indicator.remove();
      }
      
      console.log('🧹 Content script cleaned up');
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  }
}

// Initialize content script with error handling
try {
  const contentScript = new ContentScript();
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      contentScript.init();
    });
  } else {
    contentScript.init();
  }
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    contentScript.cleanup();
  });
  
} catch (error) {
  console.error('❌ Failed to initialize content script:', error);
}







