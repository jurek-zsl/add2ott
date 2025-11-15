// Content script for OpenTogetherTube pages
console.log('Add2OTT: OTT content script loaded');

let enableYtControls = false;

// Load settings
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['enableYtControls'], (result) => {
      enableYtControls = result.enableYtControls || false;
      resolve();
    });
  });
}

// Listen for setting changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.enableYtControls) {
    enableYtControls = changes.enableYtControls.newValue;
    console.log('YouTube controls setting changed:', enableYtControls);
    if (enableYtControls) {
      enableYouTubeControls();
    }
  }
});

// Enable YouTube controls
function enableYouTubeControls() {
  const youtubeIframe = document.querySelector('iframe[src*="youtube.com"]');
  console.log('Add2OTT: Looking for YouTube iframe...');
  
  if (youtubeIframe) {
    const currentSrc = youtubeIframe.src;
    console.log('Add2OTT: Found YouTube iframe:', currentSrc);
    
    // Only modify if controls are disabled
    if (currentSrc.includes('controls=0')) {
      const updatedSrc = currentSrc.replace('controls=0', 'controls=1');
      youtubeIframe.src = updatedSrc;
      console.log('Add2OTT: Enabled YouTube controls');
    }
  }
}

// Observe for iframe changes
function observeForIframes() {
  const observer = new MutationObserver((mutations) => {
    if (enableYtControls) {
      enableYouTubeControls();
    }
  });

  // Observe the ytcontainer or body
  const ytContainer = document.getElementById('ytcontainer') || document.body;
  observer.observe(ytContainer, {
    childList: true,
    subtree: true
  });
  
  console.log('Add2OTT: Observing for YouTube iframes...');
}

// Initialize
async function init() {
  await loadSettings();
  console.log('Add2OTT: YouTube controls enabled?', enableYtControls);
  
  if (enableYtControls) {
    enableYouTubeControls();
  }
  
  observeForIframes();
  
  // Also check periodically as a fallback
  setInterval(() => {
    if (enableYtControls) {
      enableYouTubeControls();
    }
  }, 2000);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
