/**
 * LUDO Emperor - Room & Friend UI Integration
 * HTML integration for room creation, joining, and friend management
 */

// Initialize multiplayer client
const ludoMultiplayer = new LudoMultiplayer('http://localhost:3000');

// ============================================
// ROOM CREATION UI
// ============================================

async function createGameRoom() {
  const playerId = document.getElementById('playerId')?.value || 'player_' + Math.random().toString(36).substr(2, 9);
  const roomName = document.getElementById('roomName')?.value || 'New Game';
  const isPrivate = document.getElementById('isPrivate')?.checked || false;

  try {
    const result = await ludoMultiplayer.createRoom(playerId, roomName, isPrivate);
    if (result.success) {
      showNotification(`✅ Room Created! Code: ${result.roomId}`);
      updateRoomUI(result);
      hideCreateRoomModal();
    } else {
      showNotification(`❌ Failed to create room: ${result.error}`);
    }
  } catch (error) {
    showNotification(`❌ Error: ${error.message}`);
  }
}

async function joinGameRoom() {
  const playerId = document.getElementById('playerId')?.value || 'player_' + Math.random().toString(36).substr(2, 9);
  const roomId = document.getElementById('roomIdInput')?.value;

  if (!roomId) {
    showNotification('❌ Please enter a room code');
    return;
  }

  try {
    const result = await ludoMultiplayer.joinRoom(playerId, roomId);
    if (result.success) {
      showNotification(`✅ Joined room! Players: ${result.players.length}/${result.maxPlayers}`);
      updateRoomUI(result);
      hideJoinRoomModal();
    } else {
      showNotification(`❌ Failed to join room: ${result.error}`);
    }
  } catch (error) {
    showNotification(`❌ Error: ${error.message}`);
  }
}

async function loadPublicRooms() {
  try {
    const rooms = await ludoMultiplayer.getPublicRooms();
    const roomsList = document.getElementById('publicRoomsList');
    
    if (!roomsList) return;

    if (rooms.length === 0) {
      roomsList.innerHTML = '<p style="color: #999; text-align: center;">No public rooms available</p>';
      return;
    }

    roomsList.innerHTML = rooms.map(room => `
      <div class="room-card" style="
        background: rgba(255, 255, 255, 0.05);
        padding: 15px;
        border-radius: 10px;
        margin-bottom: 10px;
        border: 1px solid rgba(241, 196, 15, 0.3);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h4 style="color: #f1c40f; margin: 0 0 5px 0;">${room.host}'s Game</h4>
            <p style="color: #aaa; margin: 0; font-size: 12px;">
              Players: ${room.playerCount}/${room.maxPlayers}
            </p>
          </div>
          <button onclick="joinGameRoomDirect('${room.roomId}')" style="
            background: #27ae60;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: bold;
          ">Join</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading public rooms:', error);
  }
}

async function joinGameRoomDirect(roomId) {
  const playerId = document.getElementById('playerId')?.value || 'player_' + Math.random().toString(36).substr(2, 9);
  
  try {
    const result = await ludoMultiplayer.joinRoom(playerId, roomId);
    if (result.success) {
      showNotification(`✅ Joined room! Players: ${result.players.length}/${result.maxPlayers}`);
      updateRoomUI(result);
    }
  } catch (error) {
    showNotification(`❌ Error: ${error.message}`);
  }
}

async function leaveGameRoom() {
  try {
    await ludoMultiplayer.leaveRoom();
    showNotification('✅ Left the room');
    clearRoomUI();
  } catch (error) {
    showNotification(`❌ Error: ${error.message}`);
  }
}

// ============================================
// FRIEND MANAGEMENT UI
// ============================================

async function sendFriendRequest() {
  const toPlayerId = document.getElementById('friendPlayerId')?.value;

  if (!toPlayerId) {
    showNotification('❌ Please enter player ID');
    return;
  }

  try {
    const result = await ludoMultiplayer.sendFriendRequest(ludoMultiplayer.playerId, toPlayerId);
    if (result.success) {
      showNotification(`✅ Friend request sent to ${toPlayerId}`);
      document.getElementById('friendPlayerId').value = '';
    }
  } catch (error) {
    showNotification(`❌ Error: ${error.message}`);
  }
}

async function loadFriendRequests() {
  try {
    const requests = await ludoMultiplayer.getFriendRequests(ludoMultiplayer.playerId);
    const requestsList = document.getElementById('friendRequestsList');
    
    if (!requestsList) return;

    if (requests.length === 0) {
      requestsList.innerHTML = '<p style="color: #999; text-align: center;">No pending requests</p>';
      return;
    }

    requestsList.innerHTML = requests.map(req => `
      <div class="request-card" style="
        background: rgba(255, 255, 255, 0.05);
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid rgba(46, 204, 113, 0.3);
      ">
        <div>
          <p style="color: #2ecc71; margin: 0; font-weight: bold;">${req.from}</p>
          <p style="color: #999; margin: 5px 0 0 0; font-size: 12px;">Sent ${new Date(req.createdAt).toLocaleDateString()}</p>
        </div>
        <button onclick="acceptFriendRequest('${req.requestId}')" style="
          background: #2ecc71;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
        ">Accept</button>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading friend requests:', error);
  }
}

async function acceptFriendRequest(requestId) {
  try {
    const result = await ludoMultiplayer.acceptFriendRequest(ludoMultiplayer.playerId, requestId);
    if (result.success) {
      showNotification(`✅ Added ${result.newFriend} as friend!`);
      loadFriendRequests();
      loadFriendsList();
    }
  } catch (error) {
    showNotification(`❌ Error: ${error.message}`);
  }
}

async function loadFriendsList() {
  try {
    const friends = await ludoMultiplayer.getFriends(ludoMultiplayer.playerId);
    const friendsList = document.getElementById('friendsList');
    
    if (!friendsList) return;

    if (friends.length === 0) {
      friendsList.innerHTML = '<p style="color: #999; text-align: center;">No friends yet</p>';
      return;
    }

    friendsList.innerHTML = friends.map(friend => `
      <div class="friend-card" style="
        background: rgba(255, 255, 255, 0.05);
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 8px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border: 1px solid rgba(241, 196, 15, 0.2);
      ">
        <div style="flex: 1;">
          <p style="color: #f1c40f; margin: 0; font-weight: bold;">${friend}</p>
          <p style="color: #999; margin: 5px 0 0 0; font-size: 11px;">Online</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="inviteFriendToRoom('${friend}')" style="
            background: #3498db;
            color: white;
            border: none;
            padding: 6px 10px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 11px;
          ">Invite</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    console.error('Error loading friends list:', error);
  }
}

async function inviteFriendToRoom(friendId) {
  const roomId = ludoMultiplayer.getCurrentRoomId();

  if (!roomId) {
    showNotification('❌ Create or join a room first');
    return;
  }

  try {
    const result = await ludoMultiplayer.inviteFriendsToRoom(
      roomId,
      ludoMultiplayer.playerId,
      [friendId]
    );
    if (result.success) {
      showNotification(`✅ Invited ${friendId} to join your room!`);
    }
  } catch (error) {
    showNotification(`❌ Error: ${error.message}`);
  }
}

// ============================================
// GAME ACTIONS
// ============================================

function rollDice() {
  ludoMultiplayer.rollDice();
}

function startGame() {
  ludoMultiplayer.startGame();
}

// ============================================
// EVENT LISTENERS
// ============================================

ludoMultiplayer.on('connected', () => {
  console.log('🎮 Connected to game server');
  showNotification('✅ Connected to server');
});

ludoMultiplayer.on('disconnected', () => {
  console.log('❌ Disconnected from server');
  showNotification('⚠️ Disconnected from server');
});

ludoMultiplayer.on('playerJoined', (data) => {
  console.log('👤 Player joined:', data.playerId);
  updatePlayersList(data.players);
  showNotification(`👤 ${data.playerId} joined! (${data.players.length}/${data.playerId})`);
});

ludoMultiplayer.on('diceRolled', (data) => {
  console.log(`🎲 ${data.playerId} rolled: ${data.diceValue}`);
  showNotification(`🎲 ${data.playerId} rolled ${data.diceValue}`);
});

ludoMultiplayer.on('playerMoved', (data) => {
  console.log(`🚶 ${data.playerId} moved to position ${data.position}`);
});

ludoMultiplayer.on('gameStarted', (data) => {
  console.log('🎮 Game started!');
  showNotification('🎮 Game Started!');
});

// ============================================
// UI HELPER FUNCTIONS
// ============================================

function updateRoomUI(roomData) {
  const roomInfo = document.getElementById('roomInfo');
  if (roomInfo) {
    roomInfo.innerHTML = `
      <div style="
        background: rgba(241, 196, 15, 0.1);
        border: 2px solid #f1c40f;
        padding: 15px;
        border-radius: 10px;
        margin: 20px 0;
      ">
        <h3 style="color: #f1c40f; margin: 0 0 10px 0;">Room Active</h3>
        <p style="margin: 5px 0;">🆔 <strong>Code:</strong> ${roomData.roomId}</p>
        <p style="margin: 5px 0;">👥 <strong>Players:</strong> ${roomData.players?.length || 0}/${roomData.maxPlayers}</p>
        <p style="margin: 5px 0;">👑 <strong>Host:</strong> ${roomData.host}</p>
        <p style="margin: 5px 0;">🔒 <strong>Type:</strong> ${roomData.isPrivate ? 'Private' : 'Public'}</p>
        <button onclick="leaveGameRoom()" style="
          background: #e74c3c;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          margin-top: 10px;
          font-weight: bold;
        ">Leave Room</button>
      </div>
    `;
  }
}

function updatePlayersList(players) {
  const playersList = document.getElementById('playersList');
  if (playersList) {
    playersList.innerHTML = players.map((player, index) => `
      <div style="
        background: rgba(255, 255, 255, 0.05);
        padding: 10px;
        border-radius: 6px;
        margin-bottom: 5px;
        display: flex;
        align-items: center;
        border-left: 4px solid #f1c40f;
      ">
        <span style="
          background: #f1c40f;
          color: #000;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 10px;
          font-weight: bold;
          font-size: 12px;
        ">${index + 1}</span>
        <span style="color: #fff; flex: 1;">${player}</span>
        <span style="
          display: inline-block;
          width: 8px;
          height: 8px;
          background: #2ecc71;
          border-radius: 50%;
          animation: pulse-green 1.5s infinite;
        "></span>
      </div>
    `).join('');
  }
}

function clearRoomUI() {
  const roomInfo = document.getElementById('roomInfo');
  if (roomInfo) {
    roomInfo.innerHTML = '';
  }
  const playersList = document.getElementById('playersList');
  if (playersList) {
    playersList.innerHTML = '';
  }
}

function showNotification(message) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = message;
    toast.classList.add('visible');
    setTimeout(() => {
      toast.classList.remove('visible');
    }, 3000);
  } else {
    console.log(message);
  }
}

function hideCreateRoomModal() {
  const modal = document.getElementById('createRoomModal');
  if (modal) modal.style.display = 'none';
}

function hideJoinRoomModal() {
  const modal = document.getElementById('joinRoomModal');
  if (modal) modal.style.display = 'none';
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('🎮 LUDO Emperor - Multiplayer Ready');
  
  // Load initial data
  setTimeout(() => {
    loadPublicRooms();
    if (ludoMultiplayer.playerId) {
      loadFriendRequests();
      loadFriendsList();
    }
  }, 1000);

  // Refresh data periodically
  setInterval(() => {
    if (ludoMultiplayer.isConnected()) {
      loadPublicRooms();
      if (ludoMultiplayer.playerId) {
        loadFriendRequests();
      }
    }
  }, 5000);
});
