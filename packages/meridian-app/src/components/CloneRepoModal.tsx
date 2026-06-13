import { useState } from 'react';
import { X } from 'lucide-react';
import styles from './SettingsModal.module.css';

interface Props {
  onClose: () => void;
  onClone: (url: string) => Promise<void>;
}

export function CloneRepoModal({ onClose, onClone }: Props) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const trimmed = url.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError('');
    try {
      await onClone(trimmed);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clone failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ width: 440 }}>
        <div className={styles.header}>
          <h2>Clone repository</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.body}>
          <label className={styles.label}>
            Repository URL
            <input
              className={styles.input}
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              onKeyDown={e => e.key === 'Enter' && submit()}
              autoFocus
            />
          </label>
          {error && <p style={{ color: 'var(--red)', fontSize: 12 }}>{error}</p>}
        </div>
        <div className={styles.footer}>
          <button className={styles.saveBtn} onClick={submit} disabled={loading || !url.trim()}>
            {loading ? 'Cloning…' : 'Clone'}
          </button>
        </div>
      </div>
    </div>
  );
}
