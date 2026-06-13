import { contextBridge, ipcRenderer } from 'electron';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

export interface Settings {
  aiMode: 'hosted' | 'custom';
  hostedApiUrl: string;
  hasApiKey?: boolean;
  apiKey?: string;
  apiBaseUrl: string;
  model: string;
  theme: 'dark' | 'light';
  fontSize: number;
  minimap: boolean;
  notifyOnAiComplete: boolean;
  autoSave: boolean;
}

export interface GitFileEntry {
  path: string;
  index: string;
  work: string;
  staged: boolean;
  display: string;
}

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

const api = {
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,
  },
  dialog: {
    openFolder: () => ipcRenderer.invoke('dialog:openFolder') as Promise<{ path: string; tree: FileNode[] } | null>,
    saveFileAs: (relativePath: string, content: string) =>
      ipcRenderer.invoke('dialog:saveFileAs', relativePath, content) as Promise<string | null>,
  },
  recents: {
    list: () => ipcRenderer.invoke('recents:list') as Promise<{ name: string; path: string; openedAt: number }[]>,
    open: (projectPath: string) =>
      ipcRenderer.invoke('recents:open', projectPath) as Promise<{ path: string; tree: FileNode[] } | null>,
  },
  fs: {
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path) as Promise<string>,
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content) as Promise<boolean>,
    createFile: (path: string) => ipcRenderer.invoke('fs:createFile', path) as Promise<boolean>,
    createFolder: (path: string) => ipcRenderer.invoke('fs:createFolder', path) as Promise<boolean>,
    delete: (path: string) => ipcRenderer.invoke('fs:delete', path) as Promise<boolean>,
    rename: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('fs:rename', oldPath, newPath) as Promise<boolean>,
    refreshTree: () => ipcRenderer.invoke('fs:refreshTree') as Promise<{ path: string; tree: FileNode[] } | null>,
    getProjectPath: () => ipcRenderer.invoke('fs:getProjectPath') as Promise<string | null>,
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load') as Promise<Settings>,
    save: (settings: Settings) => ipcRenderer.invoke('settings:save', settings) as Promise<boolean>,
  },
  ai: {
    chat: (
      messages: { role: string; content: string; images?: string[] }[],
      options?: { context?: string; mode?: 'agent' | 'ask' | 'edit'; projectPath?: string | null }
    ) => ipcRenderer.invoke('ai:chat', messages, options) as Promise<string>,
    prompts: (body: { goal: string; mode?: string; output?: string }) =>
      ipcRenderer.invoke('ai:prompts', body) as Promise<{
        prompts: Record<string, string>;
        usage?: { generationsToday: number; dailyLimit: number };
      }>,
  },
  chat: {
    load: () => ipcRenderer.invoke('chat:load') as Promise<{
      threads: ChatThread[];
      activeThreadId: string;
      mode: 'agent' | 'ask' | 'edit';
    }>,
    save: (state: { threads: ChatThread[]; activeThreadId: string; mode: 'agent' | 'ask' | 'edit' }) =>
      ipcRenderer.invoke('chat:save', state) as Promise<boolean>,
  },
  bookmarks: {
    load: () => ipcRenderer.invoke('bookmarks:load') as Promise<Record<string, string[]>>,
    save: (data: Record<string, string[]>) =>
      ipcRenderer.invoke('bookmarks:save', data) as Promise<boolean>,
  },
  clipboard: {
    write: (text: string) => ipcRenderer.invoke('clipboard:write', text) as Promise<boolean>,
  },
  project: {
    onChanged: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('project:changed', handler);
      return () => ipcRenderer.removeListener('project:changed', handler);
    },
  },
  license: {
    status: () => ipcRenderer.invoke('license:status') as Promise<{
      plan: 'free' | 'pro';
      isPro: boolean;
      email?: string;
      expiresAt?: number;
      aiMessagesToday: number;
      aiDailyLimit: number;
    }>,
    activate: (key: string) => ipcRenderer.invoke('license:activate', key),
    deactivate: () => ipcRenderer.invoke('license:deactivate'),
  },
  search: {
    files: (query: string, options?: { caseSensitive?: boolean; regex?: boolean }) =>
      ipcRenderer.invoke('fs:search', query, options) as Promise<
        { path: string; line: number; preview: string }[]
      >,
    replaceInFiles: (
      query: string,
      replacement: string,
      options?: { caseSensitive?: boolean; regex?: boolean }
    ) =>
      ipcRenderer.invoke('fs:replaceInFiles', query, replacement, options) as Promise<{
        files: number;
        replacements: number;
      }>,
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
  notification: {
    show: (payload: { title: string; body: string; force?: boolean }) =>
      ipcRenderer.invoke('notification:show', payload) as Promise<boolean>,
  },
  session: {
    load: () => ipcRenderer.invoke('session:load') as Promise<{
      projectPath: string | null;
      openFiles: string[];
      activeFilePath: string | null;
      savedAt: number;
    } | null>,
    save: (session: {
      projectPath: string | null;
      openFiles: string[];
      activeFilePath: string | null;
    }) => ipcRenderer.invoke('session:save', session) as Promise<boolean>,
  },
  terminal: {
    create: (cwd?: string) => ipcRenderer.invoke('terminal:create', cwd) as Promise<string>,
    write: (id: string, data: string) => ipcRenderer.invoke('terminal:write', id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke('terminal:resize', id, cols, rows),
    kill: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    onData: (callback: (id: string, data: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string, data: string) =>
        callback(id, data);
      ipcRenderer.on('terminal:data', handler);
      return () => ipcRenderer.removeListener('terminal:data', handler);
    },
    onExit: (callback: (id: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, id: string) => callback(id);
      ipcRenderer.on('terminal:exit', handler);
      return () => ipcRenderer.removeListener('terminal:exit', handler);
    },
  },
  git: {
    status: () => ipcRenderer.invoke('git:status') as Promise<{
      isRepo: boolean;
      branch: string | null;
      changed: number;
      files: GitFileEntry[];
    }>,
    clone: (url: string) =>
      ipcRenderer.invoke('git:clone', url) as Promise<{ path: string; tree: FileNode[] } | null>,
    commit: (message: string) => ipcRenderer.invoke('git:commit', message) as Promise<boolean>,
    stage: (filePath: string) => ipcRenderer.invoke('git:stage', filePath) as Promise<boolean>,
    unstage: (filePath: string) => ipcRenderer.invoke('git:unstage', filePath) as Promise<boolean>,
    discard: (filePath: string) => ipcRenderer.invoke('git:discard', filePath) as Promise<boolean>,
    init: () => ipcRenderer.invoke('git:init') as Promise<boolean>,
    diff: (filePath: string, staged?: boolean) =>
      ipcRenderer.invoke('git:diff', filePath, staged) as Promise<string>,
    branches: () =>
      ipcRenderer.invoke('git:branches') as Promise<{ name: string; current: boolean }[]>,
    checkout: (branch: string) => ipcRenderer.invoke('git:checkout', branch) as Promise<boolean>,
  },
  on: (channel: string, callback: (...args: unknown[]) => void) => {
    const validChannels = ['menu:open-folder', 'menu:save', 'menu:save-as'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
    }
  },
};

contextBridge.exposeInMainWorld('downai', api);

declare global {
  interface Window {
    downai: typeof api;
  }
}
