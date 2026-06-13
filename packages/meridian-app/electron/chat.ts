import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
}

export interface ChatState {
  threads: ChatThread[];
  activeThreadId: string;
  mode: 'agent' | 'ask' | 'edit';
}

const DEFAULT_STATE: ChatState = {
  threads: [{ id: 'default', title: 'New Chat', messages: [] }],
  activeThreadId: 'default',
  mode: 'ask',
};

function chatPath() {
  return join(app.getPath('userData'), 'chats.json');
}

export function loadChats(): ChatState {
  try {
    const p = chatPath();
    if (!existsSync(p)) return { ...DEFAULT_STATE, threads: [...DEFAULT_STATE.threads.map(t => ({ ...t, messages: [] }))] };
    const data = JSON.parse(readFileSync(p, 'utf-8')) as ChatState;
    if (!data.threads?.length) return DEFAULT_STATE;
    return data;
  } catch {
    return DEFAULT_STATE;
  }
}

export function saveChats(state: ChatState) {
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(chatPath(), JSON.stringify(state, null, 2));
}
