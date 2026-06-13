import { useEffect, useState } from 'react';
import { X, Clock } from 'lucide-react';
import styles from './RecentProjectsModal.module.css';

interface Recent {
  name: string;
  path: string;
  openedAt: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onOpen: (path: string) => void;
}

export function RecentProjectsModal({ open, onClose, onOpen }: Props) {
  const [recents, setRecents] = useState<Recent[]>([]);

  useEffect(() => {
    if (!open) return;
    window.downai.recents.list().then(setRecents);
  }, [open]);

  if (!open) return null;

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Recent Projects</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>
        {recents.length === 0 ? (
          <p className={styles.empty}>No recent projects yet.</p>
        ) : (
          <ul className={styles.list}>
            {recents.map(project => (
              <li key={project.path}>
                <button
                  className={styles.item}
                  onClick={() => { onOpen(project.path); onClose(); }}
                >
                  <span className={styles.name}>{project.name}</span>
                  <span className={styles.path}>{project.path}</span>
                  <span className={styles.date}>
                    <Clock size={12} /> {formatDate(project.openedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
