import { useState, useEffect, useRef } from 'react';
import styles from './CommandPalette.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
  onGo: (line: number) => void;
}

export function GoToLineModal({ open, onClose, onGo }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const submit = () => {
    const line = parseInt(value, 10);
    if (line >= 1) {
      onGo(line);
      onClose();
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.palette} onClick={e => e.stopPropagation()} style={{ width: 360 }}>
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          onChange={e => setValue(e.target.value.replace(/\D/g, ''))}
          onKeyDown={onKey}
          placeholder="Go to line…"
          inputMode="numeric"
        />
      </div>
    </div>
  );
}
