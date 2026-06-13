import { WebSocketServer } from 'ws';
import { randomBytes } from 'crypto';

const MAX_PEERS = 8;
const PEER_COLORS = ['#61dafb', '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#fb923c'];

/** @type {Map<string, { code: string, hostId: string, peers: Map<string, Peer> }>} */
const rooms = new Map();

/** @typedef {{ ws: import('ws').WebSocket, name: string, color: string, activeFile: string | null, line: number, column: number }} Peer */

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i += 1) {
    code += chars[bytes[i] % chars.length];
  }
  return rooms.has(code) ? generateCode() : code;
}

/** @param {{ peers: Map<string, Peer> }} room */
function pickColor(room) {
  const used = new Set([...room.peers.values()].map((p) => p.color));
  return PEER_COLORS.find((c) => !used.has(c)) || PEER_COLORS[room.peers.size % PEER_COLORS.length];
}

/** @param {{ peers: Map<string, Peer> }} room */
function presencePayload(room) {
  return {
    type: 'presence',
    code: room.code,
    peers: [...room.peers.entries()].map(([id, p]) => ({
      id,
      name: p.name,
      color: p.color,
      activeFile: p.activeFile,
      line: p.line,
      column: p.column,
      isHost: id === room.hostId,
    })),
  };
}

/** @param {{ peers: Map<string, Peer> }} room */
function broadcast(room, msg, exceptWs = null) {
  const payload = JSON.stringify(msg);
  for (const peer of room.peers.values()) {
    if (peer.ws !== exceptWs && peer.ws.readyState === 1) {
      peer.ws.send(payload);
    }
  }
}

/** @param {import('http').Server} httpServer */
export function attachCollaboration(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    if (url.pathname !== '/v1/collab/ws') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws);
    });
  });

  wss.on('connection', (ws) => {
    /** @type {string | null} */
    let peerId = null;
    /** @type {string | null} */
    let roomCode = null;

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'join') {
        if (peerId) return;

        peerId = typeof msg.peerId === 'string' ? msg.peerId : randomBytes(8).toString('hex');
        const name = String(msg.name || 'Guest').slice(0, 32);

        let room;
        if (msg.create) {
          const code = generateCode();
          room = { code, hostId: peerId, peers: new Map() };
          rooms.set(code, room);
        } else {
          roomCode = String(msg.code || '').toUpperCase();
          room = rooms.get(roomCode);
          if (!room) {
            ws.send(JSON.stringify({ type: 'error', error: 'Room not found. Check the code and try again.' }));
            ws.close();
            return;
          }
          if (room.peers.size >= MAX_PEERS) {
            ws.send(JSON.stringify({ type: 'error', error: 'Room is full (max 8 collaborators).' }));
            ws.close();
            return;
          }
        }

        roomCode = room.code;
        const color = pickColor(room);
        room.peers.set(peerId, {
          ws,
          name,
          color,
          activeFile: null,
          line: 1,
          column: 1,
        });

        ws.send(JSON.stringify({ type: 'joined', selfId: peerId, ...presencePayload(room) }));
        broadcast(room, presencePayload(room), ws);
        return;
      }

      if (!peerId || !roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;
      const peer = room.peers.get(peerId);
      if (!peer) return;

      if (msg.type === 'doc' && typeof msg.path === 'string' && typeof msg.content === 'string') {
        broadcast(room, { type: 'doc', path: msg.path, content: msg.content, from: peerId }, ws);
        return;
      }

      if (msg.type === 'cursor' && typeof msg.path === 'string') {
        peer.activeFile = msg.path;
        peer.line = Number(msg.line) || 1;
        peer.column = Number(msg.column) || 1;
        broadcast(
          room,
          {
            type: 'cursor',
            path: msg.path,
            line: peer.line,
            column: peer.column,
            from: peerId,
            name: peer.name,
            color: peer.color,
          },
          ws
        );
        return;
      }

      if (msg.type === 'file-active' && typeof msg.path === 'string') {
        peer.activeFile = msg.path;
        broadcast(room, { type: 'file-active', path: msg.path, from: peerId }, ws);
      }
    });

    ws.on('close', () => {
      if (!peerId || !roomCode) return;
      const room = rooms.get(roomCode);
      if (!room) return;

      room.peers.delete(peerId);
      if (room.peers.size === 0) {
        rooms.delete(roomCode);
        return;
      }

      if (room.hostId === peerId) {
        room.hostId = room.peers.keys().next().value;
      }
      broadcast(room, presencePayload(room));
    });
  });

  console.log('Collaboration WebSocket: ws://localhost:<port>/v1/collab/ws');
}
