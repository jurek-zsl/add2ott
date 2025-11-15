// UI Elements
const configView = document.getElementById('config-view');
const mainView = document.getElementById('main-view');
const configForm = document.getElementById('config-form');
const serverAddressInput = document.getElementById('server-address');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const settingsBtn = document.getElementById('settings-btn');
const roomSelect = document.getElementById('room-select');
const refreshRoomsBtn = document.getElementById('refresh-rooms');
const videoUrlInput = document.getElementById('video-url');
const addVideoBtn = document.getElementById('add-video');
const statusMessage = document.getElementById('status-message');
const enableYtControlsCheckbox = document.getElementById('enable-yt-controls');

// Initialize popup
async function init() {
  const config = await loadConfig();
  
  if (!config.serverAddress || !config.authToken) {
    showConfigView();
  } else {
    showMainView();
    await loadRooms();
  }
}

// Load configuration from storage
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['serverAddress', 'authToken', 'username', 'isLoggedIn', 'selectedRoom', 'enableYtControls'], (result) => {
      resolve({
        serverAddress: result.serverAddress || '',
        authToken: result.authToken || '',
        username: result.username || '',
        isLoggedIn: result.isLoggedIn || false,
        selectedRoom: result.selectedRoom || '',
        enableYtControls: result.enableYtControls || false
      });
    });
  });
}

// Save configuration to storage
async function saveConfig(config) {
  return new Promise((resolve) => {
    chrome.storage.sync.set(config, resolve);
  });
}

// Get auth token from OTT server
async function getAuthToken(serverAddress) {
  try {
    const response = await fetch(`${serverAddress}/api/auth/grant`);
    
    if (!response.ok) {
      throw new Error(`Failed to get auth token: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.token;
  } catch (error) {
    console.error('Error getting auth token:', error);
    throw error;
  }
}

// Login with username and password (optional)
async function login(serverAddress, authToken, username, password) {
  try {
    const response = await fetch(`${serverAddress}/api/user/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        user: username,
        password: password
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || 'Login failed');
    }
    
    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
}

// Save selected room
async function saveSelectedRoom(roomName) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ selectedRoom: roomName }, resolve);
  });
}

// Show configuration view
function showConfigView() {
  configView.classList.remove('hidden');
  mainView.classList.add('hidden');
  
  loadConfig().then(config => {
    serverAddressInput.value = config.serverAddress;
    usernameInput.value = config.username;
    passwordInput.value = ''; // Never pre-fill password
  });
}

// Show main view
async function showMainView() {
  configView.classList.add('hidden');
  mainView.classList.remove('hidden');
  
  // Load and set YouTube controls checkbox
  const config = await loadConfig();
  enableYtControlsCheckbox.checked = config.enableYtControls;
}

// Load rooms from OTT server
async function loadRooms() {
  try {
    const config = await loadConfig();
    
    if (!config.serverAddress || !config.authToken) {
      showStatus('Configuration incomplete', 'error');
      return;
    }

    roomSelect.innerHTML = '<option value="">Loading...</option>';
    
    const response = await fetch(`${config.serverAddress}/api/room/list`, {
      headers: {
        'Authorization': `Bearer ${config.authToken}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch rooms: ${response.statusText}`);
    }
    
    const rooms = await response.json();
    
    roomSelect.innerHTML = '<option value="">Select a room...</option>';
    
    if (rooms && rooms.length > 0) {
      rooms.forEach(room => {
        const option = document.createElement('option');
        option.value = room.name;
        option.textContent = `${room.title || room.name} (${room.name})`;
        roomSelect.appendChild(option);
      });
      
      // Restore previously selected room
      if (config.selectedRoom) {
        roomSelect.value = config.selectedRoom;
      }
    } else {
      roomSelect.innerHTML = '<option value="">No rooms available</option>';
    }
  } catch (error) {
    console.error('Error loading rooms:', error);
    showStatus(`Error loading rooms: ${error.message}`, 'error');
    roomSelect.innerHTML = '<option value="">Error loading rooms</option>';
  }
}

// Add video to room
async function addVideo(videoUrl) {
  try {
    const config = await loadConfig();
    const roomName = roomSelect.value;
    
    if (!roomName) {
      showStatus('Please select a room', 'error');
      return;
    }
    
    if (!videoUrl) {
      showStatus('Please enter a video URL', 'error');
      return;
    }
    
    if (!config.authToken) {
      showStatus('Not authenticated', 'error');
      return;
    }
    
    showStatus('Adding video...', 'info');
    
    const response = await fetch(`${config.serverAddress}/api/room/${roomName}/queue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.authToken}`
      },
      body: JSON.stringify({
        url: videoUrl
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to add video: ${response.statusText}`);
    }
    
    showStatus('Video added to queue!', 'success');
    videoUrlInput.value = '';
    
    // Auto-hide success message after 3 seconds
    setTimeout(() => {
      statusMessage.classList.add('hidden');
    }, 3000);
  } catch (error) {
    console.error('Error adding video:', error);
    showStatus(`Error: ${error.message}`, 'error');
  }
}

// Show status message
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status ${type}`;
  statusMessage.classList.remove('hidden');
}

// Event Listeners
configForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const serverAddress = serverAddressInput.value.trim().replace(/\/$/, ''); // Remove trailing slash
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  
  if (!serverAddress) {
    showStatus('Server address is required', 'error');
    return;
  }
  
  try {
    showStatus('Connecting...', 'info');
    
    // Step 1: Get auth token
    const authToken = await getAuthToken(serverAddress);
    
    let isLoggedIn = false;
    
    // Step 2: Login if credentials provided
    if (username && password) {
      try {
        showStatus('Logging in...', 'info');
        await login(serverAddress, authToken, username, password);
        isLoggedIn = true;
        showStatus('Logged in successfully!', 'success');
      } catch (error) {
        showStatus(`Login failed: ${error.message}. Continuing as guest.`, 'info');
      }
    }
    
    // Step 3: Save config
    await saveConfig({
      serverAddress,
      authToken,
      username: username || '',
      isLoggedIn
    });
    
    setTimeout(() => {
      showMainView();
      loadRooms();
    }, isLoggedIn ? 1500 : 500);
    
  } catch (error) {
    showStatus(`Connection failed: ${error.message}`, 'error');
  }
});

settingsBtn.addEventListener('click', () => {
  showConfigView();
});

refreshRoomsBtn.addEventListener('click', () => {
  loadRooms();
});

roomSelect.addEventListener('change', () => {
  saveSelectedRoom(roomSelect.value);
});

addVideoBtn.addEventListener('click', () => {
  addVideo(videoUrlInput.value.trim());
});

videoUrlInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addVideo(videoUrlInput.value.trim());
  }
});

enableYtControlsCheckbox.addEventListener('change', async () => {
  await saveConfig({
    enableYtControls: enableYtControlsCheckbox.checked
  });
  showStatus('Setting saved', 'success');
  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, 2000);
});

// Initialize on load
init();
