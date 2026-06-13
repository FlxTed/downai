import { useState, useEffect } from 'react';
import { X, Plus, AlertCircle, AlertTriangle } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useOutputStore } from '../store/outputStore';
import { useProblemsStore } from '../store/problemsStore';
import { Terminal } from './Terminal';
import styles from './BottomPanel.module.css';

const TABS = ['Problems', 'Output', 'Terminal'] as const;
type Tab = typeof TABS[number];

interface TermTab {
  id: string;
  label: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  newTerminalSignal?: number;
}

export function BottomPanel({ visible, onClose, newTerminalSignal = 0 }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('Terminal');
  const [termTabs, setTermTabs] = useState<TermTab[]>([{ id: '1', label: 'Terminal 1' }]);
  const [activeTermId, setActiveTermId] = useState('1');
  const { projectPath, openFileAtLine } = useEditorStore();
  const { lines, clear } = useOutputStore();
  const problems = useProblemsStore(s => s.problems);
  const errorCount = problems.filter(p => p.severity === 'error').length;
  const warningCount = problems.filter(p => p.severity === 'warning').length;

  useEffect(() => {
    if (newTerminalSignal > 0) {
      const id = String(Date.now());
      setTermTabs(tabs => [...tabs, { id, label: `Terminal ${tabs.length + 1}` }]);
      setActiveTermId(id);
      setActiveTab('Terminal');
    }
  }, [newTerminalSignal]);

  if (!visible) return null;

  const closeTermTab = (id: string) => {
    if (termTabs.length <= 1) return;
    setTermTabs(tabs => {
      const next = tabs.filter(t => t.id !== id);
      if (activeTermId === id) setActiveTermId(next[0]?.id ?? '1');
      return next;
    });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          {TABS.map(tab => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
              {tab === 'Problems' && problems.length > 0 && (
                <span className={styles.badge}>
                  {errorCount > 0 ? errorCount : warningCount}
                </span>
              )}
            </button>
          ))}
          {activeTab === 'Terminal' && termTabs.map(t => (
            <button
              key={t.id}
              className={`${styles.termSubTab} ${activeTermId === t.id ? styles.activeTermSubTab : ''}`}
              onClick={() => setActiveTermId(t.id)}
            >
              {t.label}
              {termTabs.length > 1 && (
                <span className={styles.termClose} onClick={(e) => { e.stopPropagation(); closeTermTab(t.id); }}>×</span>
              )}
            </button>
          ))}
        </div>
        <div className={styles.tabActions}>
          {activeTab === 'Terminal' && (
            <button
              className={styles.tabAction}
              onClick={() => {
                const id = String(Date.now());
                setTermTabs(tabs => [...tabs, { id, label: `Terminal ${tabs.length + 1}` }]);
                setActiveTermId(id);
              }}
              title="New Terminal"
            >
              <Plus size={14} />
            </button>
          )}
          {activeTab === 'Output' && (
            <button className={styles.tabAction} onClick={clear} title="Clear Output">⌫</button>
          )}
          <button className={styles.tabAction} onClick={onClose} title="Close Panel">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className={styles.content}>
        {activeTab === 'Terminal' && termTabs.map(t => (
          <div
            key={t.id}
            className={styles.termPane}
            style={{ display: activeTermId === t.id ? 'flex' : 'none' }}
          >
            <Terminal cwd={projectPath} active={activeTermId === t.id} />
          </div>
        ))}
        {activeTab === 'Output' && (
          <pre className={styles.output}>{lines.length ? lines.join('\n') : 'Output will appear here…'}</pre>
        )}
        {activeTab === 'Problems' && (
          <div className={styles.problemsList}>
            {problems.length === 0 && (
              <div className={styles.placeholder}>No problems detected.</div>
            )}
            {problems.map(p => (
              <button
                key={p.id}
                className={styles.problemRow}
                onClick={() => openFileAtLine(p.path, p.line)}
              >
                {p.severity === 'error' ? (
                  <AlertCircle size={14} className={styles.errorIcon} />
                ) : (
                  <AlertTriangle size={14} className={styles.warningIcon} />
                )}
                <span className={styles.problemMsg}>{p.message}</span>
                <span className={styles.problemLoc}>{p.path}:{p.line}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
