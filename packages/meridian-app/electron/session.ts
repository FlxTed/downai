import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

export interface EditorSession {
  projectPath: string | null;
  openFiles: string[];
  activeFilePath: string | null;
  savedAt: number;
}

function sessionPath() {
  return join(app.getPath('userData'), 'session.json');
}

export function loadSession(): EditorSession | null {
  try {
    const p = sessionPath();
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf-8')) as EditorSession;
  } catch {
    return null;
  }
}

export function saveSession(session: EditorSession) {
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(sessionPath(), JSON.stringify(session, null, 2));
}
