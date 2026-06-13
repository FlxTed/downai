import { useState, useEffect, useRef, useMemo } from 'react';
import { useEditorStore } from '../store/editorStore';
import { flattenFiles, fuzzyMatch } from '../utils/fileTree';
import styles from './CommandPalette.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function QuickOpen({ open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { fileTree, openFileAtLine, recentFilePaths } = useEditorStore();

  const files = useMemo(() => flattenFiles(fileTree), [fileTree]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      const recent = recentFilePaths
        .map(p => files.find(f => f.path === p))
        .filter(Boolean) as typeof files;
      const rest = files.filter(f => !recentFilePaths.includes(f.path));
      return [...recent, ...rest].slice(0, 30);
    }
    return files.filter(f => fuzzyMatch(query, f.path) || fuzzyMatch(query, f.name)).slice(0, 30);
  }, [files, query, recentFilePaths]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const openSelected = async (path: string) => {
    await openFileAtLine(path, 1);
    onClose();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, filtered.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    }
    if (e.key === 'Enter' && filtered[selected]) {
      e.preventDefault();
      openSelected(filtered[selected].path);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.palette} onClick={e => e.stopPropagation()}>
        <input
          ref={inputRef}
          className={styles.input}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="Go to file…"
        />
        <ul className={styles.list}>
          {filtered.map((f, i) => (
            <li key={f.path}>
              <button
                className={`${styles.item} ${i === selected ? styles.selected : ''}`}
                onClick={() => openSelected(f.path)}
              >
                <span>{f.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f.path}</span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className={styles.empty}>No matching files</li>
          )}
        </ul>
      </div>
    </div>
  );
}
