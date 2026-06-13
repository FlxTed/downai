import { ChevronRight } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import styles from './Breadcrumbs.module.css';

export function Breadcrumbs() {
  const { activeFilePath, revealInExplorer } = useEditorStore();

  if (!activeFilePath) return null;

  const parts = activeFilePath.split(/[/\\]/).filter(Boolean);

  const navigateTo = (index: number) => {
    if (index < parts.length - 1) {
      const folderPath = parts.slice(0, index + 1).join('/');
      revealInExplorer(folderPath);
    }
  };

  return (
    <nav className={styles.crumb}>
      {parts.map((part, i) => (
        <span key={i} className={styles.segment}>
          {i > 0 && <ChevronRight size={12} className={styles.sep} />}
          <button
            type="button"
            className={`${styles.part} ${i === parts.length - 1 ? styles.active : ''}`}
            onClick={() => navigateTo(i)}
            disabled={i === parts.length - 1}
          >
            {part}
          </button>
        </span>
      ))}
    </nav>
  );
}
