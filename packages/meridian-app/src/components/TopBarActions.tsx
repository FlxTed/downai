import { Settings, Download, MessageSquare } from 'lucide-react';
import styles from './TopBarActions.module.css';

interface Props {
  onOpenSettings: () => void;
  onOpenClone: () => void;
  onOpenChat: () => void;
  showChat?: boolean;
}

export function TopBarActions({ onOpenSettings, onOpenClone, onOpenChat, showChat }: Props) {
  return (
    <div className={styles.actions}>
      <button
        className={`${styles.iconBtn} ${showChat ? styles.iconBtnActive : ''}`}
        onClick={onOpenChat}
        title="Open Chat (Ctrl+L)"
      >
        <MessageSquare size={16} strokeWidth={1.5} />
      </button>
      <button className={styles.iconBtn} onClick={onOpenClone} title="Clone repository">
        <Download size={16} strokeWidth={1.5} />
      </button>
      <button className={styles.iconBtn} onClick={onOpenSettings} title="Settings">
        <Settings size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
