import { X } from 'lucide-react';
import styles from './GitDiffModal.module.css';

interface Props {
  open: boolean;
  filePath: string;
  diff: string;
  staged: boolean;
  onClose: () => void;
}

export function GitDiffModal({ open, filePath, diff, staged, onClose }: Props) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2>{filePath}</h2>
            <span className={styles.badge}>{staged ? 'Staged changes' : 'Working tree'}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <pre className={styles.diff}>
          {diff || 'No diff available.'}
        </pre>
      </div>
    </div>
  );
}
