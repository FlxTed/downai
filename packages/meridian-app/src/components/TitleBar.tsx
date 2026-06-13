import { Minus, Square, X } from 'lucide-react';
import styles from './TitleBar.module.css';

export function TitleBar() {
  return (
    <div className={styles.controls}>
      <button className={styles.winBtn} onClick={() => window.downai.window.minimize()}>
        <Minus size={14} />
      </button>
      <button className={styles.winBtn} onClick={() => window.downai.window.maximize()}>
        <Square size={11} />
      </button>
      <button className={`${styles.winBtn} ${styles.closeBtn}`} onClick={() => window.downai.window.close()}>
        <X size={14} />
      </button>
    </div>
  );
}
