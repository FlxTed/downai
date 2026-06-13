import { Files, Search, MessageSquare, GitBranch, Settings, Sparkles, Users } from 'lucide-react';
import styles from './ActivityBar.module.css';

export type SidebarView = 'explorer' | 'search' | 'git' | 'promptlab' | 'collaboration';

interface Props {
  activeView: SidebarView;
  onViewChange: (view: SidebarView) => void;
  showAI: boolean;
  onToggleAI: () => void;
  onOpenSettings: () => void;
}

export function ActivityBar({ activeView, onViewChange, showAI, onToggleAI, onOpenSettings }: Props) {
  return (
    <nav className={styles.bar}>
      <button
        className={`${styles.item} ${activeView === 'explorer' ? styles.active : ''}`}
        onClick={() => onViewChange('explorer')}
        title="Explorer (Ctrl+Shift+E)"
      >
        <Files size={24} strokeWidth={1.25} />
      </button>
      <button
        className={`${styles.item} ${activeView === 'search' ? styles.active : ''}`}
        onClick={() => onViewChange('search')}
        title="Search (Ctrl+Shift+F)"
      >
        <Search size={24} strokeWidth={1.25} />
      </button>
      <button
        className={`${styles.item} ${activeView === 'git' ? styles.active : ''}`}
        onClick={() => onViewChange('git')}
        title="Source Control (Ctrl+Shift+G)"
      >
        <GitBranch size={24} strokeWidth={1.25} />
      </button>
      <button
        className={`${styles.item} ${activeView === 'promptlab' ? styles.active : ''}`}
        onClick={() => onViewChange('promptlab')}
        title="Prompt Lab"
      >
        <Sparkles size={24} strokeWidth={1.25} />
      </button>
      <button
        className={`${styles.item} ${activeView === 'collaboration' ? styles.active : ''}`}
        onClick={() => onViewChange('collaboration')}
        title="Live Share (Ctrl+Shift+L)"
      >
        <Users size={24} strokeWidth={1.25} />
      </button>
      <div className={styles.spacer} />
      <button
        className={`${styles.item} ${showAI ? styles.active : ''}`}
        onClick={onToggleAI}
        title="Chat (Ctrl+L)"
      >
        <MessageSquare size={24} strokeWidth={1.25} />
      </button>
      <button className={styles.item} onClick={onOpenSettings} title="Settings">
        <Settings size={22} strokeWidth={1.25} />
      </button>
    </nav>
  );
}
