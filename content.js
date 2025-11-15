// Content script for YouTube pages
console.log('Add2OTT: Content script loaded');

let config = null;
let selectedRoom = null;

// Load configuration
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['serverAddress', 'authToken', 'username', 'isLoggedIn', 'selectedRoom'], (result) => {
      config = {
        serverAddress: result.serverAddress || '',
        authToken: result.authToken || '',
        username: result.username || '',
        isLoggedIn: result.isLoggedIn || false,
        selectedRoom: result.selectedRoom || ''
      };
      selectedRoom = config.selectedRoom;
      resolve(config);
    });
  });
}

// Listen for config changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.selectedRoom) {
      selectedRoom = changes.selectedRoom.newValue;
      updateButtonStates();
    }
    if (changes.serverAddress || changes.authToken) {
      loadConfig();
    }
  }
});

// Extract video ID from URL
function extractVideoId(url) {
  const urlObj = new URL(url);
  return urlObj.searchParams.get('v');
}

// Get current video URL
function getCurrentVideoUrl() {
  const videoId = extractVideoId(window.location.href);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
}

// Add video to OTT using background script to avoid CORS issues
async function addVideoToOTT(videoUrl) {
  if (!config || !config.serverAddress || !config.authToken) {
    alert('Please configure the extension first (click the extension icon)');
    return false;
  }

  if (!selectedRoom) {
    alert('Please select a room in the extension popup');
    return false;
  }

  try {
    // Send message to background script to make the request
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'addVideo',
        serverAddress: config.serverAddress,
        authToken: config.authToken,
        roomName: selectedRoom,
        videoUrl: videoUrl
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to add video');
    }

    return true;
  } catch (error) {
    console.error('Error adding video:', error);
    alert(`Error adding video: ${error.message}`);
    return false;
  }
}

// Create add button
function createAddButton(videoUrl) {
  const button = document.createElement('button');
  button.className = 'ott-add-button';
  button.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
    </svg>
    <span>Add to OTT</span>
  `;
  button.title = selectedRoom ? `Add to room: ${selectedRoom}` : 'Select a room in extension popup';
  button.disabled = !selectedRoom;
  
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    button.disabled = true;
    button.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" opacity="0.3"/>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
      </svg>
      <span>Adding...</span>
    `;
    
    const success = await addVideoToOTT(videoUrl);
    
    if (success) {
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span>Added!</span>
      `;
      setTimeout(() => {
        button.disabled = false;
        button.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
          </svg>
          <span>Add to OTT</span>
        `;
      }, 2000);
    } else {
      button.disabled = false;
      button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
        </svg>
        <span>Add to OTT</span>
      `;
    }
  });
  
  return button;
}

// Update button states
function updateButtonStates() {
  document.querySelectorAll('.ott-add-button').forEach(button => {
    button.disabled = !selectedRoom;
    button.title = selectedRoom ? `Add to room: ${selectedRoom}` : 'Select a room in extension popup';
  });
}

// Add button to video thumbnail (for search results, recommendations, etc.)
function addButtonToThumbnail(thumbnail) {
  // Avoid duplicates
  if (thumbnail.querySelector('.ott-add-button')) {
    return;
  }

  // Find the video link
  const linkElement = thumbnail.closest('a[href*="/watch?v="]');
  if (!linkElement) return;

  const videoUrl = linkElement.href;
  if (!videoUrl) return;

  const button = createAddButton(videoUrl);
  
  // Create container for the button
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'ott-button-container';
  buttonContainer.appendChild(button);
  
  // Add to thumbnail
  thumbnail.style.position = 'relative';
  thumbnail.appendChild(buttonContainer);
}

// Add button to video player page
function addButtonToPlayer() {
  // Check if we're on a video page
  const videoId = extractVideoId(window.location.href);
  if (!videoId) return;

  // Find the player controls or metadata section
  const targetElement = document.querySelector('#above-the-fold') || 
                        document.querySelector('#top-level-buttons-computed');
  
  if (!targetElement) return;

  // Check if button already exists
  if (document.querySelector('.ott-add-button-player')) return;

  const videoUrl = getCurrentVideoUrl();
  if (!videoUrl) return;

  const button = createAddButton(videoUrl);
  button.classList.add('ott-add-button-player');
  
  // Insert button
  targetElement.insertAdjacentElement('beforebegin', button);
}

// Observe for new thumbnails
function observeThumbnails() {
  const observer = new MutationObserver((mutations) => {
    // Look for video thumbnails
    const thumbnails = document.querySelectorAll('ytd-thumbnail:not(.ott-processed)');
    thumbnails.forEach(thumbnail => {
      thumbnail.classList.add('ott-processed');
      addButtonToThumbnail(thumbnail);
    });

    // Check if we need to add button to player
    if (window.location.pathname === '/watch') {
      addButtonToPlayer();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Initialize
async function init() {
  await loadConfig();
  
  // Add buttons to existing thumbnails
  document.querySelectorAll('ytd-thumbnail').forEach(thumbnail => {
    addButtonToThumbnail(thumbnail);
  });
  
  // Add button to player if on video page
  if (window.location.pathname === '/watch') {
    addButtonToPlayer();
  }
  
  // Start observing for new content
  observeThumbnails();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Handle navigation (YouTube is a SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    // Wait a bit for YouTube to load the new page
    setTimeout(() => {
      if (window.location.pathname === '/watch') {
        addButtonToPlayer();
      }
    }, 1000);
  }
}).observe(document, { subtree: true, childList: true });
