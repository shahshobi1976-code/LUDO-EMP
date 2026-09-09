const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    credentials: process.env.CORS_CREDENTIALS === 'true'
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// DATA STRUCTURES FOR ROOM & FRIEND MANAGEMENT
// ============================================

const rooms = new Map(); // Store all active rooms
const players = new Map(); // Store player info
const friendRequests = new Map(); // Store friend requests
const friends = new Map(); // Store friend lists

// Room class
class GameRoom {
  constructor(roomId, host, isPrivate = false) {
    this.roomId = roomId;
    this.host = host;
    this.isPrivate = isPrivate;
    this.players = [host];
    this.maxPlayers = parseInt(process.env.MAX_PLAYERS) || 5;
    this.status = 'waiting'; // waiting, playing, finished
    this.createdAt = Date.now();
    this.gameData = {};
  }

  isFull() {
    return this.players.length >= this.maxPlayers;
  }

  addPlayer(player) {
    if (!this.isFull() && !this.players.includes(player)) {
      this.players.push(player);
      return true;
    }
    return false;
  }

  removePlayer(player) {
    const index = this.players.indexOf(player);
    if (index > -1) {
      this.players.splice(index, 1);
    }
    // If host leaves, assign new host
    if (this.host === player && this.players.length > 0) {
      this.host = this.players[0];
    }
    return this.players.length === 0;
  }
}

// ============================================
// HOME ROUTE
// ============================================

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// REST API ENDPOINTS
// ============================================

// Create a room
app.post('/api/rooms/create', (req, res) => {
  try {
    const { playerId, roomName, isPrivate = false } = req.body;

    if (!playerId || !roomName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const room = new GameRoom(roomId, playerId, isPrivate);

    rooms.set(roomId, room);

    res.json({
      success: true,
      roomId,
      roomName,
      host: playerId,
      maxPlayers: room.maxPlayers,
      isPrivate,
      createdAt: room.createdAt
    });

    console.log(`Room created: ${roomId} by ${playerId}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Join a room
app.post('/api/rooms/join', (req, res) => {
  try {
    const { playerId, roomId } = req.body;

    if (!playerId || !roomId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.isFull()) {
      return res.status(400).json({ error: 'Room is full' });
    }

    if (room.addPlayer(playerId)) {
      res.json({
        success: true,
        roomId,
        players: room.players,
        host: room.host,
        status: room.status
      });
      console.log(`Player ${playerId} joined room ${roomId}`);
    } else {
      res.status(400).json({ error: 'Failed to join room' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all public rooms
app.get('/api/rooms/public', (req, res) => {
  try {
    const publicRooms = Array.from(rooms.values())
      .filter(room => !room.isPrivate && room.status === 'waiting')
      .map(room => ({
        roomId: room.roomId,
        host: room.host,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        createdAt: room.createdAt
      }));

    res.json({ success: true, rooms: publicRooms });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send friend request
app.post('/api/friends/request', (req, res) => {
  try {
    const { fromPlayerId, toPlayerId } = req.body;

    if (!fromPlayerId || !toPlayerId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (fromPlayerId === toPlayerId) {
      return res.status(400).json({ error: 'Cannot send request to yourself' });
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const request = {
      requestId,
      from: fromPlayerId,
      to: toPlayerId,
      status: 'pending',
      createdAt: Date.now()
    };

    if (!friendRequests.has(toPlayerId)) {
      friendRequests.set(toPlayerId, []);
    }
    friendRequests.get(toPlayerId).push(request);

    res.json({ success: true, requestId, message: 'Friend request sent' });
    console.log(`Friend request sent from ${fromPlayerId} to ${toPlayerId}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Accept friend request
app.post('/api/friends/accept', (req, res) => {
  try {
    const { playerId, requestId } = req.body;

    if (!playerId || !requestId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const requests = friendRequests.get(playerId) || [];
    const request = requests.find(r => r.requestId === requestId);

    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    // Add to friends list
    if (!friends.has(playerId)) {
      friends.set(playerId, []);
    }
    if (!friends.has(request.from)) {
      friends.set(request.from, []);
    }

    friends.get(playerId).push(request.from);
    friends.get(request.from).push(playerId);

    // Remove request
    const index = requests.indexOf(request);
    if (index > -1) {
      requests.splice(index, 1);
    }

    res.json({ 
      success: true, 
      message: 'Friend request accepted',
      newFriend: request.from 
    });
    console.log(`${playerId} accepted friend request from ${request.from}`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get friend requests
app.get('/api/friends/requests/:playerId', (req, res) => {
  try {
    const { playerId } = req.params;
    const requests = friendRequests.get(playerId) || [];
    
    res.json({ 
      success: true, 
      requests: requests.map(r => ({
        requestId: r.requestId,
        from: r.from,
        status: r.status,
        createdAt: r.createdAt
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get friends list
app.get('/api/friends/:playerId', (req, res) => {
  try {
    const { playerId } = req.params;
    const friendList = friends.get(playerId) || [];
    
    res.json({ 
      success: true, 
      friends: friendList,
      count: friendList.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Invite friend to room
app.post('/api/rooms/invite', (req, res) => {
  try {
    const { roomId, playerId, friendIds } = req.body;

    if (!roomId || !playerId || !friendIds || !Array.isArray(friendIds)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.host !== playerId) {
      return res.status(403).json({ error: 'Only room host can send invites' });
    }

    const invites = friendIds.map(friendId => ({
      inviteId: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from: playerId,
      to: friendId,
      roomId,
      status: 'pending',
      createdAt: Date.now()
    }));

    res.json({ 
      success: true, 
      invites: invites.map(i => ({ inviteId: i.inviteId, to: i.to })),
      message: `${invites.length} invitations sent`
    });

    console.log(`${playerId} sent ${invites.length} room invitations`);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Leave room
app.post('/api/rooms/leave', (req, res) => {
  try {
    const { playerId, roomId } = req.body;

    if (!playerId || !roomId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const room = rooms.get(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const isEmpty = room.removePlayer(playerId);

    if (isEmpty) {
      rooms.delete(roomId);
      res.json({ success: true, message: 'Room deleted (empty)' });
      console.log(`Room ${roomId} deleted (empty)`);
    } else {
      res.json({ 
        success: true, 
        message: 'Player left room',
        remainingPlayers: room.players.length,
        newHost: room.host
      });
      console.log(`Player ${playerId} left room ${roomId}`);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get room info
app.get('/api/rooms/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      success: true,
      roomId: room.roomId,
      host: room.host,
      players: room.players,
      playerCount: room.players.length,
      maxPlayers: room.maxPlayers,
      status: room.status,
      isPrivate: room.isPrivate,
      createdAt: room.createdAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// WEBSOCKET EVENTS (Socket.IO)
// ============================================

io.on('connection', (socket) => {
  console.log(`New connection: ${socket.id}`);

  // Player joins room via socket
  socket.on('joinRoom', (data) => {
    const { playerId, roomId } = data;
    socket.join(roomId);
    
    const room = rooms.get(roomId);
    if (room) {
      io.to(roomId).emit('playerJoined', {
        playerId,
        players: room.players,
        playerCount: room.players.length
      });
    }
  });

  // Dice roll
  socket.on('rollDice', (data) => {
    const { roomId, playerId } = data;
    const diceValue = Math.floor(Math.random() * 6) + 1;
    
    io.to(roomId).emit('diceRolled', {
      playerId,
      diceValue,
      timestamp: Date.now()
    });
  });

  // Player move
  socket.on('playerMove', (data) => {
    const { roomId, playerId, position } = data;
    
    io.to(roomId).emit('playerMoved', {
      playerId,
      position,
      timestamp: Date.now()
    });
  });

  // Game start
  socket.on('startGame', (data) => {
    const { roomId, hostId } = data;
    const room = rooms.get(roomId);
    
    if (room && room.host === hostId) {
      room.status = 'playing';
      io.to(roomId).emit('gameStarted', {
        players: room.players,
        startedAt: Date.now()
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Disconnected: ${socket.id}`);
  });
});

// ============================================
// CLEANUP INTERVAL
// ============================================

// Clean up empty/inactive rooms
setInterval(() => {
  const now = Date.now();
  const timeout = parseInt(process.env.ROOM_TIMEOUT) || 3600000;

  for (const [roomId, room] of rooms) {
    if (room.players.length === 0) {
      rooms.delete(roomId);
      console.log(`Cleaned up empty room: ${roomId}`);
    } else if (now - room.createdAt > timeout) {
      rooms.delete(roomId);
      console.log(`Cleaned up inactive room: ${roomId}`);
    }
  }
}, 60000); // Run every minute

// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, HOST, () => {
  console.log(`🎮 LUDO Emperor Server running on ${HOST}:${PORT}`);
  console.log(`📡 WebSocket ready for multiplayer connections`);
  console.log(`👥 Room System: ACTIVE`);
  console.log(`👫 Friend System: ACTIVE`);
});

module.exports = { app, io, rooms, friends };
