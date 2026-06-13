/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare global {
  interface Window {
    downai: {
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
      };
      dialog: {
        openFolder: () => Promise<{ path: string; tree: import('./store/editorStore').FileNode[] } | null>;
        saveFileAs: (relativePath: string, content: string) => Promise<string | null>;
      };
      recents: {
        list: () => Promise<{ name: string; path: string; openedAt: number }[]>;
        open: (projectPath: string) => Promise<{ path: string; tree: import('./store/editorStore').FileNode[] } | null>;
      };
      fs: {
        readFile: (path: string) => Promise<string>;
        writeFile: (path: string, content: string) => Promise<boolean>;
        createFile: (path: string) => Promise<boolean>;
        createFolder: (path: string) => Promise<boolean>;
        delete: (path: string) => Promise<boolean>;
        refreshTree: () => Promise<{ path: string; tree: import('./store/editorStore').FileNode[] } | null>;
        getProjectPath: () => Promise<string | null>;
      };
      settings: {
        load: () => Promise<{
          aiMode: 'hosted' | 'custom';
          hostedApiUrl: string;
          hasApiKey?: boolean;
          apiBaseUrl: string;
          model: string;
          theme: string;
          fontSize?: number;
          minimap?: boolean;
          notifyOnAiComplete: boolean;
          autoSave: boolean;
        }>;
        save: (settings: {
          aiMode: 'hosted' | 'custom';
          hostedApiUrl: string;
          apiKey?: string;
          apiBaseUrl: string;
          model: string;
          theme: string;
          fontSize?: number;
          minimap?: boolean;
          notifyOnAiComplete: boolean;
          autoSave: boolean;
        }) => Promise<boolean>;
      };
      ai: {
        chat: (
          messages: { role: string; content: string; images?: string[] }[],
          options?: { context?: string; mode?: 'agent' | 'ask' | 'edit'; projectPath?: string | null }
        ) => Promise<string>;
      };
      license: {
        status: () => Promise<{
          plan: 'free' | 'pro';
          isPro: boolean;
          email?: string;
          expiresAt?: number;
          aiMessagesToday: number;
          aiDailyLimit: number;
        }>;
        activate: (key: string) => Promise<unknown>;
        deactivate: () => Promise<unknown>;
      };
      search: {
        files: (query: string) => Promise<{ path: string; line: number; preview: string }[]>;
      };
      shell: {
        openExternal: (url: string) => Promise<void>;
      };
      notification: {
        show: (payload: { title: string; body: string; force?: boolean }) => Promise<boolean>;
      };
      session: {
        load: () => Promise<{
          projectPath: string | null;
          openFiles: string[];
          activeFilePath: string | null;
          savedAt: number;
        } | null>;
        save: (session: {
          projectPath: string | null;
          openFiles: string[];
          activeFilePath: string | null;
        }) => Promise<boolean>;
      };
      terminal: {
        create: (cwd?: string) => Promise<string>;
        write: (id: string, data: string) => Promise<void>;
        resize: (id: string, cols: number, rows: number) => Promise<void>;
        kill: (id: string) => Promise<void>;
        onData: (callback: (id: string, data: string) => void) => () => void;
        onExit: (callback: (id: string) => void) => () => void;
      };
      git: {
        status: () => Promise<{
          isRepo: boolean;
          branch: string | null;
          changed: number;
          files: string[];
        }>;
        clone: (url: string) => Promise<{ path: string; tree: import('./store/editorStore').FileNode[] } | null>;
      };
      on: (channel: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

export {};
