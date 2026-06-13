import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { randomUUID } from 'crypto';
import os from 'os';
import type { BrowserWindow } from 'electron';

interface PtySession {
  kind: 'pty';
  pty: {
    write: (data: string) => void;
    resize: (cols: number, rows: number) => void;
    kill: () => void;
    onData: (cb: (data: string) => void) => void;
    onExit: (cb: () => void) => void;
  };
}

interface PipeSession {
  kind: 'pipe';
  proc: ChildProcessWithoutNullStreams;
}

type Session = PtySession | PipeSession;

const terminals = new Map<string, Session>();

function loadNodePty(): typeof import('node-pty') | null {
  // ConPTY + Electron hot-reload on Windows causes AttachConsole crashes; use pipe mode by default.
  if (process.platform === 'win32' && process.env.DOWNAI_USE_PTY !== '1') {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('node-pty');
  } catch {
    return null;
  }
}

function shellCommand(): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    return { file: process.env.COMSPEC || 'cmd.exe', args: [] };
  }
  const shell = process.env.SHELL || '/bin/bash';
  return { file: shell, args: ['-l'] };
}

function attachOutput(win: BrowserWindow, id: string, proc: ChildProcessWithoutNullStreams) {
  const send = (chunk: Buffer | string) => {
    if (!win.isDestroyed()) {
      win.webContents.send('terminal:data', id, chunk.toString());
    }
  };

  proc.stdout.on('data', send);
  proc.stderr.on('data', send);

  proc.on('exit', () => {
    terminals.delete(id);
    if (!win.isDestroyed()) win.webContents.send('terminal:exit', id);
  });

  proc.on('error', (err) => {
    send(`\r\n\x1b[31mTerminal error: ${err.message}\x1b[0m\r\n`);
  });
}

export function createTerminal(
  win: BrowserWindow,
  cwd?: string | null
): string {
  const id = randomUUID();
  const { file, args } = shellCommand();
  const workdir = cwd || os.homedir();
  const nodePty = loadNodePty();

  if (nodePty) {
    try {
      const ptyProcess = nodePty.spawn(file, args, {
        name: 'xterm-256color',
        cwd: workdir,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        } as Record<string, string>,
        cols: 80,
        rows: 24,
        useConpty: false,
      });

      ptyProcess.onData((data) => {
        if (!win.isDestroyed()) win.webContents.send('terminal:data', id, data);
      });

      ptyProcess.onExit(() => {
        terminals.delete(id);
        if (!win.isDestroyed()) win.webContents.send('terminal:exit', id);
      });

      terminals.set(id, {
        kind: 'pty',
        pty: {
          write: (data) => ptyProcess.write(data),
          resize: (cols, rows) => {
            if (cols > 0 && rows > 0) ptyProcess.resize(cols, rows);
          },
          kill: () => ptyProcess.kill(),
          onData: (cb) => ptyProcess.onData(cb),
          onExit: (cb) => ptyProcess.onExit(cb),
        },
      });
      return id;
    } catch {
      /* fall through to pipe mode */
    }
  }

  const proc = spawn(file, args, {
    cwd: workdir,
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });

  attachOutput(win, id, proc);
  terminals.set(id, { kind: 'pipe', proc });
  return id;
}

export function writeTerminal(id: string, data: string) {
  const session = terminals.get(id);
  if (!session) return;

  if (session.kind === 'pty') {
    session.pty.write(data);
    return;
  }

  if (session.proc.stdin.writable) {
    const normalized =
      process.platform === 'win32' ? data.replace(/\n/g, '\r\n') : data;
    session.proc.stdin.write(normalized);
  }
}

export function resizeTerminal(id: string, cols: number, rows: number) {
  const session = terminals.get(id);
  if (session?.kind === 'pty' && cols > 0 && rows > 0) {
    session.pty.resize(cols, rows);
  }
}

export function killTerminal(id: string) {
  const session = terminals.get(id);
  if (!session) return;

  if (session.kind === 'pty') {
    session.pty.kill();
  } else {
    session.proc.kill();
  }
  terminals.delete(id);
}

export function killAllTerminals() {
  for (const id of [...terminals.keys()]) {
    killTerminal(id);
  }
}
