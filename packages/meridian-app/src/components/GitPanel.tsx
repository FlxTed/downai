import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, GitCompare } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useOutputStore } from '../store/outputStore';
import { GitDiffModal } from './GitDiffModal';
import styles from './SearchPanel.module.css';

interface GitFileEntry {
  path: string;
  index: string;
  work: string;
  staged: boolean;
  display: string;
}

function statusLabel(entry: GitFileEntry) {
  if (entry.index === '?' && entry.work === '?') return 'U';
  if (entry.index === 'D' || entry.work === 'D') return 'D';
  if (entry.index === 'A') return 'A';
  if (entry.staged) return 'S';
  return 'M';
}

export function GitPanel() {
  const { projectPath, openFile, refreshTree } = useEditorStore();
  const appendOutput = useOutputStore(s => s.append);
  const [status, setStatus] = useState<{
    isRepo: boolean;
    branch: string | null;
    changed: number;
    files: GitFileEntry[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [committing, setCommitting] = useState(false);
  const [branches, setBranches] = useState<{ name: string; current: boolean }[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [diffState, setDiffState] = useState<{ path: string; diff: string; staged: boolean } | null>(null);

  const refresh = useCallback(async () => {
    if (!projectPath) return;
    setLoading(true);
    try {
      const [s, b] = await Promise.all([
        window.downai.git.status(),
        window.downai.git.branches(),
      ]);
      setStatus(s);
      setBranches(b);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  const onCommit = async () => {
    const msg = commitMsg.trim();
    if (!msg) return;
    setCommitting(true);
    try {
      await window.downai.git.commit(msg);
      appendOutput(`Committed: ${msg}`);
      setCommitMsg('');
      await refresh();
    } catch (e) {
      appendOutput(`Commit failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setCommitting(false);
    }
  };

  const stage = async (path: string) => {
    await window.downai.git.stage(path);
    await refresh();
  };

  const unstage = async (path: string) => {
    await window.downai.git.unstage(path);
    await refresh();
  };

  const discard = async (path: string) => {
    if (!window.confirm(`Discard changes in ${path}?`)) return;
    await window.downai.git.discard(path);
    await refreshTree();
    await refresh();
  };

  const initRepo = async () => {
    await window.downai.git.init();
    appendOutput('Initialized git repository');
    await refresh();
  };

  const showDiff = async (path: string, staged: boolean) => {
    const diff = await window.downai.git.diff(path, staged);
    setDiffState({ path, diff, staged });
  };

  const checkoutBranch = async (branch: string) => {
    setCheckingOut(true);
    try {
      await window.downai.git.checkout(branch);
      appendOutput(`Switched to branch ${branch}`);
      await refreshTree();
      await refresh();
    } catch (e) {
      appendOutput(`Checkout failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setCheckingOut(false);
    }
  };

  const staged = status?.files.filter(f => f.staged) ?? [];
  const unstaged = status?.files.filter(f => !f.staged) ?? [];

  const renderFile = (f: GitFileEntry, stagedFile: boolean) => (
    <div key={`${stagedFile ? 's' : 'u'}-${f.path}`} className={styles.gitFile}>
      <span className={styles.gitStatus}>{statusLabel(f)}</span>
      <button className={styles.resultPath} style={{ flex: 1, textAlign: 'left' }} onClick={() => openFile(f.path)}>
        {f.path}
      </button>
      <div className={styles.gitActions}>
        <button className={styles.gitAction} title="View diff" onClick={() => showDiff(f.path, stagedFile)}>
          <GitCompare size={12} />
        </button>
        {stagedFile ? (
          <button className={styles.gitAction} onClick={() => unstage(f.path)}>−</button>
        ) : (
          <>
            <button className={styles.gitAction} onClick={() => stage(f.path)}>+</button>
            {f.index !== '?' && (
              <button className={styles.gitAction} onClick={() => discard(f.path)}>↩</button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Source Control</span>
        <button className={styles.searchBtn} onClick={refresh} disabled={loading} title="Refresh">
          <RefreshCw size={14} />
        </button>
      </div>

      {!status?.isRepo && (
        <>
          <p className={styles.hint}>Not a git repository.</p>
          <button type="button" className={styles.initBtn} onClick={initRepo}>
            Initialize Repository
          </button>
        </>
      )}

      {status?.isRepo && (
        <>
          <p className={styles.hint} style={{ paddingBottom: 0 }}>
            Branch:{' '}
            <select
              className={styles.input}
              style={{ width: 'auto', display: 'inline-block', marginLeft: 4 }}
              value={status.branch || ''}
              disabled={checkingOut || branches.length === 0}
              onChange={e => checkoutBranch(e.target.value)}
            >
              {branches.map(b => (
                <option key={b.name} value={b.name}>{b.name}{b.current ? ' ✓' : ''}</option>
              ))}
            </select>
            {status.changed > 0 && ` · ${status.changed} change${status.changed === 1 ? '' : 's'}`}
          </p>

          <div className={styles.commitBox}>
            <input
              type="text"
              className={styles.commitInput}
              value={commitMsg}
              onChange={e => setCommitMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onCommit()}
              placeholder="Commit message"
            />
            <button
              type="button"
              className={styles.commitBtn}
              onClick={onCommit}
              disabled={committing || !commitMsg.trim() || staged.length === 0}
            >
              {committing ? 'Committing…' : `Commit ${staged.length} staged`}
            </button>
          </div>

          <div className={styles.results}>
            {staged.length > 0 && (
              <div className={styles.gitSection}>
                <div className={styles.gitSectionTitle}>Staged</div>
                {staged.map(f => renderFile(f, true))}
              </div>
            )}

            {unstaged.length > 0 && (
              <div className={styles.gitSection}>
                <div className={styles.gitSectionTitle}>Changes</div>
                {unstaged.map(f => renderFile(f, false))}
              </div>
            )}

            {status.files.length === 0 && (
              <p className={styles.hint}>Working tree clean</p>
            )}
          </div>
        </>
      )}
    </aside>
    {diffState && (
      <GitDiffModal
        open
        filePath={diffState.path}
        diff={diffState.diff}
        staged={diffState.staged}
        onClose={() => setDiffState(null)}
      />
    )}
    </>
  );
}
