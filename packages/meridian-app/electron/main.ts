import { app, BrowserWindow, ipcMain, dialog, Menu, shell, clipboard } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { existsSync, watch } from 'fs';
import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import {
  activateLicense,
  canUseAi,
  deactivateLicense,
  getLicenseStatus,
  incrementAiUsage,
} from './license';
import { getDeviceId } from './deviceId';
import {
  createTerminal,
  writeTerminal,
  resizeTerminal,
  killTerminal,
  killAllTerminals,
} from './terminal';
import {
  initNotifications,
  showDesktopNotification,
  shouldNotifyInBackground,
} from './notifications';
import { loadSession, saveSession } from './session';
import { getAppIconPath } from './iconPath';
import { loadChats, saveChats } from './chat';
import { buildChatSystemMessage } from './chatPrompt';
import { loadBookmarks, saveBookmarks } from './bookmarks';
import { decryptSecret, encryptSecret, isEncryptedSecret } from './secureStorage';
import { getSessionToken } from './license';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

let mainWindow: BrowserWindow | null = null;
let currentProjectPath: string | null = null;
let projectWatcher: ReturnType<typeof watch> | null = null;

function stopProjectWatch() {
  projectWatcher?.close();
  projectWatcher = null;
}

function startProjectWatch(projectPath: string) {
  stopProjectWatch();
  try {
    projectWatcher = watch(projectPath, { recursive: true }, (_, filename) => {
      if (!filename) return;
      const root = filename.split(/[/\\]/)[0];
      if (SKIP_DIR_NAMES.has(root)) return;
      mainWindow?.webContents.send('project:changed');
    });
  } catch {
    /* recursive watch may be unavailable */
  }
}

const isDev = !app.isPackaged;

const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'dist-electron',
  'release',
  'build',
  '.next',
  'coverage',
  '__pycache__',
  '.turbo',
  '.cache',
]);

const MAX_TREE_DEPTH = 12;
const MAX_TREE_NODES = 8000;

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#181818',
    icon: getAppIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isDev && url.startsWith('http://localhost:')) return;
    if (url.startsWith('file://')) return;
    event.preventDefault();
  });

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    if (!devUrl) {
      console.error('VITE_DEV_SERVER_URL is missing — run via `npm run dev`, not vite preview.');
      app.quit();
      return;
    }
    mainWindow.loadURL(devUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Folder',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:open-folder'),
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save'),
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu:save-as'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function readDirRecursive(
  dirPath: string,
  basePath: string = dirPath,
  depth = 0,
  counter = { count: 0 }
): Promise<FileNode[]> {
  if (depth > MAX_TREE_DEPTH || counter.count >= MAX_TREE_NODES) return [];

  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const nodes: FileNode[] = [];

  const sorted = entries
    .filter(e => !e.name.startsWith('.') && !SKIP_DIR_NAMES.has(e.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  for (const entry of sorted) {
    if (counter.count >= MAX_TREE_NODES) break;

    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      counter.count += 1;
      const children = await readDirRecursive(fullPath, basePath, depth + 1, counter);
      nodes.push({ name: entry.name, path: relativePath, type: 'folder', children });
    } else {
      counter.count += 1;
      nodes.push({ name: entry.name, path: relativePath, type: 'file' });
    }
  }

  return nodes;
}

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: FileNode[];
}

interface GitFileEntry {
  path: string;
  index: string;
  work: string;
  staged: boolean;
  display: string;
}

interface Settings {
  aiMode: 'hosted' | 'custom';
  hostedApiUrl: string;
  apiKeyEnc?: string;
  apiBaseUrl: string;
  model: string;
  theme: 'dark' | 'light';
  fontSize: number;
  minimap: boolean;
  notifyOnAiComplete: boolean;
  autoSave: boolean;
}

interface PublicSettings extends Omit<Settings, 'apiKeyEnc'> {
  hasApiKey: boolean;
}

interface SaveSettingsInput extends Omit<Settings, 'apiKeyEnc'> {
  apiKey?: string;
}

const ALLOWED_EXTERNAL = [
  /^https:\/\/(www\.)?downai\.dev(\/|$)/i,
  /^https:\/\/(checkout\.)?stripe\.com(\/|$)/i,
  /^https:\/\/(www\.)?github\.com(\/|$)/i,
  /^https:\/\/(www\.)?gumroad\.com(\/|$)/i,
  /^https:\/\/(www\.)?lemonsqueezy\.com(\/|$)/i,
];

function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    return ALLOWED_EXTERNAL.some((re) => re.test(url));
  } catch {
    return false;
  }
}

type AiChatMessage = { role: string; content: string; images?: string[] };

function toApiMessageContent(msg: AiChatMessage) {
  if (!msg.images?.length) return msg.content;
  const parts: Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }> = [];
  if (msg.content.trim()) parts.push({ type: 'text', text: msg.content });
  for (const url of msg.images) {
    parts.push({ type: 'image_url', image_url: { url } });
  }
  return parts;
}

function formatAiMessages(messages: AiChatMessage[]) {
  return messages.map((m) => ({ role: m.role, content: toApiMessageContent(m) }));
}

function isValidGitCloneUrl(url: string): boolean {
  const trimmed = url.trim();
  return (
    /^https:\/\/[\w.-@:/]+(\.git)?(\/)?$/i.test(trimmed) ||
    /^git@[\w.-]+:[\w./-]+(\.git)?$/i.test(trimmed)
  );
}

function getApiKey(settings: Settings): string {
  if (!settings.apiKeyEnc) return '';
  if (isEncryptedSecret(settings.apiKeyEnc)) return decryptSecret(settings.apiKeyEnc);
  return settings.apiKeyEnc;
}

function toPublicSettings(settings: Settings): PublicSettings {
  const { apiKeyEnc, ...rest } = settings;
  return { ...rest, hasApiKey: !!getApiKey(settings) };
}

const DEFAULT_HOSTED_URL = isDev
  ? 'http://localhost:8787/v1/chat'
  : 'https://api.downai.dev/v1/chat';

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');
const RECENTS_PATH = path.join(app.getPath('userData'), 'recents.json');

interface RecentProject {
  name: string;
  path: string;
  openedAt: number;
}

async function loadRecents(): Promise<RecentProject[]> {
  try {
    if (existsSync(RECENTS_PATH)) {
      const data = await fs.readFile(RECENTS_PATH, 'utf-8');
      return JSON.parse(data) as RecentProject[];
    }
  } catch {
    /* empty */
  }
  return [];
}

async function saveRecents(recents: RecentProject[]) {
  await fs.writeFile(RECENTS_PATH, JSON.stringify(recents, null, 2));
}

async function addRecent(folderPath: string) {
  const name = path.basename(folderPath);
  const recents = await loadRecents();
  const filtered = recents.filter(r => r.path !== folderPath);
  filtered.unshift({ name, path: folderPath, openedAt: Date.now() });
  await saveRecents(filtered.slice(0, 20));
}

async function openProjectAt(folderPath: string) {
  if (!existsSync(folderPath)) return null;
  currentProjectPath = folderPath;
  await addRecent(folderPath);
  startProjectWatch(folderPath);
  const tree = await readDirRecursive(currentProjectPath);
  return { path: currentProjectPath, tree };
}

async function loadSettings(): Promise<Settings> {
  const defaults: Settings = {
    aiMode: 'hosted',
    hostedApiUrl: DEFAULT_HOSTED_URL,
    apiKeyEnc: '',
    apiBaseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    theme: 'dark',
    fontSize: 14,
    minimap: true,
    notifyOnAiComplete: true,
    autoSave: true,
  };
  try {
    if (existsSync(SETTINGS_PATH)) {
      const data = await fs.readFile(SETTINGS_PATH, 'utf-8');
      const parsed = JSON.parse(data) as Settings & { apiKey?: string };
      const merged = { ...defaults, ...parsed };
      if (parsed.apiKey && !parsed.apiKeyEnc) {
        merged.apiKeyEnc = encryptSecret(parsed.apiKey);
        delete (merged as { apiKey?: string }).apiKey;
        await fs.writeFile(SETTINGS_PATH, JSON.stringify(merged, null, 2));
      }
      return merged;
    }
  } catch {
    /* use defaults */
  }
  return defaults;
}

async function saveSettings(settings: Settings) {
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

async function saveSettingsFromInput(input: SaveSettingsInput): Promise<Settings> {
  const current = await loadSettings();
  const next: Settings = {
    aiMode: input.aiMode,
    hostedApiUrl: input.hostedApiUrl,
    apiBaseUrl: input.apiBaseUrl,
    model: input.model,
    theme: input.theme,
    fontSize: input.fontSize,
    minimap: input.minimap,
    notifyOnAiComplete: input.notifyOnAiComplete,
    autoSave: input.autoSave,
    apiKeyEnc: current.apiKeyEnc || '',
  };
  if (input.apiKey?.trim()) {
    next.apiKeyEnc = encryptSecret(input.apiKey.trim());
  }
  await saveSettings(next);
  return next;
}

function setupIPC() {
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false);

  ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return openProjectAt(result.filePaths[0]);
  });

  ipcMain.handle('dialog:saveFileAs', async (_, relativePath: string, content: string) => {
    if (!currentProjectPath) throw new Error('No project open');

    const safeRelative = relativePath.replace(/\\/g, '/');
    const defaultFull = path.join(currentProjectPath, safeRelative);
    const defaultDir = path.dirname(defaultFull);
    const defaultName = path.basename(defaultFull);

    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Save As',
      defaultPath: path.join(defaultDir, defaultName),
      filters: [{ name: 'All Files', extensions: ['*'] }],
    });

    if (result.canceled || !result.filePath) return null;

    const resolved = path.resolve(result.filePath);
    const projectRoot = path.resolve(currentProjectPath);
    const rel = path.relative(projectRoot, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new Error('Save location must be inside the open project folder.');
    }

    const normalized = rel.replace(/\\/g, '/');
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, 'utf-8');
    return normalized;
  });

  ipcMain.handle('recents:list', loadRecents);

  ipcMain.handle('recents:open', async (_, projectPath: string) => {
    return openProjectAt(projectPath);
  });

  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    if (!currentProjectPath) throw new Error('No project open');
    const fullPath = path.join(currentProjectPath, filePath);
    return fs.readFile(fullPath, 'utf-8');
  });

  ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
    if (!currentProjectPath) throw new Error('No project open');
    const fullPath = path.join(currentProjectPath, filePath);
    await fs.writeFile(fullPath, content, 'utf-8');
    return true;
  });

  ipcMain.handle('fs:createFile', async (_, filePath: string) => {
    if (!currentProjectPath) throw new Error('No project open');
    const fullPath = path.join(currentProjectPath, filePath);
    await fs.writeFile(fullPath, '', 'utf-8');
    return true;
  });

  ipcMain.handle('fs:createFolder', async (_, folderPath: string) => {
    if (!currentProjectPath) throw new Error('No project open');
    const fullPath = path.join(currentProjectPath, folderPath);
    await fs.mkdir(fullPath, { recursive: true });
    return true;
  });

  ipcMain.handle('fs:delete', async (_, targetPath: string) => {
    if (!currentProjectPath) throw new Error('No project open');
    const fullPath = path.join(currentProjectPath, targetPath);
    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) {
      await fs.rm(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
    }
    return true;
  });

  ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
    if (!currentProjectPath) throw new Error('No project open');
    const oldFull = path.join(currentProjectPath, oldPath);
    const newFull = path.join(currentProjectPath, newPath);
    await fs.rename(oldFull, newFull);
    return true;
  });

  ipcMain.handle('fs:refreshTree', async () => {
    if (!currentProjectPath) return null;
    const tree = await readDirRecursive(currentProjectPath);
    return { path: currentProjectPath, tree };
  });

  ipcMain.handle('fs:getProjectPath', () => currentProjectPath);

  ipcMain.handle('settings:load', async () => toPublicSettings(await loadSettings()));
  ipcMain.handle('settings:save', async (_, input: SaveSettingsInput) => {
    await saveSettingsFromInput(input);
    return true;
  });

  ipcMain.handle('license:status', () => getLicenseStatus());
  ipcMain.handle('license:activate', async (_, key: string) => {
    const settings = await loadSettings();
    return activateLicense(key, settings.hostedApiUrl);
  });
  ipcMain.handle('license:deactivate', () => deactivateLicense());

  ipcMain.handle('fs:search', async (_, query: string, options?: { caseSensitive?: boolean; regex?: boolean }) => {
    if (!currentProjectPath || !query.trim()) return [];
    const results: { path: string; line: number; preview: string }[] = [];
    const maxResults = 100;
    const caseSensitive = options?.caseSensitive ?? false;
    const useRegex = options?.regex ?? false;
    let matcher: (line: string) => boolean;
    if (useRegex) {
      try {
        const re = new RegExp(query, caseSensitive ? '' : 'i');
        matcher = (line) => re.test(line);
      } catch {
        return [];
      }
    } else {
      const q = caseSensitive ? query : query.toLowerCase();
      matcher = (line) => (caseSensitive ? line : line.toLowerCase()).includes(q);
    }

    async function searchDir(dir: string) {
      if (results.length >= maxResults) return;
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (results.length >= maxResults) return;
        if (entry.name.startsWith('.') || SKIP_DIR_NAMES.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await searchDir(full);
        } else {
          try {
            const content = await fs.readFile(full, 'utf-8');
            const lines = content.split('\n');
            const rel = path.relative(currentProjectPath!, full).replace(/\\/g, '/');
            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) return;
              if (matcher(lines[i])) {
                results.push({ path: rel, line: i + 1, preview: lines[i].trim().slice(0, 120) });
              }
            }
          } catch {
            /* skip binary */
          }
        }
      }
    }

    await searchDir(currentProjectPath);
    return results;
  });

  ipcMain.handle(
    'fs:replaceInFiles',
    async (
      _,
      query: string,
      replacement: string,
      options?: { caseSensitive?: boolean; regex?: boolean }
    ) => {
      if (!currentProjectPath || !query.trim()) return { files: 0, replacements: 0 };
      const caseSensitive = options?.caseSensitive ?? false;
      const useRegex = options?.regex ?? false;
      let filesChanged = 0;
      let totalReplacements = 0;

      async function replaceInDir(dir: string) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || SKIP_DIR_NAMES.has(entry.name)) continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await replaceInDir(full);
          } else {
            try {
              const content = await fs.readFile(full, 'utf-8');
              let next = content;
              let count = 0;
              if (useRegex) {
                const re = new RegExp(query, caseSensitive ? 'g' : 'gi');
                const matches = content.match(re);
                if (matches?.length) {
                  count = matches.length;
                  next = content.replace(re, replacement);
                }
              } else if (caseSensitive) {
                let idx = content.indexOf(query);
                while (idx !== -1) {
                  count++;
                  idx = content.indexOf(query, idx + query.length);
                }
                if (count) next = content.split(query).join(replacement);
              } else {
                const re = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                const matches = content.match(re);
                if (matches?.length) {
                  count = matches.length;
                  next = content.replace(re, replacement);
                }
              }
              if (count > 0) {
                await fs.writeFile(full, next, 'utf-8');
                filesChanged++;
                totalReplacements += count;
              }
            } catch {
              /* skip */
            }
          }
        }
      }

      await replaceInDir(currentProjectPath);
      return { files: filesChanged, replacements: totalReplacements };
    }
  );

  ipcMain.handle(
    'ai:chat',
    async (
      _,
      messages: AiChatMessage[],
      options?: { context?: string; mode?: string; projectPath?: string | null }
    ) => {
    const settings = await loadSettings();
    const apiMessages = formatAiMessages(messages);
    const chatOptions = options || {};

    if (settings.aiMode === 'hosted') {
      const sessionToken = await getSessionToken();
      const deviceId = await getDeviceId();
      const url = settings.hostedApiUrl || DEFAULT_HOSTED_URL;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-DownAI-Device': deviceId,
      };
      if (sessionToken) {
        headers.Authorization = `Bearer ${sessionToken}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: apiMessages,
          context: chatOptions.context || '',
          mode: chatOptions.mode || 'ask',
          projectPath: chatOptions.projectPath || '',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `DownAI unavailable (${response.status})`);
      }

      await incrementAiUsage();
      return data.content as string;
    }

    const aiCheck = await canUseAi();
    if (!aiCheck.allowed) {
      throw new Error(aiCheck.reason || 'AI usage not allowed.');
    }

    const apiKey = getApiKey(settings);
    if (!apiKey) {
      throw new Error('API key not configured. Open Settings → use DownAI or add your own key.');
    }

    const systemMessage = buildChatSystemMessage({
      mode: chatOptions.mode,
      context: chatOptions.context,
      projectPath: chatOptions.projectPath,
    });

    const response = await fetch(`${settings.apiBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'system', content: systemMessage }, ...apiMessages],
        temperature: 0.35,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`AI request failed: ${response.status} ${err}`);
    }

    const data = await response.json();
    await incrementAiUsage();
    return data.choices[0].message.content;
  },
  );

  ipcMain.handle('ai:prompts', async (_, body: { goal: string; mode?: string; output?: string }) => {
    const settings = await loadSettings();
    const sessionToken = await getSessionToken();
    const deviceId = await getDeviceId();
    const baseUrl = (settings.hostedApiUrl || DEFAULT_HOSTED_URL).replace(/\/v1\/chat\/?$/, '');
    const url = `${baseUrl}/v1/prompts`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-DownAI-Device': deviceId,
    };
    if (sessionToken) {
      headers.Authorization = `Bearer ${sessionToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Prompt Lab unavailable (${response.status})`);
    }
    return data;
  });

  ipcMain.handle('chat:load', () => loadChats());
  ipcMain.handle('chat:save', (_, state) => {
    saveChats(state);
    return true;
  });

  ipcMain.handle('bookmarks:load', () => loadBookmarks());
  ipcMain.handle('bookmarks:save', (_, data: Record<string, string[]>) => {
    saveBookmarks(data);
    return true;
  });

  ipcMain.handle('clipboard:write', (_, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    if (!isAllowedExternalUrl(url)) {
      throw new Error('Opening this URL is not allowed.');
    }
    await shell.openExternal(url);
  });

  ipcMain.handle('terminal:create', async (_, cwd?: string) => {
    if (!mainWindow) throw new Error('No window');
    return createTerminal(mainWindow, cwd || currentProjectPath);
  });

  ipcMain.handle('terminal:write', (_, id: string, data: string) => {
    writeTerminal(id, data);
  });

  ipcMain.handle('terminal:resize', (_, id: string, cols: number, rows: number) => {
    resizeTerminal(id, cols, rows);
  });

  ipcMain.handle('terminal:kill', (_, id: string) => {
    killTerminal(id);
  });

  ipcMain.handle('git:status', async () => {
    if (!currentProjectPath) return { isRepo: false, branch: null, changed: 0, files: [] as GitFileEntry[] };
    try {
      const { stdout: branchOut } = await execAsync('git branch --show-current', { cwd: currentProjectPath });
      const { stdout: statusOut } = await execAsync('git status --porcelain', { cwd: currentProjectPath });
      const files: GitFileEntry[] = statusOut.split('\n').filter(Boolean).map(line => {
        const index = line[0] ?? ' ';
        const work = line[1] ?? ' ';
        let filePath = line.slice(3).trim();
        if (filePath.includes(' -> ')) filePath = filePath.split(' -> ').pop()!.trim();
        return {
          path: filePath,
          index,
          work,
          staged: index !== ' ' && index !== '?',
          display: line.trim(),
        };
      });
      return {
        isRepo: true,
        branch: branchOut.trim() || 'HEAD',
        changed: files.length,
        files,
      };
    } catch {
      return { isRepo: false, branch: null, changed: 0, files: [] as GitFileEntry[] };
    }
  });

  ipcMain.handle('git:stage', async (_, filePath: string) => {
    if (!currentProjectPath) throw new Error('No project open');
    await execFileAsync('git', ['add', '--', filePath], { cwd: currentProjectPath });
    return true;
  });

  ipcMain.handle('git:unstage', async (_, filePath: string) => {
    if (!currentProjectPath) throw new Error('No project open');
    await execFileAsync('git', ['restore', '--staged', '--', filePath], { cwd: currentProjectPath });
    return true;
  });

  ipcMain.handle('git:discard', async (_, filePath: string) => {
    if (!currentProjectPath) throw new Error('No project open');
    await execFileAsync('git', ['restore', '--', filePath], { cwd: currentProjectPath });
    return true;
  });

  ipcMain.handle('git:init', async () => {
    if (!currentProjectPath) throw new Error('No project open');
    await execFileAsync('git', ['init'], { cwd: currentProjectPath });
    return true;
  });

  ipcMain.handle('git:diff', async (_, filePath: string, staged = false) => {
    if (!currentProjectPath) return '';
    const args = staged
      ? ['diff', '--cached', '--', filePath]
      : ['diff', '--', filePath];
    try {
      const { stdout } = await execFileAsync('git', args, { cwd: currentProjectPath, maxBuffer: 2 * 1024 * 1024 });
      return stdout;
    } catch (e) {
      const err = e as { stdout?: string };
      return err.stdout || '';
    }
  });

  ipcMain.handle('git:branches', async () => {
    if (!currentProjectPath) return [];
    try {
      const { stdout } = await execAsync('git branch --list', { cwd: currentProjectPath });
      const current = (await execAsync('git branch --show-current', { cwd: currentProjectPath })).stdout.trim();
      return stdout
        .split('\n')
        .map(l => l.trim().replace(/^\*\s*/, ''))
        .filter(Boolean)
        .map(name => ({ name, current: name === current }));
    } catch {
      return [];
    }
  });

  ipcMain.handle('git:checkout', async (_, branch: string) => {
    if (!currentProjectPath) throw new Error('No project open');
    await execFileAsync('git', ['checkout', branch], { cwd: currentProjectPath });
    return true;
  });

  ipcMain.handle('git:commit', async (_, message: string) => {
    if (!currentProjectPath) throw new Error('No project open');
    const msg = message.trim();
    if (!msg) throw new Error('Commit message required');
    await execFileAsync('git', ['commit', '-m', msg], { cwd: currentProjectPath });
    return true;
  });

  ipcMain.handle('git:clone', async (_, url: string) => {
    const trimmed = url.trim();
    if (!trimmed) throw new Error('URL is required');
    if (!isValidGitCloneUrl(trimmed)) throw new Error('Invalid git repository URL.');

    const parent = await dialog.showOpenDialog(mainWindow!, {
      title: 'Clone into folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (parent.canceled || !parent.filePaths[0]) return null;

    const folderName = trimmed.replace(/\/$/, '').split('/').pop()?.replace(/\.git$/, '') || 'repository';
    const dest = path.join(parent.filePaths[0], folderName);

    if (existsSync(dest)) throw new Error(`Folder already exists: ${dest}`);

    await execFileAsync('git', ['clone', trimmed, dest], {
      cwd: parent.filePaths[0],
      timeout: 120000,
    });

    return openProjectAt(dest);
  });

  ipcMain.handle(
    'notification:show',
    async (_, payload: { title: string; body: string; force?: boolean }) => {
      const settings = await loadSettings();
      if (!settings.notifyOnAiComplete && !payload.force) return false;
      if (!payload.force && !shouldNotifyInBackground(mainWindow)) return false;
      return showDesktopNotification(mainWindow, {
        title: payload.title,
        body: payload.body,
      });
    }
  );

  ipcMain.handle('session:load', () => loadSession());

  ipcMain.handle(
    'session:save',
    async (_, session: { projectPath: string | null; openFiles: string[]; activeFilePath: string | null }) => {
      saveSession({ ...session, savedAt: Date.now() });
      return true;
    }
  );
}

if (gotSingleInstanceLock) {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    initNotifications();
    buildMenu();
    setupIPC();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    killAllTerminals();
    if (process.platform !== 'darwin') app.quit();
  });
}
