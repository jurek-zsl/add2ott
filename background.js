// Background service worker

console.log('Add2OTT: Background service worker started');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Add2OTT: Extension installed');
    // Open options page on first install
    chrome.runtime.openOptionsPage();
  } else if (details.reason === 'update') {
    console.log('Add2OTT: Extension updated');
  }
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getConfig') {
    chrome.storage.sync.get(['serverAddress', 'authToken', 'username', 'isLoggedIn', 'selectedRoom'], (result) => {
      sendResponse({
        serverAddress: result.serverAddress || '',
        authToken: result.authToken || '',
        username: result.username || '',
        isLoggedIn: result.isLoggedIn || false,
        selectedRoom: result.selectedRoom || ''
      });
    });
    return true; // Keep the message channel open for async response
  }
  
  // Handle video adding requests from content script
  if (request.action === 'addVideo') {
    (async () => {
      try {
        const { serverAddress, authToken, roomName, videoUrl } = request;
        
        const response = await fetch(`${serverAddress}/api/room/${roomName}/queue`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify({
            url: videoUrl
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `Failed to add video: ${response.statusText}`);
        }
        
        sendResponse({ success: true });
      } catch (error) {
        console.error('Error adding video:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep the message channel open for async response
  }
});

// Handle browser action click (optional - already using popup)
chrome.action.onClicked.addListener((tab) => {
  console.log('Add2OTT: Extension icon clicked', tab);
});
