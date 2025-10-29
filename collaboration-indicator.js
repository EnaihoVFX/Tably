// Inject visual indicator into collaboration windows
(function() {
  'use strict';

  // Get current window ID first
  chrome.runtime.sendMessage({ action: 'getCurrentWindowId' }, (response) => {
    if (response && response.windowId) {
      // Check if this is a collaboration window
      chrome.runtime.sendMessage({ 
        action: 'isCollaborationWindow',
        windowId: response.windowId 
      }, (response2) => {
        if (response2 && response2.isCollaboration) {
          addCollaborationIndicator(response2.workspaceId);
        }
      });
    }
  });

  function addCollaborationIndicator(workspaceId) {
    // Check if indicator already exists
    if (document.getElementById('tably-collaboration-banner')) {
      return;
    }

    // Create collaboration banner
    const banner = document.createElement('div');
    banner.id = 'tably-collaboration-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 8px 16px;
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    `;

    banner.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px;">👥</span>
        <span style="font-weight: 600;">Collaboration Workspace</span>
        <span style="opacity: 0.8; font-size: 11px;">ID: ${workspaceId}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="width: 8px; height: 8px; background: #4ade80; border-radius: 50%; animation: pulse 2s infinite;"></span>
        <span style="font-size: 11px; opacity: 0.9;">Synced</span>
      </div>
    `;

    // Add pulse animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
    `;
    document.head.appendChild(style);

    // Insert banner at the top
    if (document.body) {
      document.body.insertBefore(banner, document.body.firstChild);
      document.body.style.marginTop = '40px';
    } else {
      // Wait for body to load
      document.addEventListener('DOMContentLoaded', () => {
        document.body.insertBefore(banner, document.body.firstChild);
        document.body.style.marginTop = '40px';
      });
    }

    console.log('✅ Collaboration indicator added');
  }
})();

