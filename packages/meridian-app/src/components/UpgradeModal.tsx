import { X, Check, ExternalLink } from 'lucide-react';
import styles from './UpgradeModal.module.css';

const PURCHASE_URL = 'https://downai.dev/#pricing';
const FEATURES = [
  'Chat, inline edit & @ context',
  'Terminal and git panel',
  'All models included',
  'Priority support',
];

interface Props {
  onClose: () => void;
  onActivate: () => void;
  reason?: string;
}

export function UpgradeModal({ onClose, onActivate, reason }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <X size={18} />
        </button>

        <h2>Upgrade to DownAI Pro</h2>
        {reason && <p className={styles.reason}>{reason}</p>}
        <p className={styles.desc}>
          This feature requires DownAI Pro. Free includes the editor only.
        </p>

        <div className={styles.price}>
          <span className={styles.amount}>$19</span>
          <span className={styles.period}>/month</span>
        </div>

        <ul className={styles.features}>
          {FEATURES.map(f => (
            <li key={f}><Check size={14} /> {f}</li>
          ))}
        </ul>

        <div className={styles.actions}>
          <button
            className={styles.primaryBtn}
            onClick={() => window.downai.shell.openExternal(PURCHASE_URL)}
          >
            Get DownAI Pro <ExternalLink size={14} />
          </button>
          <button className={styles.secondaryBtn} onClick={onActivate}>
            I have a license key
          </button>
        </div>
      </div>
    </div>
  );
}
