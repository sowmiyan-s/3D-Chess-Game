import express from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';

interface Player {
  token: string;
  color: 'w' | 'b';
  connected: boolean;
  name?: string;
}

interface MovePayload {
  seq: number;
  color: 'w' | 'b';
  from: { r: number; c: number };
  to: { r: number; c: number };
  promotion?: string;
  san?: string;
  ts: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  color?: 'w' | 'b' | 'sys';
  text: string;
  isEmote?: boolean;
  ts: number;
}

interface Room {
  code: string;
  hostToken: string;
  status: 'waiting' | 'playing' | 'ended';
  white: Player | null;
  black: Player | null;
  spectators: { token: string; name?: string }[];
  turn: 'w' | 'b';
  moves: MovePayload[];
  resetCount: number;
  timeControl: number; // 0 = untimed, or seconds (e.g. 300, 600)
  whiteTimeRemaining: number;
  blackTimeRemaining: number;
  lastMoveTimestamp: number;
  chatMessages: ChatMessage[];
  winner: 'w' | 'b' | 'draw' | null;
  winReason: string | null;
  createdAt: number;
  updatedAt: number;
}

const app = express();
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map<string, Room>();
const clientRooms = new Map<WebSocket, { roomCode: string; token: string }>();
const sseClients = new Map<string, Set<express.Response>>();

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let attempt = 0; attempt < 100; attempt++) {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (!rooms.has(code)) return code;
  }
  return 'ROOM' + Math.floor(Math.random() * 8999 + 1000);
}

function broadcastToRoom(roomCode: string, payload: any, excludeWs?: WebSocket) {
  const jsonStr = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== excludeWs) {
      const meta = clientRooms.get(client);
      if (meta && meta.roomCode === roomCode) {
        client.send(jsonStr);
      }
    }
  });

  const sseSet = sseClients.get(roomCode);
  if (sseSet) {
    sseSet.forEach((res) => {
      try {
        res.write(`data: ${jsonStr}\n\n`);
      } catch (err) {
        sseSet.delete(res);
      }
    });
  }
}

function getSanitizedRoom(room: Room) {
  return {
    code: room.code,
    status: room.status,
    turn: room.turn,
    moves: room.moves,
    resetCount: room.resetCount,
    whiteJoined: Boolean(room.white && room.white.connected),
    blackJoined: Boolean(room.black && room.black.connected),
    whiteTimeRemaining: room.whiteTimeRemaining,
    blackTimeRemaining: room.blackTimeRemaining,
    timeControl: room.timeControl,
    winner: room.winner,
    winReason: room.winReason,
    chatMessages: room.chatMessages.slice(-50),
    spectatorCount: room.spectators.length,
    updatedAt: room.updatedAt
  };
}

// REST Endpoints
app.post('/api/rooms/create', (req, res) => {
  const { preferredColor = 'w', playerToken, timeControl = 0 } = req.body || {};
  const token = playerToken || 'tok_' + Math.random().toString(36).slice(2, 10);
  const code = generateRoomCode();

  let assignedColor: 'w' | 'b' = preferredColor === 'b' ? 'b' : 'w';
  if (preferredColor === 'rand') {
    assignedColor = Math.random() < 0.5 ? 'w' : 'b';
  }

  const initialTime = Number(timeControl) > 0 ? Number(timeControl) : 0;

  const room: Room = {
    code,
    hostToken: token,
    status: 'waiting',
    white: assignedColor === 'w' ? { token, color: 'w', connected: true } : null,
    black: assignedColor === 'b' ? { token, color: 'b', connected: true } : null,
    spectators: [],
    turn: 'w',
    moves: [],
    resetCount: 0,
    timeControl: initialTime,
    whiteTimeRemaining: initialTime,
    blackTimeRemaining: initialTime,
    lastMoveTimestamp: Date.now(),
    chatMessages: [
      {
        id: 'msg_' + Date.now(),
        sender: 'Sanctum',
        color: 'sys',
        text: `Room ${code} summoned! Waiting for an opponent to enter the chamber...`,
        ts: Date.now()
      }
    ],
    winner: null,
    winReason: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  rooms.set(code, room);

  res.json({
    ok: true,
    code,
    color: assignedColor,
    playerToken: token,
    room: getSanitizedRoom(room)
  });
});

app.post('/api/rooms/join', (req, res) => {
  const { code: rawCode, playerToken } = req.body || {};
  const code = String(rawCode || '').trim().toUpperCase();
  const token = playerToken || 'tok_' + Math.random().toString(36).slice(2, 10);

  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ ok: false, error: `Room ${code} not found.` });
    return;
  }

  let assignedColor: 'w' | 'b' | 'spectator' = 'spectator';

  if (room.white && room.white.token === token) {
    assignedColor = 'w';
    room.white.connected = true;
  } else if (room.black && room.black.token === token) {
    assignedColor = 'b';
    room.black.connected = true;
  } else if (!room.white) {
    assignedColor = 'w';
    room.white = { token, color: 'w', connected: true };
  } else if (!room.black) {
    assignedColor = 'b';
    room.black = { token, color: 'b', connected: true };
  } else {
    if (!room.spectators.some((s) => s.token === token)) {
      room.spectators.push({ token });
    }
  }

  if (room.white && room.black) {
    room.status = 'playing';
    room.lastMoveTimestamp = Date.now();
  }

  room.updatedAt = Date.now();
  room.chatMessages.push({
    id: 'msg_' + Date.now(),
    sender: 'Sanctum',
    color: 'sys',
    text: assignedColor === 'spectator'
      ? 'A wandering spectator entered the Cathedral.'
      : `${assignedColor === 'w' ? 'White' : 'Black'} has taken their position!`,
    ts: Date.now()
  });

  broadcastToRoom(code, {
    type: 'room_state',
    room: getSanitizedRoom(room)
  });

  res.json({
    ok: true,
    code,
    color: assignedColor,
    playerToken: token,
    room: getSanitizedRoom(room)
  });
});

app.get('/api/rooms/public', (_req, res) => {
  const openRooms = Array.from(rooms.values())
    .filter((r) => r.status === 'waiting' && Date.now() - r.createdAt < 3600000)
    .slice(0, 10)
    .map((r) => ({
      code: r.code,
      hostSide: r.white ? 'White' : 'Black',
      timeControl: r.timeControl,
      createdAt: r.createdAt
    }));
  res.json({ ok: true, rooms: openRooms });
});

app.get('/api/rooms/:code/state', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ ok: false, error: 'Room not found' });
    return;
  }
  res.json({ ok: true, room: getSanitizedRoom(room) });
});

app.post('/api/rooms/:code/move', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ ok: false, error: 'Room not found' });
    return;
  }

  const { color, from, to, promotion = 'queen' } = req.body || {};
  if (!from || !to) {
    res.status(400).json({ ok: false, error: 'Invalid move parameters' });
    return;
  }

  const nextSeq = room.moves.length + 1;
  const movePayload: MovePayload = {
    seq: nextSeq,
    color,
    from,
    to,
    promotion,
    ts: Date.now()
  };

  room.moves.push(movePayload);
  room.turn = color === 'w' ? 'b' : 'w';
  room.updatedAt = Date.now();
  room.lastMoveTimestamp = Date.now();

  broadcastToRoom(code, {
    type: 'move',
    move: movePayload,
    room: getSanitizedRoom(room)
  });

  res.json({ ok: true, room: getSanitizedRoom(room) });
});

app.post('/api/rooms/:code/reset', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ ok: false, error: 'Room not found' });
    return;
  }

  room.moves = [];
  room.turn = 'w';
  room.winner = null;
  room.winReason = null;
  room.resetCount = (room.resetCount || 0) + 1;
  room.whiteTimeRemaining = room.timeControl;
  room.blackTimeRemaining = room.timeControl;
  room.lastMoveTimestamp = Date.now();
  room.updatedAt = Date.now();

  room.chatMessages.push({
    id: 'msg_' + Date.now(),
    sender: 'Sanctum',
    color: 'sys',
    text: 'The altar was cleared. A new battle begins!',
    ts: Date.now()
  });

  broadcastToRoom(code, {
    type: 'reset',
    room: getSanitizedRoom(room)
  });

  res.json({ ok: true, room: getSanitizedRoom(room) });
});

app.post('/api/rooms/:code/chat', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ ok: false, error: 'Room not found' });
    return;
  }

  const { text, sender = 'Player', color = 'w', isEmote = false } = req.body || {};
  if (!text) {
    res.status(400).json({ ok: false, error: 'Message text required' });
    return;
  }

  const msg: ChatMessage = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    sender: String(sender).slice(0, 24),
    color,
    text: String(text).slice(0, 180),
    isEmote: Boolean(isEmote),
    ts: Date.now()
  };

  room.chatMessages.push(msg);
  if (room.chatMessages.length > 80) room.chatMessages.shift();
  room.updatedAt = Date.now();

  broadcastToRoom(code, {
    type: 'chat',
    message: msg,
    room: getSanitizedRoom(room)
  });

  res.json({ ok: true, message: msg });
});

app.post('/api/rooms/:code/resign', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).json({ ok: false, error: 'Room not found' });
    return;
  }

  const { playerToken } = req.body || {};
  let resigningColor: 'w' | 'b' = 'w';
  if (room.black && room.black.token === playerToken) {
    resigningColor = 'b';
  } else if (room.white && room.white.token === playerToken) {
    resigningColor = 'w';
  }

  const winnerColor = resigningColor === 'w' ? 'b' : 'w';
  room.status = 'ended';
  room.winner = winnerColor;
  room.winReason = 'resignation';
  room.updatedAt = Date.now();

  room.chatMessages.push({
    id: 'msg_' + Date.now(),
    sender: 'Sanctum',
    color: 'sys',
    text: `${resigningColor === 'w' ? 'White' : 'Black'} has yielded the Sanctum! ${winnerColor === 'w' ? 'White' : 'Black'} triumphs!`,
    ts: Date.now()
  });

  broadcastToRoom(code, {
    type: 'game_over',
    winner: winnerColor,
    defeated: resigningColor,
    reason: 'resignation',
    room: getSanitizedRoom(room)
  });

  res.json({ ok: true, room: getSanitizedRoom(room) });
});

// SSE Fallback
app.get('/api/rooms/:code/events', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = rooms.get(code);
  if (!room) {
    res.status(404).send('Room not found');
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  if (!sseClients.has(code)) {
    sseClients.set(code, new Set());
  }
  sseClients.get(code)!.add(res);

  res.write(`data: ${JSON.stringify({ type: 'init', room: getSanitizedRoom(room) })}\n\n`);

  req.on('close', () => {
    const set = sseClients.get(code);
    if (set) {
      set.delete(res);
      if (set.size === 0) sseClients.delete(code);
    }
  });
});

// WebSocket Server Handler
wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'join') {
        const { roomCode, playerToken, preferredColor } = msg;
        const code = String(roomCode || '').trim().toUpperCase();
        let room = rooms.get(code);
        if (!room) {
          // Auto-create room if not found
          const token = playerToken || 'tok_' + Math.random().toString(36).slice(2, 10);
          const assignedColor: 'w' | 'b' = preferredColor === 'b' ? 'b' : 'w';
          room = {
            code,
            hostToken: token,
            status: 'waiting',
            white: assignedColor === 'w' ? { token, color: 'w', connected: true } : null,
            black: assignedColor === 'b' ? { token, color: 'b', connected: true } : null,
            spectators: [],
            turn: 'w',
            moves: [],
            resetCount: 0,
            timeControl: 0,
            whiteTimeRemaining: 0,
            blackTimeRemaining: 0,
            lastMoveTimestamp: Date.now(),
            chatMessages: [],
            winner: null,
            winReason: null,
            createdAt: Date.now(),
            updatedAt: Date.now()
          };
          rooms.set(code, room);
        }

        const token = playerToken || 'tok_' + Math.random().toString(36).slice(2, 10);
        let playerColor: 'w' | 'b' | 'spectator' = 'spectator';
        if (room.white && room.white.token === token) {
          playerColor = 'w';
          room.white.connected = true;
        } else if (room.black && room.black.token === token) {
          playerColor = 'b';
          room.black.connected = true;
        } else if (!room.white) {
          playerColor = 'w';
          room.white = { token, color: 'w', connected: true };
        } else if (!room.black) {
          playerColor = 'b';
          room.black = { token, color: 'b', connected: true };
        } else {
          playerColor = 'spectator';
          if (!room.spectators.some((s) => s.token === token)) {
            room.spectators.push({ token });
          }
        }

        if (room.white && room.black) {
          room.status = 'playing';
          room.lastMoveTimestamp = Date.now();
        }
        room.updatedAt = Date.now();

        clientRooms.set(ws, { roomCode: code, token });

        ws.send(
          JSON.stringify({
            type: 'room_state',
            assignedColor,
            playerToken: token,
            room: getSanitizedRoom(room)
          })
        );

        broadcastToRoom(code, {
          type: 'player_status',
          room: getSanitizedRoom(room)
        });
      } else if (msg.type === 'move') {
        const { roomCode, move } = msg;
        const code = String(roomCode || '').toUpperCase();
        const room = rooms.get(code);
        if (!room || !move) return;

        const nextSeq = room.moves.length + 1;
        const movePayload: MovePayload = {
          seq: nextSeq,
          color: move.color,
          from: move.from,
          to: move.to,
          promotion: move.promotion || 'queen',
          ts: Date.now()
        };
        room.moves.push(movePayload);
        room.turn = move.color === 'w' ? 'b' : 'w';
        room.updatedAt = Date.now();
        room.lastMoveTimestamp = Date.now();

        broadcastToRoom(code, {
          type: 'move',
          move: movePayload,
          room: getSanitizedRoom(room)
        }, ws);
      } else if (msg.type === 'chat' || msg.type === 'emote') {
        const { roomCode, text, sender, color, isEmote } = msg;
        const code = String(roomCode || '').toUpperCase();
        const room = rooms.get(code);
        if (!room || !text) return;

        const chatMsg: ChatMessage = {
          id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          sender: String(sender || 'Wizard').slice(0, 24),
          color: color || 'w',
          text: String(text).slice(0, 180),
          isEmote: Boolean(isEmote || msg.type === 'emote'),
          ts: Date.now()
        };

        room.chatMessages.push(chatMsg);
        if (room.chatMessages.length > 80) room.chatMessages.shift();
        room.updatedAt = Date.now();

        broadcastToRoom(code, {
          type: 'chat',
          message: chatMsg,
          room: getSanitizedRoom(room)
        });
      } else if (msg.type === 'rematch') {
        const { roomCode } = msg;
        const code = String(roomCode || '').toUpperCase();
        const room = rooms.get(code);
        if (!room) return;

        room.moves = [];
        room.turn = 'w';
        room.winner = null;
        room.winReason = null;
        room.resetCount = (room.resetCount || 0) + 1;
        room.whiteTimeRemaining = room.timeControl;
        room.blackTimeRemaining = room.timeControl;
        room.lastMoveTimestamp = Date.now();
        room.updatedAt = Date.now();

        broadcastToRoom(code, {
          type: 'reset',
          room: getSanitizedRoom(room)
        });
      } else if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', ts: Date.now() }));
      }
    } catch (e) {
      console.error('WS message error:', e);
    }
  });

  ws.on('close', () => {
    const meta = clientRooms.get(ws);
    if (meta) {
      clientRooms.delete(ws);
      const room = rooms.get(meta.roomCode);
      if (room) {
        if (room.white && room.white.token === meta.token) {
          room.white.connected = false;
        } else if (room.black && room.black.token === meta.token) {
          room.black.connected = false;
        }
        broadcastToRoom(meta.roomCode, {
          type: 'player_status',
          room: getSanitizedRoom(room)
        });
      }
    }
  });
});

// Periodic match clock tick
setInterval(() => {
  const now = Date.now();
  rooms.forEach((room) => {
    if (room.status === 'playing' && room.timeControl > 0 && !room.winner) {
      const deltaSec = (now - room.lastMoveTimestamp) / 1000;
      if (deltaSec >= 1) {
        room.lastMoveTimestamp = now;
        if (room.turn === 'w') {
          room.whiteTimeRemaining = Math.max(0, room.whiteTimeRemaining - deltaSec);
          if (room.whiteTimeRemaining <= 0) {
            room.winner = 'b';
            room.winReason = 'timeout';
            room.status = 'ended';
            broadcastToRoom(room.code, {
              type: 'game_over',
              winner: 'b',
              defeated: 'w',
              reason: 'timeout',
              room: getSanitizedRoom(room)
            });
          }
        } else {
          room.blackTimeRemaining = Math.max(0, room.blackTimeRemaining - deltaSec);
          if (room.blackTimeRemaining <= 0) {
            room.winner = 'w';
            room.winReason = 'timeout';
            room.status = 'ended';
            broadcastToRoom(room.code, {
              type: 'game_over',
              winner: 'w',
              defeated: 'b',
              reason: 'timeout',
              room: getSanitizedRoom(room)
            });
          }
        }
      }
    }
  });
}, 1000);

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Wizard Chess Sanctum server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
