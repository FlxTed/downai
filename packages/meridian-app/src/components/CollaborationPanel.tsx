import { useState } from 'react';
import { Copy, LogOut, Radio, Users } from 'lucide-react';
import { useCollaborationStore } from '../store/collaborationStore';
import styles from './CollaborationPanel.module.css';

export function CollaborationPanel() {
  const {
    status,
    roomCode,
    selfName,
    isHost,
    peers,
    error,
    startSession,
    joinSession,
    leaveSession,
  } = useCollaborationStore();

  const [name, setName] = useState(selfName || '');
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const connected = status === 'connected';

  const onStart = async () => {
    setBusy(true);
    try {
      await startSession(name);
    } catch {
      /* store sets error */
    } finally {
      setBusy(false);
    }
  };

  const onJoin = async () => {
    setBusy(true);
    try {
      await joinSession(joinCode, name);
    } catch {
      /* store sets error */
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!roomCode) return;
    await window.downai.clipboard.write(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Live Share</span>
        {connected && (
          <span className={styles.liveBadge}>
            <Radio size={12} />
            Live
          </span>
        )}
      </div>

      <div className={styles.body}>
        {!connected ? (
          <>
            <p className={styles.lead}>
              Edit together in real time. Start a session or join with a room code.
            </p>

            <label className={styles.label}>
              Your name
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Display name"
                maxLength={32}
              />
            </label>

            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => void onStart()}
              disabled={busy || status === 'connecting'}
            >
              Start live session
            </button>

            <div className={styles.divider}>
              <span>or join</span>
            </div>

            <label className={styles.label}>
              Room code
              <input
                className={styles.input}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={6}
              />
            </label>

            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => void onJoin()}
              disabled={busy || status === 'connecting' || joinCode.trim().length < 4}
            >
              Join session
            </button>

            {error && <p className={styles.error}>{error}</p>}
            {status === 'connecting' && <p className={styles.hint}>Connecting…</p>}
            <p className={styles.hint}>
              Requires the DownAI API running locally or your hosted API URL in Settings.
            </p>
          </>
        ) : (
          <>
            <div className={styles.roomCard}>
              <span className={styles.roomLabel}>Room code</span>
              <div className={styles.roomRow}>
                <code className={styles.roomCode}>{roomCode}</code>
                <button type="button" className={styles.iconBtn} onClick={() => void copyCode()} title="Copy code">
                  <Copy size={14} />
                </button>
              </div>
              {copied && <span className={styles.copied}>Copied</span>}
              <p className={styles.hint}>
                Share this code so others can join from DownAI → Live Share.
              </p>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionHead}>
                <Users size={14} />
                <span>In session ({peers.length + 1})</span>
              </div>
              <ul className={styles.peerList}>
                <li className={styles.peer}>
                  <span className={styles.peerDot} style={{ background: '#ececec' }} />
                  <span className={styles.peerName}>{name.trim() || selfName || 'You'} (you)</span>
                  {isHost && <span className={styles.hostTag}>Host</span>}
                </li>
                {peers.map((peer) => (
                  <li key={peer.id} className={styles.peer}>
                    <span className={styles.peerDot} style={{ background: peer.color }} />
                    <div className={styles.peerMeta}>
                      <span className={styles.peerName}>{peer.name}</span>
                      {peer.activeFile && (
                        <span className={styles.peerFile}>
                          {peer.activeFile.split('/').pop()} · Ln {peer.line}
                        </span>
                      )}
                    </div>
                    {peer.isHost && <span className={styles.hostTag}>Host</span>}
                  </li>
                ))}
              </ul>
            </div>

            <p className={styles.syncNote}>
              Open the same files on each machine — edits and cursors sync in real time.
            </p>

            <button type="button" className={styles.leaveBtn} onClick={leaveSession}>
              <LogOut size={14} />
              Leave session
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
