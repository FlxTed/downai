import { useState, useRef, useEffect } from 'react';
import { ArrowUp, X } from 'lucide-react';
import { notifyAiComplete } from '../utils/notifyAiComplete';
import { AiStatusLine } from './AiStatusLine';
import styles from './InlineEdit.module.css';

interface Props {
  selection: string;
  language: string;
  replaceAll?: boolean;
  onClose: () => void;
  onApply: (newCode: string) => void;
}

export function InlineEdit({ selection, language, replaceAll, onClose, onApply }: Props) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const run = async () => {
    const text = prompt.trim();
    if (!text || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await window.downai.ai.chat(
        [{
          role: 'user',
          content: `${text}\n\n${replaceAll ? 'Full file' : 'Selected code'} (${language}):\n\`\`\`${language}\n${selection}\n\`\`\`\n\nReturn ONLY the modified code, no explanation.`,
        }],
        selection
      );
      const code = response.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
      setPreview(code);
      void notifyAiComplete({ prompt: text, success: true, kind: 'edit' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Edit failed';
      setError(msg);
      setPreview(null);
      void notifyAiComplete({ prompt: text, success: false, kind: 'edit', error: msg });
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (preview) onApply(preview);
      else run();
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.box} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <span>{replaceAll ? 'Edit file' : 'Edit selected code'}</span>
          <button onClick={onClose}><X size={14} /></button>
        </div>
        {preview ? (
          <pre className={styles.preview}>{preview}</pre>
        ) : (
          <p className={styles.selectionHint}>
            {replaceAll ? 'Editing entire file' : selection.slice(0, 120)}{!replaceAll && selection.length > 120 ? '…' : ''}
          </p>
        )}
        {error && <p className={styles.error}>{error}</p>}
        {loading && (
          <div className={styles.statusRow}>
            <AiStatusLine active={loading} variant="edit" phase="generating" />
          </div>
        )}
        <div className={styles.inputRow}>
          <textarea
            ref={inputRef}
            className={styles.input}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={onKey}
            placeholder="Describe your edit…"
            rows={2}
            disabled={loading}
          />
          <button className={styles.send} onClick={preview ? () => onApply(preview) : run} disabled={loading || (!preview && !prompt.trim())}>
            <ArrowUp size={14} />
          </button>
        </div>
        <p className={styles.hint}>Enter to {preview ? 'apply' : 'generate'} · Esc to cancel · Ctrl+K</p>
      </div>
    </div>
  );
}
