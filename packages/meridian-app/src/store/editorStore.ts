import { create } from 'zustand';
import { useOutputStore } from './outputStore';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

export interface OpenFile {
  path: string;
  name: string;
  content: string;
  language: string;
  isDirty: boolean;
}

export type EditorCommand =
  | { type: 'find' }
  | { type: 'replace' }
  | { type: 'format' }
  | { type: 'gotoLine'; line: number }
  | { type: 'toggleWordWrap' }
  | { type: 'toggleMinimap' }
  | { type: 'duplicateLine' };

interface EditorState {
  projectPath: string | null;
  fileTree: FileNode[];
  openFiles: OpenFile[];
  activeFilePath: string | null;
  expandedFolders: Set<string>;
  cursorLine: number;
  cursorColumn: number;
  inlineEditSignal: number;
  revealRequest: { path: string; line: number } | null;
  editorCommand: EditorCommand | null;
  recentFilePaths: string[];
  closedTabPaths: string[];
  explorerHighlightPath: string | null;
  splitFilePath: string | null;

  openProject: (path: string, tree: FileNode[]) => void;
  restoreSession: () => Promise<boolean>;
  refreshTree: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  openFileAtLine: (path: string, line: number) => Promise<void>;
  clearReveal: () => void;
  closeFile: (path: string) => void;
  setActiveFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  applyRemoteFileContent: (path: string, content: string) => void;
  saveFile: (path: string) => Promise<void>;
  saveActiveFile: () => Promise<void>;
  saveActiveFileAs: () => Promise<void>;
  saveAllFiles: () => Promise<void>;
  toggleFolder: (path: string) => void;
  setCursorPosition: (line: number, column: number) => void;
  requestInlineEdit: () => void;
  runEditorCommand: (cmd: EditorCommand) => void;
  clearEditorCommand: () => void;
  createFile: (relativePath: string) => Promise<void>;
  createFolder: (relativePath: string) => Promise<void>;
  deletePath: (relativePath: string) => Promise<void>;
  renamePath: (oldPath: string, newPath: string) => Promise<void>;
  reopenClosedTab: () => Promise<void>;
  closeOtherFiles: (keepPath: string) => void;
  closeAllFiles: () => void;
  revealInExplorer: (path: string) => void;
  clearExplorerHighlight: () => void;
  toggleSplit: () => void;
  setSplitFile: (path: string | null) => void;
  closeSplit: () => void;
  getActiveFile: () => OpenFile | undefined;
  getContextForAI: () => string;
  getFileContent: (path: string) => Promise<string | null>;
}

const LANG_MAP: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp',
  cs: 'csharp', rb: 'ruby', php: 'php', swift: 'swift', kt: 'kotlin',
  html: 'html', css: 'css', scss: 'scss', json: 'json', md: 'markdown',
  yaml: 'yaml', yml: 'yaml', xml: 'xml', sql: 'sql', sh: 'shell', bash: 'shell',
  vue: 'html', svelte: 'html', toml: 'toml', dockerfile: 'dockerfile',
};

function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (filename.toLowerCase() === 'dockerfile') return 'dockerfile';
  return LANG_MAP[ext] || 'plaintext';
}

const log = (msg: string) => useOutputStore.getState().append(msg);

let autoSaveEnabled = true;
const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function setAutoSaveEnabled(enabled: boolean) {
  autoSaveEnabled = enabled;
}

function trackRecent(paths: string[], path: string): string[] {
  return [path, ...paths.filter(p => p !== path)].slice(0, 12);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projectPath: null,
  fileTree: [],
  openFiles: [],
  activeFilePath: null,
  expandedFolders: new Set<string>(),
  cursorLine: 1,
  cursorColumn: 1,
  inlineEditSignal: 0,
  revealRequest: null,
  editorCommand: null,
  recentFilePaths: [],
  closedTabPaths: [],
  explorerHighlightPath: null,
  splitFilePath: null,

  openProject: (path, tree) => {
    log(`Opened project: ${path}`);
    set({
      projectPath: path,
      fileTree: tree,
      openFiles: [],
      activeFilePath: null,
      expandedFolders: new Set<string>(),
      revealRequest: null,
      closedTabPaths: [],
      explorerHighlightPath: null,
      splitFilePath: null,
    });
  },

  restoreSession: async () => {
    const session = await window.downai.session.load();
    if (!session?.projectPath) return false;

    const result = await window.downai.recents.open(session.projectPath);
    if (!result) return false;

    const openFiles: OpenFile[] = [];
    for (const filePath of session.openFiles || []) {
      try {
        const content = await window.downai.fs.readFile(filePath);
        const name = filePath.split(/[/\\]/).pop() || filePath;
        openFiles.push({
          path: filePath,
          name,
          content,
          language: detectLanguage(name),
          isDirty: false,
        });
      } catch {
        /* removed */
      }
    }

    const active =
      session.activeFilePath && openFiles.some(f => f.path === session.activeFilePath)
        ? session.activeFilePath
        : openFiles[0]?.path ?? null;

    log(`Restored session: ${result.path}`);
    set({
      projectPath: result.path,
      fileTree: result.tree,
      openFiles,
      activeFilePath: active,
      expandedFolders: new Set<string>(),
      recentFilePaths: session.openFiles || [],
    });
    return true;
  },

  refreshTree: async () => {
    const result = await window.downai.fs.refreshTree();
    if (result) set({ fileTree: result.tree });
  },

  openFile: async (path) => {
    const { openFiles, recentFilePaths } = get();
    const existing = openFiles.find(f => f.path === path);
    if (existing) {
      set({
        activeFilePath: path,
        recentFilePaths: trackRecent(recentFilePaths, path),
      });
      return;
    }
    const content = await window.downai.fs.readFile(path);
    const name = path.split(/[/\\]/).pop() || path;
    const language = detectLanguage(name);
    set({
      openFiles: [...openFiles, { path, name, content, language, isDirty: false }],
      activeFilePath: path,
      recentFilePaths: trackRecent(recentFilePaths, path),
    });
  },

  openFileAtLine: async (path, line) => {
    await get().openFile(path);
    set({ revealRequest: { path, line } });
  },

  clearReveal: () => set({ revealRequest: null }),

  closeFile: (path) => {
    const { openFiles, activeFilePath, closedTabPaths } = get();
    const file = openFiles.find(f => f.path === path);
    if (file?.isDirty) {
      const discard = window.confirm(`${file.name} has unsaved changes. Discard them?`);
      if (!discard) return;
    }
    autoSaveTimers.delete(path);
    const filtered = openFiles.filter(f => f.path !== path);
    let newActive = activeFilePath;
    if (activeFilePath === path) {
      const idx = openFiles.findIndex(f => f.path === path);
      newActive = filtered[idx]?.path ?? filtered[idx - 1]?.path ?? null;
    }
    set({
      openFiles: filtered,
      activeFilePath: newActive,
      closedTabPaths: [path, ...closedTabPaths.filter(p => p !== path)].slice(0, 20),
    });
  },

  reopenClosedTab: async () => {
    const { closedTabPaths } = get();
    const next = closedTabPaths[0];
    if (!next) return;
    set({ closedTabPaths: closedTabPaths.slice(1) });
    try {
      await get().openFile(next);
    } catch {
      log(`Could not reopen ${next}`);
    }
  },

  closeOtherFiles: (keepPath) => {
    const { openFiles } = get();
    for (const f of openFiles) {
      if (f.path !== keepPath) get().closeFile(f.path);
    }
  },

  closeAllFiles: () => {
    const { openFiles } = get();
    for (const f of [...openFiles]) get().closeFile(f.path);
  },

  revealInExplorer: (path) => {
    const parts = path.split('/');
    const folders = parts.slice(0, -1);
    set(state => {
      const next = new Set(state.expandedFolders);
      let acc = '';
      for (const folder of folders) {
        acc = acc ? `${acc}/${folder}` : folder;
        next.add(acc);
      }
      return { expandedFolders: next, explorerHighlightPath: path };
    });
    setTimeout(() => get().clearExplorerHighlight(), 2000);
  },

  clearExplorerHighlight: () => set({ explorerHighlightPath: null }),

  toggleSplit: () => {
    const { activeFilePath, splitFilePath } = get();
    if (splitFilePath) set({ splitFilePath: null });
    else if (activeFilePath) set({ splitFilePath: activeFilePath });
  },

  setSplitFile: (path) => set({ splitFilePath: path }),

  closeSplit: () => set({ splitFilePath: null }),

  setActiveFile: (path) => set({ activeFilePath: path }),

  setCursorPosition: (line, column) => set({ cursorLine: line, cursorColumn: column }),

  requestInlineEdit: () => set(s => ({ inlineEditSignal: s.inlineEditSignal + 1 })),

  runEditorCommand: (cmd) => set({ editorCommand: cmd }),

  clearEditorCommand: () => set({ editorCommand: null }),

  updateFileContent: (path, content) => {
    set(state => ({
      openFiles: state.openFiles.map(f =>
        f.path === path ? { ...f, content, isDirty: true } : f
      ),
    }));

    if (!autoSaveEnabled) return;
    const prev = autoSaveTimers.get(path);
    if (prev) clearTimeout(prev);
    autoSaveTimers.set(
      path,
      setTimeout(() => {
        autoSaveTimers.delete(path);
        void get().saveFile(path);
      }, 2000)
    );
  },

  applyRemoteFileContent: (path, content) => {
    set(state => ({
      openFiles: state.openFiles.map(f =>
        f.path === path ? { ...f, content } : f
      ),
    }));
  },

  saveFile: async (path) => {
    const { openFiles } = get();
    const file = openFiles.find(f => f.path === path);
    if (!file?.isDirty) return;
    await window.downai.fs.writeFile(file.path, file.content);
    log(`Saved ${file.path}`);
    set({
      openFiles: openFiles.map(f =>
        f.path === path ? { ...f, isDirty: false } : f
      ),
    });
  },

  saveActiveFile: async () => {
    const { activeFilePath } = get();
    if (activeFilePath) await get().saveFile(activeFilePath);
  },

  saveActiveFileAs: async () => {
    const { activeFilePath, openFiles, projectPath } = get();
    if (!projectPath) {
      log('Open a project folder to save files.');
      return;
    }
    if (!activeFilePath) {
      log('No file open to save.');
      return;
    }

    const file = openFiles.find(f => f.path === activeFilePath);
    if (!file) return;

    try {
      const newPath = await window.downai.dialog.saveFileAs(activeFilePath, file.content);
      if (!newPath) return;

      autoSaveTimers.delete(activeFilePath);

      const name = newPath.split(/[/\\]/).pop() || newPath;
      const language = detectLanguage(name);

      if (newPath === activeFilePath) {
        set({
          openFiles: openFiles.map(f =>
            f.path === activeFilePath ? { ...f, isDirty: false } : f
          ),
        });
        log(`Saved ${newPath}`);
      } else {
        set({
          openFiles: openFiles.map(f =>
            f.path === activeFilePath
              ? { ...f, path: newPath, name, language, isDirty: false }
              : f
          ),
          activeFilePath: newPath,
          splitFilePath: get().splitFilePath === activeFilePath ? newPath : get().splitFilePath,
        });
        log(`Saved as ${newPath}`);
      }

      await get().refreshTree();
    } catch (err) {
      log(err instanceof Error ? err.message : 'Save As failed.');
    }
  },

  saveAllFiles: async () => {
    const { openFiles } = get();
    const dirty = openFiles.filter(f => f.isDirty);
    for (const file of dirty) {
      await window.downai.fs.writeFile(file.path, file.content);
    }
    if (dirty.length) log(`Saved ${dirty.length} file(s)`);
    set({
      openFiles: openFiles.map(f => ({ ...f, isDirty: false })),
    });
  },

  toggleFolder: (path) => {
    set(state => {
      const next = new Set(state.expandedFolders);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return { expandedFolders: next };
    });
  },

  createFile: async (relativePath) => {
    await window.downai.fs.createFile(relativePath);
    log(`Created file ${relativePath}`);
    await get().refreshTree();
    await get().openFile(relativePath);
  },

  createFolder: async (relativePath) => {
    await window.downai.fs.createFolder(relativePath);
    log(`Created folder ${relativePath}`);
    await get().refreshTree();
    set(state => ({
      expandedFolders: new Set([...state.expandedFolders, relativePath]),
    }));
  },

  deletePath: async (relativePath) => {
    if (!window.confirm(`Delete ${relativePath}?`)) return;
    const { openFiles } = get();
    const toClose = openFiles.filter(
      f => f.path === relativePath || f.path.startsWith(relativePath + '/')
    );
    for (const f of toClose) get().closeFile(f.path);
    await window.downai.fs.delete(relativePath);
    log(`Deleted ${relativePath}`);
    await get().refreshTree();
  },

  renamePath: async (oldPath, newPath) => {
    if (!newPath.trim() || oldPath === newPath) return;
    await window.downai.fs.rename(oldPath, newPath);
    log(`Renamed ${oldPath} → ${newPath}`);
    const { openFiles, activeFilePath } = get();
    const updated = openFiles.map(f => {
      if (f.path === oldPath) {
        const name = newPath.split(/[/\\]/).pop() || newPath;
        return { ...f, path: newPath, name, language: detectLanguage(name) };
      }
      if (f.path.startsWith(oldPath + '/')) {
        const path = newPath + f.path.slice(oldPath.length);
        const name = path.split(/[/\\]/).pop() || path;
        return { ...f, path, name, language: detectLanguage(name) };
      }
      return f;
    });
    set({
      openFiles: updated,
      activeFilePath: activeFilePath === oldPath ? newPath
        : activeFilePath?.startsWith(oldPath + '/') && activeFilePath
          ? newPath + activeFilePath.slice(oldPath.length)
          : activeFilePath,
    });
    await get().refreshTree();
    get().revealInExplorer(newPath);
  },

  getActiveFile: () => {
    const { openFiles, activeFilePath } = get();
    return openFiles.find(f => f.path === activeFilePath);
  },

  getContextForAI: () => {
    const { openFiles, activeFilePath } = get();
    const parts: string[] = [];
    for (const file of openFiles.slice(0, 5)) {
      const marker = file.path === activeFilePath ? ' (active)' : '';
      parts.push(`--- ${file.path}${marker} ---\n${file.content.slice(0, 3000)}`);
    }
    return parts.join('\n\n');
  },

  getFileContent: async (path) => {
    const open = get().openFiles.find(f => f.path === path);
    if (open) return open.content;
    try {
      return await window.downai.fs.readFile(path);
    } catch {
      return null;
    }
  },
}));
