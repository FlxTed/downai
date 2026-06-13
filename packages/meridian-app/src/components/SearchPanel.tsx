import { useState, useEffect, useRef } from 'react';
import { useEditorStore } from '../store/editorStore';
import { useOutputStore } from '../store/outputStore';
import styles from './SearchPanel.module.css';

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [replace, setReplace] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [results, setResults] = useState<{ path: string; line: number; preview: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const { openFileAtLine, refreshTree } = useEditorStore();
  const appendOutput = useOutputStore(s => s.append);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const searchOptions = { caseSensitive, regex: useRegex };

  const handleSearch = async (q = query) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await window.downai.search.files(trimmed, searchOptions);
      setResults(res);
    } finally {
      setSearching(false);
    }
  };

  const handleReplaceAll = async () => {
    if (!query.trim()) return;
    const ok = window.confirm(`Replace all occurrences of "${query}" in project?`);
    if (!ok) return;
    setReplacing(true);
    try {
      const result = await window.downai.search.replaceInFiles(query, replace, searchOptions);
      appendOutput(`Replaced ${result.replacements} occurrence(s) in ${result.files} file(s)`);
      await refreshTree();
      await handleSearch();
    } catch (e) {
      appendOutput(`Replace failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setReplacing(false);
    }
  };

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => handleSearch(query), 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, caseSensitive, useRegex]);

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Search</span>
        <button
          className={styles.searchBtn}
          style={{ fontSize: 11, padding: '2px 8px' }}
          onClick={() => setShowReplace(v => !v)}
        >
          {showReplace ? 'Hide replace' : 'Replace'}
        </button>
      </div>
      <div className={styles.inputWrap}>
        <input
          type="text"
          className={styles.input}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search in files"
        />
        <button className={styles.searchBtn} onClick={() => handleSearch()} disabled={searching}>
          {searching ? '…' : 'Go'}
        </button>
      </div>
      {showReplace && (
        <div className={styles.inputWrap}>
          <input
            type="text"
            className={styles.input}
            value={replace}
            onChange={e => setReplace(e.target.value)}
            placeholder="Replace with"
          />
          <button className={styles.searchBtn} onClick={handleReplaceAll} disabled={replacing || !query.trim()}>
            {replacing ? '…' : 'All'}
          </button>
        </div>
      )}
      <div className={styles.options}>
        <label className={styles.option}>
          <input type="checkbox" checked={caseSensitive} onChange={e => setCaseSensitive(e.target.checked)} />
          Aa
        </label>
        <label className={styles.option}>
          <input type="checkbox" checked={useRegex} onChange={e => setUseRegex(e.target.checked)} />
          .*
        </label>
      </div>
      <div className={styles.results}>
        {results.map((r, i) => (
          <button
            key={`${r.path}-${r.line}-${i}`}
            className={styles.result}
            onClick={() => openFileAtLine(r.path, r.line)}
          >
            <span className={styles.resultPath}>{r.path}:{r.line}</span>
            <span className={styles.resultPreview}>{r.preview}</span>
          </button>
        ))}
        {results.length === 0 && query && !searching && (
          <p className={styles.hint}>No results</p>
        )}
      </div>
    </aside>
  );
}
