import { useState } from 'react';
import { Sparkles, Copy, Check } from 'lucide-react';
import { useOutputStore } from '../store/outputStore';
import styles from './SearchPanel.module.css';

const MODES = [
  { id: 'both', label: 'Chat + Edit' },
  { id: 'chat', label: 'Chat only' },
  { id: 'edit', label: 'Edit only' },
] as const;

const OUTPUTS = [
  { id: 'concise', label: 'Concise' },
  { id: 'detailed', label: 'Detailed' },
  { id: 'step-by-step', label: 'Step-by-step' },
] as const;

export function PromptLabPanel() {
  const [goal, setGoal] = useState('');
  const [mode, setMode] = useState<string>('both');
  const [output, setOutput] = useState('concise');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, string> | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const appendOutput = useOutputStore(s => s.append);

  const generate = async () => {
    const text = goal.trim();
    if (!text || loading) return;
    setLoading(true);
    setResults(null);
    try {
      const data = await window.downai.ai.prompts({ goal: text, mode, output });
      setResults(data.prompts);
      appendOutput('Prompt Lab: generated prompts');
    } catch (e) {
      appendOutput(`Prompt Lab failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const copy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          <Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />
          Prompt Lab
        </span>
      </div>
      <div className={styles.inputWrap} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <textarea
          className={styles.input}
          style={{ minHeight: 72, resize: 'vertical', fontFamily: 'inherit' }}
          value={goal}
          onChange={e => setGoal(e.target.value)}
          placeholder="Describe what you want DownAI to do…"
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <select
            className={styles.input}
            value={mode}
            onChange={e => setMode(e.target.value)}
            style={{ flex: 1 }}
          >
            {MODES.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <select
            className={styles.input}
            value={output}
            onChange={e => setOutput(e.target.value)}
            style={{ flex: 1 }}
          >
            {OUTPUTS.map(o => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <button className={styles.searchBtn} onClick={generate} disabled={loading || !goal.trim()}>
          {loading ? 'Generating…' : 'Generate prompts'}
        </button>
      </div>
      <div className={styles.results}>
        {results && Object.entries(results).map(([key, value]) => (
          <div key={key} className={styles.result} style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className={styles.resultPath}>{key}</span>
              <button
                className={styles.searchBtn}
                style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => copy(key, value)}
              >
                {copied === key ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
            <pre style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', margin: 0 }}>
              {value}
            </pre>
          </div>
        ))}
        {!results && !loading && (
          <p className={styles.hint}>Generate ready-to-use system prompts for chat and inline edit.</p>
        )}
      </div>
    </aside>
  );
}
