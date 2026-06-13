import { VertexLogo } from './VertexLogo';
import styles from './EmptyEditor.module.css';

const SHORTCUTS = [
  { label: 'Open Folder', keys: 'Ctrl + O' },
  { label: 'Go to File', keys: 'Ctrl + P' },
  { label: 'Find in File', keys: 'Ctrl + F' },
  { label: 'Go to Line', keys: 'Ctrl + G' },
  { label: 'Save File', keys: 'Ctrl + S' },
  { label: 'Save As', keys: 'Ctrl + Shift + S' },
  { label: 'Save All', keys: 'Ctrl + Alt + S' },
  { label: 'Format Document', keys: 'Shift + Alt + F' },
  { label: 'Close Tab', keys: 'Ctrl + W' },
  { label: 'Toggle Sidebar', keys: 'Ctrl + B' },
  { label: 'Command Palette', keys: 'Ctrl + Shift + P' },
  { label: 'Search in Files', keys: 'Ctrl + Shift + F' },
  { label: 'Show Terminal', keys: 'Ctrl + J' },
  { label: 'Inline Edit', keys: 'Ctrl + K' },
  { label: 'Toggle Chat', keys: 'Ctrl + L' },
];

export function EmptyEditor() {
  return (
    <div className={styles.screen}>
      <VertexLogo size={120} />
      <ul className={styles.shortcuts}>
        {SHORTCUTS.map(s => (
          <li key={s.label} className={styles.shortcut}>
            <span className={styles.label}>{s.label}</span>
            <span className={styles.keys}>{s.keys}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
