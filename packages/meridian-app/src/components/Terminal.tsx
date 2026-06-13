import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import styles from './Terminal.module.css';

interface Props {
  cwd: string | null;
  active: boolean;
}

export function Terminal({ cwd, active }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const termIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hostRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, "Courier New", monospace',
      lineHeight: 1.2,
      scrollback: 5000,
      allowProposedApi: true,
      theme: {
        background: '#181818',
        foreground: '#cccccc',
        cursor: '#cccccc',
        cursorAccent: '#181818',
        selectionBackground: '#3a3a3a',
        black: '#181818',
        red: '#f14c4c',
        green: '#23d18b',
        yellow: '#f5f543',
        blue: '#3b8eea',
        magenta: '#d670d6',
        cyan: '#29b8db',
        white: '#cccccc',
        brightBlack: '#666666',
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    termRef.current = term;

    const focusTerm = () => term.focus();

    hostRef.current.addEventListener('mousedown', focusTerm);

    let unsubData: (() => void) | null = null;
    let unsubExit: (() => void) | null = null;
    let ro: ResizeObserver | null = null;
    let disposed = false;

    const init = async () => {
      try {
        const id = await window.downai.terminal.create(cwd || undefined);
        if (disposed) {
          window.downai.terminal.kill(id);
          term.dispose();
          return;
        }

        termIdRef.current = id;

        unsubData = window.downai.terminal.onData((tid, data) => {
          if (tid === id) term.write(data);
        });

        unsubExit = window.downai.terminal.onExit((tid) => {
          if (tid === id) term.write('\r\n\x1b[90m[Process exited]\x1b[0m\r\n');
        });

        term.onData((data) => window.downai.terminal.write(id, data));

        const syncSize = () => {
          if (!hostRef.current) return;
          fit.fit();
          window.downai.terminal.resize(id, term.cols, term.rows);
        };

        syncSize();
        requestAnimationFrame(syncSize);
        setTimeout(focusTerm, 50);

        ro = new ResizeObserver(() => syncSize());
        ro.observe(hostRef.current!);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to start terminal';
        term.writeln(`\x1b[31m${msg}\x1b[0m`);
      }
    };

    void init();

    return () => {
      disposed = true;
      hostRef.current?.removeEventListener('mousedown', focusTerm);
      ro?.disconnect();
      unsubData?.();
      unsubExit?.();
      if (termIdRef.current) {
        window.downai.terminal.kill(termIdRef.current);
        termIdRef.current = null;
      }
      termRef.current = null;
      term.dispose();
    };
  }, [cwd]);

  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => termRef.current?.focus());
    }
  }, [active]);

  return <div ref={hostRef} className={styles.host} tabIndex={0} onFocus={() => termRef.current?.focus()} />;
}
