import { X } from 'lucide-react';
import styles from './KeyboardShortcutsModal.module.css';

const GROUPS = [
  {
    title: 'General',
    items: [
      ['Command Palette', 'Ctrl+Shift+P'],
      ['Go to File', 'Ctrl+P'],
      ['Keyboard Shortcuts', 'Ctrl+Shift+/'],
      ['Settings', 'Ctrl+,'],
      ['Zen Mode', 'Ctrl+K Z'],
    ],
  },
  {
    title: 'Editor',
    items: [
      ['Save', 'Ctrl+S'],
      ['Save As', 'Ctrl+Shift+S'],
      ['Save All', 'Ctrl+Alt+S'],
      ['Find in File', 'Ctrl+F'],
      ['Replace in File', 'Ctrl+H'],
      ['Go to Line', 'Ctrl+G'],
      ['Format Document', 'Shift+Alt+F'],
      ['Inline Edit', 'Ctrl+K'],
      ['Duplicate Line', 'Ctrl+Shift+D'],
      ['Split Editor', 'Ctrl+\\'],
      ['Toggle Minimap', 'Ctrl+Shift+M'],
      ['Toggle Word Wrap', 'Alt+Z'],
    ],
  },
  {
    title: 'Navigation',
    items: [
      ['Explorer', 'Ctrl+Shift+E'],
      ['Search in Files', 'Ctrl+Shift+F'],
      ['Source Control', 'Ctrl+Shift+G'],
      ['Live Share', 'Ctrl+Shift+L'],
      ['Toggle Sidebar', 'Ctrl+B'],
      ['Reveal in Explorer', 'Ctrl+Shift+E'],
      ['Close Tab', 'Ctrl+W'],
      ['Reopen Closed Tab', 'Ctrl+Shift+T'],
    ],
  },
  {
    title: 'AI & Panels',
    items: [
      ['Toggle Chat', 'Ctrl+L'],
      ['Toggle Terminal', 'Ctrl+J'],
      ['New Terminal', 'Ctrl+Shift+`'],
      ['Prompt Lab', 'View menu'],
    ],
  },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsModal({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Keyboard Shortcuts</h2>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={styles.body}>
          {GROUPS.map(group => (
            <section key={group.title} className={styles.group}>
              <h3>{group.title}</h3>
              {group.items.map(([label, keys]) => (
                <div key={label} className={styles.row}>
                  <span>{label}</span>
                  <kbd>{keys}</kbd>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
