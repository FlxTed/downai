import { useEffect, useState } from 'react';
import { FolderOpen, Download, MessageSquare } from 'lucide-react';
import { VertexLogo } from './VertexLogo';
import { useEditorStore } from '../store/editorStore';
import styles from './WelcomeScreen.module.css';

interface RecentProject {
  name: string;
  path: string;
  openedAt: number;
}

interface Props {
  onOpenFolder: () => void;
  onOpenSettings: () => void;
  onUpgrade: () => void;
  onClone: () => void;
  onOpenChat: () => void;
}

export function WelcomeScreen({ onOpenFolder, onOpenSettings, onUpgrade, onClone, onOpenChat }: Props) {
  const [recents, setRecents] = useState<RecentProject[]>([]);
  const { openProject } = useEditorStore();

  useEffect(() => {
    window.downai.recents.list().then(setRecents);
  }, []);

  const openRecent = async (projectPath: string) => {
    const result = await window.downai.recents.open(projectPath);
    if (result) openProject(result.path, result.tree);
  };

  const actions = [
    { icon: FolderOpen, label: 'Open project', onClick: onOpenFolder },
    { icon: MessageSquare, label: 'Open Chat', onClick: onOpenChat },
    { icon: Download, label: 'Clone repo', onClick: onClone },
  ];

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <div className={styles.brand}>
          <VertexLogo size={56} />
          <h1 className={styles.brandName}>DownAI</h1>
        </div>
        <p className={styles.subtitle}>
          <button className={styles.proLink} onClick={onUpgrade}>Pro</button>
          <span className={styles.dot}>·</span>
          <button className={styles.settingsLink} onClick={onOpenSettings}>Settings</button>
        </p>

        <div className={styles.actions}>
          {actions.map(({ icon: Icon, label, onClick, disabled }) => (
            <button
              key={label}
              className={styles.action}
              onClick={onClick}
              disabled={disabled}
            >
              <Icon size={16} strokeWidth={1.5} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {recents.length > 0 && (
          <div className={styles.recents}>
            <div className={styles.recentsHeader}>
              <span>Recent projects</span>
            </div>
            <ul className={styles.recentsList}>
              {recents.slice(0, 8).map(project => (
                <li key={project.path}>
                  <button
                    className={styles.recentItem}
                    onClick={() => openRecent(project.path)}
                  >
                    <span className={styles.recentName}>{project.name}</span>
                    <span className={styles.recentPath}>{project.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
