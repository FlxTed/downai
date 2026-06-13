import { useEffect, useState } from 'react';
import styles from './AiStatusLine.module.css';

const CHAT_GENERATING = ['Thinking', 'Planning next moves', 'Generating'];
const EDIT_GENERATING = ['Thinking', 'Planning edit', 'Applying changes'];

interface Props {
  active: boolean;
  variant?: 'chat' | 'edit';
  phase?: 'context' | 'generating' | null;
}

export function AiStatusLine({ active, variant = 'chat', phase = 'generating' }: Props) {
  const [index, setIndex] = useState(0);

  const generatingPhrases = variant === 'edit' ? EDIT_GENERATING : CHAT_GENERATING;

  useEffect(() => {
    if (!active || phase === 'context') return;
    setIndex(0);
    const id = window.setInterval(() => {
      setIndex(i => (i + 1) % generatingPhrases.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [active, phase, generatingPhrases.length]);

  if (!active) return null;

  const label = phase === 'context' ? 'Reading context' : generatingPhrases[index];

  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <span className={styles.dots} aria-hidden="true">
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
      </span>
      <span key={label} className={styles.label}>
        {label}
      </span>
    </div>
  );
}
