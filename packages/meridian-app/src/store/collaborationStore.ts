import { create } from 'zustand';
import { useEditorStore } from './editorStore';

export interface CollabPeer {
  id: string;
  name: string;
  color: string;
  activeFile: string | null;
  line: number;
  column: number;
  isHost?: boolean;
}

type CollabStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface CollaborationState {
  status: CollabStatus;
  roomCode: string | null;
  selfId: string | null;
  selfName: string;
  isHost: boolean;
  peers: CollabPeer[];
  error: string | null;
  ws: WebSocket | null;
  startSession: (name: string) => Promise<void>;
  joinSession: (code: string, name: string) => Promise<void>;
  leaveSession: () => void;
  broadcastDoc: (path: string, content: string) => void;
  broadcastCursor: (path: string, line: number, column: number) => void;
  broadcastActiveFile: (path: string) => void;
}

const NAME_KEY = 'downai-collab-name';

function loadName() {
  try {
    return localStorage.getItem(NAME_KEY) || '';
  } catch {
    return '';
  }
}

function saveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}

function randomId() {
  return crypto.randomUUID();
}

async function collabWsUrl(): Promise<string> {
  const settings = await window.downai.settings.load();
  const base = (settings.hostedApiUrl || 'http://localhost:8787/v1/chat')
    .replace(/\/v1\/chat\/?$/, '')
    .replace(/\/$/, '')
    .replace(/^http/i, 'ws');
  return `${base}/v1/collab/ws`;
}

function parsePeers(raw: unknown[]): CollabPeer[] {
  return raw
    .filter((p): p is Record<string, unknown> => !!p && typeof p === 'object')
    .map((p) => ({
      id: String(p.id),
      name: String(p.name || 'Guest'),
      color: String(p.color || '#61dafb'),
      activeFile: p.activeFile ? String(p.activeFile) : null,
      line: Number(p.line) || 1,
      column: Number(p.column) || 1,
      isHost: !!p.isHost,
    }));
}

export const useCollaborationStore = create<CollaborationState>((set, get) => {
  const handleMessage = (event: MessageEvent) => {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(event.data));
    } catch {
      return;
    }

    const { selfId } = get();

    if (msg.type === 'error') {
      set({ status: 'error', error: String(msg.error || 'Connection failed') });
      get().leaveSession();
      return;
    }

    if (msg.type === 'joined' || msg.type === 'presence') {
      const peers = parsePeers(Array.isArray(msg.peers) ? msg.peers : []).filter(
        (p) => p.id !== selfId
      );
      set({
        status: 'connected',
        roomCode: String(msg.code || get().roomCode || ''),
        peers,
        error: null,
        isHost: peers.length === 0 || peers.every((p) => !p.isHost) || get().isHost,
      });
      return;
    }

    if (msg.type === 'doc' && typeof msg.path === 'string' && typeof msg.content === 'string') {
      if (msg.from === selfId) return;
      useEditorStore.getState().applyRemoteFileContent(msg.path, msg.content);
      return;
    }

    if (msg.type === 'cursor' && typeof msg.from === 'string' && msg.from !== selfId) {
      set((state) => ({
        peers: state.peers.some((p) => p.id === msg.from)
          ? state.peers.map((p) =>
              p.id === msg.from
                ? {
                    ...p,
                    activeFile: String(msg.path || p.activeFile),
                    line: Number(msg.line) || p.line,
                    column: Number(msg.column) || p.column,
                  }
                : p
            )
          : [
              ...state.peers,
              {
                id: String(msg.from),
                name: String(msg.name || 'Guest'),
                color: String(msg.color || '#61dafb'),
                activeFile: String(msg.path || ''),
                line: Number(msg.line) || 1,
                column: Number(msg.column) || 1,
              },
            ],
      }));
      return;
    }

    if (msg.type === 'file-active' && typeof msg.from === 'string' && msg.from !== selfId) {
      set((state) => ({
        peers: state.peers.map((p) =>
          p.id === msg.from ? { ...p, activeFile: String(msg.path) } : p
        ),
      }));
    }
  };

  const connect = (payload: Record<string, unknown>) =>
    new Promise<void>((resolve, reject) => {
      void collabWsUrl()
        .then((url) => {
          const ws = new WebSocket(url);
          const peerId = randomId();

          ws.onopen = () => {
            ws.send(JSON.stringify({ ...payload, peerId }));
          };

          ws.onmessage = (event) => {
            let msg: Record<string, unknown>;
            try {
              msg = JSON.parse(String(event.data));
            } catch {
              return;
            }

            if (msg.type === 'joined') {
              const peers = parsePeers(Array.isArray(msg.peers) ? msg.peers : []);
              const self = peers.find((p) => p.id === String(msg.selfId || peerId));
              set({
                ws,
                selfId: String(msg.selfId || peerId),
                status: 'connected',
                roomCode: String(msg.code || ''),
                peers: peers.filter((p) => p.id !== String(msg.selfId || peerId)),
                isHost: !!self?.isHost,
                error: null,
              });
              resolve();
              return;
            }

            handleMessage(event);
          };

          ws.onerror = () => {
            set({ status: 'error', error: 'Could not connect to collaboration server.' });
            reject(new Error('WebSocket error'));
          };

          ws.onclose = () => {
            const { status } = get();
            if (status === 'connecting') {
              set({
                status: 'error',
                error: 'Connection closed. Is the DownAI API running? (npm run api)',
              });
              reject(new Error('closed'));
            } else if (status === 'connected') {
              set({
                status: 'idle',
                roomCode: null,
                peers: [],
                ws: null,
                selfId: null,
                isHost: false,
              });
            }
          };

          set({ ws, status: 'connecting', error: null, selfId: peerId });
        })
        .catch(reject);
    });

  return {
    status: 'idle',
    roomCode: null,
    selfId: null,
    selfName: loadName(),
    isHost: false,
    peers: [],
    error: null,
    ws: null,

    startSession: async (name) => {
      const trimmed = name.trim() || 'Host';
      saveName(trimmed);
      set({ selfName: trimmed, isHost: true });
      get().leaveSession();
      await connect({ type: 'join', create: true, name: trimmed });
    },

    joinSession: async (code, name) => {
      const trimmed = name.trim() || 'Guest';
      const room = code.trim().toUpperCase();
      if (room.length < 4) {
        set({ status: 'error', error: 'Enter a valid room code.' });
        return;
      }
      saveName(trimmed);
      set({ selfName: trimmed, isHost: false });
      get().leaveSession();
      await connect({ type: 'join', create: false, code: room, name: trimmed });
    },

    leaveSession: () => {
      const { ws } = get();
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      set({
        status: 'idle',
        roomCode: null,
        selfId: null,
        isHost: false,
        peers: [],
        error: null,
        ws: null,
      });
    },

    broadcastDoc: (path, content) => {
      const { ws, status } = get();
      if (status !== 'connected' || !ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'doc', path, content }));
    },

    broadcastCursor: (path, line, column) => {
      const { ws, status } = get();
      if (status !== 'connected' || !ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'cursor', path, line, column }));
    },

    broadcastActiveFile: (path) => {
      const { ws, status } = get();
      if (status !== 'connected' || !ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ type: 'file-active', path }));
    },
  };
});

export function getCollabDisplayName() {
  return loadName();
}

export function setCollabDisplayName(name: string) {
  saveName(name);
}
