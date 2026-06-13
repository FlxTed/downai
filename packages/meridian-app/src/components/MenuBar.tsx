import { useState, useRef, useEffect } from 'react';
import styles from './MenuBar.module.css';

const MENU_ITEMS: Record<string, { label: string; shortcut?: string; action: string }[]> = {
  File: [
    { label: 'Open Folder…', shortcut: 'Ctrl+O', action: 'open-folder' },
    { label: 'Save', shortcut: 'Ctrl+S', action: 'save' },
    { label: 'Save As…', shortcut: 'Ctrl+Shift+S', action: 'save-as' },
    { label: 'Save All', shortcut: 'Ctrl+Alt+S', action: 'save-all' },
    { label: 'Close Editor', action: 'close-editor' },
  ],
  Edit: [
    { label: 'Command Palette', shortcut: 'Ctrl+Shift+P', action: 'palette' },
    { label: 'Inline Edit', shortcut: 'Ctrl+K', action: 'inline-edit' },
    { label: 'Find in Files', shortcut: 'Ctrl+Shift+F', action: 'search' },
  ],
  View: [
    { label: 'Explorer', shortcut: 'Ctrl+Shift+E', action: 'explorer' },
    { label: 'Source Control', shortcut: 'Ctrl+Shift+G', action: 'git' },
    { label: 'Live Share', shortcut: 'Ctrl+Shift+L', action: 'collaboration' },
    { label: 'Toggle Chat', shortcut: 'Ctrl+L', action: 'toggle-chat' },
    { label: 'Toggle Terminal', shortcut: 'Ctrl+J', action: 'toggle-terminal' },
  ],
  Go: [
    { label: 'Go to File…', shortcut: 'Ctrl+P', action: 'quick-open' },
  ],
  Run: [
    { label: 'Save All', shortcut: 'Ctrl+Alt+S', action: 'save-all' },
  ],
  Terminal: [
    { label: 'New Terminal', action: 'new-terminal' },
    { label: 'Toggle Terminal', shortcut: 'Ctrl+J', action: 'toggle-terminal' },
  ],
  Help: [
    { label: 'Settings', action: 'settings' },
    { label: 'Upgrade to Pro', action: 'upgrade' },
  ],
};

interface Props {
  onAction: (action: string) => void;
}

export function MenuBar({ onAction }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <nav className={styles.bar} ref={ref}>
      <div className={styles.brand} aria-hidden="true">
        <img src="/logo.svg" alt="" width={18} height={18} draggable={false} />
      </div>
      <div className={styles.menus}>
        {Object.keys(MENU_ITEMS).map(menu => (
          <div key={menu} className={styles.menuWrap}>
            <button
              className={`${styles.menuItem} ${openMenu === menu ? styles.menuOpen : ''}`}
              onClick={() => setOpenMenu(openMenu === menu ? null : menu)}
              onMouseEnter={() => openMenu && setOpenMenu(menu)}
            >
              {menu}
            </button>
            {openMenu === menu && (
              <div className={styles.dropdown}>
                {MENU_ITEMS[menu].map(item => (
                  <button
                    key={item.action + item.label}
                    className={styles.dropdownItem}
                    onClick={() => { onAction(item.action); setOpenMenu(null); }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <span className={styles.shortcut}>{item.shortcut}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}
