import { useState } from 'react';
import { X } from 'lucide-react';
import { useLicenseStore } from '../store/licenseStore';
import styles from './LicenseModal.module.css';

interface Props {
  onClose: () => void;
}

export function LicenseModal({ onClose }: Props) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { activate } = useLicenseStore();

  const handleActivate = async () => {
    if (!key.trim()) return;
    setLoading(true);
    setError('');
    try {
      await activate(key.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Activate DownAI Pro</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <p className={styles.desc}>
          Enter the license key from your purchase confirmation email.
        </p>
        <input
          className={styles.input}
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="FDRY-PRO-XXXX-XXXX-XXXXXXXX"
          spellCheck={false}
        />
        {error && <p className={styles.error}>{error}</p>}
        <button
          className={styles.activateBtn}
          onClick={handleActivate}
          disabled={!key.trim() || loading}
        >
          {loading ? 'Activating...' : 'Activate'}
        </button>
      </div>
    </div>
  );
}
