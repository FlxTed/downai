import { useEffect, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useLicenseStore } from '../store/licenseStore';
import { useProblemsStore } from '../store/problemsStore';
import { useCollaborationStore } from '../store/collaborationStore';
import styles from './StatusBar.module.css';

function detectIndent(content: string): string {
  const line = content.split('\n').find(l => /^\s+\S/.test(l));
  if (!line) return 'Spaces: 2';
  const m = line.match(/^(\s+)/);
  if (!m) return 'Spaces: 2';
  return m[1].includes('\t') ? 'Tab' : `Spaces: ${m[1].length}`;
}

function detectEol(content: string): string {
  return content.includes('\r\n') ? 'CRLF' : 'LF';
}

export function StatusBar() {
  const { projectPath, activeFilePath, openFiles, cursorLine, cursorColumn } = useEditorStore();
  const { status } = useLicenseStore();
  const collabStatus = useCollaborationStore(s => s.status);
  const collabPeers = useCollaborationStore(s => s.peers);
  const roomCode = useCollaborationStore(s => s.roomCode);
  const problems = useProblemsStore(s => s.problems);
  const activeFile = openFiles.find(f => f.path === activeFilePath);
  const [gitBranch, setGitBranch] = useState<string | null>(null);
  const isWelcome = !projectPath;
  const errorCount = problems.filter(p => p.severity === 'error').length;
  const warningCount = problems.filter(p => p.severity === 'warning').length;

  useEffect(() => {
    if (!projectPath) return;
    window.downai.git.status().then(s => {
      setGitBranch(s.isRepo ? s.branch : null);
    });
  }, [projectPath, activeFile?.isDirty]);

  if (isWelcome) {
    return (
      <footer className={`${styles.bar} ${styles.welcome}`}>
        <div className={styles.left}>
          <span className={styles.item}>DownAI</span>
        </div>
      </footer>
    );
  }

  return (
    <footer className={styles.bar}>
      <div className={styles.left}>
        <span className={`${styles.planBadge} ${status.isPro ? styles.pro : ''}`}>
          {status.isPro ? 'Pro' : 'Free'}
        </span>
        {collabStatus === 'connected' && roomCode && (
          <span className={styles.collabBadge} title={`Live Share · ${collabPeers.length + 1} in session`}>
            Live · {roomCode}
          </span>
        )}
        {gitBranch && <span className={styles.item}>⎇ {gitBranch}</span>}
        {(errorCount > 0 || warningCount > 0) && (
          <span className={styles.item}>
            {errorCount > 0 && <span className={styles.errorCount}>✕ {errorCount}</span>}
            {warningCount > 0 && <span className={styles.warningCount}>⚠ {warningCount}</span>}
          </span>
        )}
      </div>
      <div className={styles.right}>
        {activeFile && (
          <>
            <span className={styles.item}>{detectIndent(activeFile.content)}</span>
            <span className={styles.item}>{detectEol(activeFile.content)}</span>
            <span className={styles.item}>UTF-8</span>
            <span className={styles.item}>{activeFile.language}</span>
            <span className={styles.item}>Ln {cursorLine}, Col {cursorColumn}</span>
          </>
        )}
      </div>
    </footer>
  );
}
