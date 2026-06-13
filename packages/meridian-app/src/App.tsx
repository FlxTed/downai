import { useState, useCallback, useEffect, useMemo } from 'react';
import { MenuBar } from './components/MenuBar';
import { TitleBar } from './components/TitleBar';
import { TopBarActions } from './components/TopBarActions';
import { ActivityBar } from './components/ActivityBar';
import { Sidebar } from './components/Sidebar';
import { SearchPanel } from './components/SearchPanel';
import { GitPanel } from './components/GitPanel';
import { EditorArea } from './components/EditorArea';
import { AIPanel } from './components/AIPanel';
import { BottomPanel } from './components/BottomPanel';
import { StatusBar } from './components/StatusBar';
import { SettingsModal } from './components/SettingsModal';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CommandPalette } from './components/CommandPalette';
import { QuickOpen } from './components/QuickOpen';
import { UpgradeModal } from './components/UpgradeModal';
import { LicenseModal } from './components/LicenseModal';
import { CloneRepoModal } from './components/CloneRepoModal';
import { GoToLineModal } from './components/GoToLineModal';
import { RecentProjectsModal } from './components/RecentProjectsModal';
import { PromptLabPanel } from './components/PromptLabPanel';
import { CollaborationPanel } from './components/CollaborationPanel';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { useEditorStore, setAutoSaveEnabled } from './store/editorStore';
import { useLicenseStore } from './store/licenseStore';
import { useCollaborationStore } from './store/collaborationStore';
import type { SidebarView } from './components/ActivityBar';
import styles from './App.module.css';

export default function App() {
  const [activeView, setActiveView] = useState<SidebarView>('explorer');
  const [showAI, setShowAI] = useState(true);
  const [showTerminal, setShowTerminal] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const [showQuickOpen, setShowQuickOpen] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showLicense, setShowLicense] = useState(false);
  const [showGoToLine, setShowGoToLine] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [upgradeReason, setUpgradeReason] = useState<string>();
  const [newTerminalSignal, setNewTerminalSignal] = useState(0);
  const {
    projectPath, openProject, saveActiveFile, saveActiveFileAs, saveAllFiles, activeFilePath,
    closeFile, requestInlineEdit, restoreSession, runEditorCommand,
    openFiles, reopenClosedTab, revealInExplorer, closeAllFiles, closeOtherFiles,
    refreshTree, toggleSplit, projectPath: storeProjectPath,
  } = useEditorStore();
  const { refresh: refreshLicense } = useLicenseStore();

  const handleOpenFolder = useCallback(async () => {
    const result = await window.downai.dialog.openFolder();
    if (result) openProject(result.path, result.tree);
  }, [openProject]);

  const handleClone = useCallback(async (url: string) => {
    const result = await window.downai.git.clone(url);
    if (!result) throw new Error('Clone cancelled');
    openProject(result.path, result.tree);
  }, [openProject]);

  const openUpgrade = useCallback((reason?: string) => {
    setUpgradeReason(reason);
    setShowUpgrade(true);
  }, []);

  const handleMenuAction = useCallback((action: string) => {
    switch (action) {
      case 'open-folder': handleOpenFolder(); break;
      case 'save': saveActiveFile(); break;
      case 'save-as': void saveActiveFileAs(); break;
      case 'save-all': saveAllFiles(); break;
      case 'close-editor': if (activeFilePath) closeFile(activeFilePath); break;
      case 'find': runEditorCommand({ type: 'find' }); break;
      case 'replace': runEditorCommand({ type: 'replace' }); break;
      case 'format': runEditorCommand({ type: 'format' }); break;
      case 'duplicate-line': runEditorCommand({ type: 'duplicateLine' }); break;
      case 'toggle-minimap': runEditorCommand({ type: 'toggleMinimap' }); break;
      case 'split-editor': toggleSplit(); break;
      case 'zen-mode': setZenMode(v => !v); break;
      case 'shortcuts': setShowShortcuts(true); break;
      case 'copy-path':
        if (activeFilePath) void window.downai.clipboard.write(activeFilePath);
        break;
      case 'copy-abs-path':
        if (storeProjectPath && activeFilePath) {
          void window.downai.clipboard.write(`${storeProjectPath.replace(/\\/g, '/')}/${activeFilePath}`);
        }
        break;
      case 'goto-line': setShowGoToLine(true); break;
      case 'word-wrap': runEditorCommand({ type: 'toggleWordWrap' }); break;
      case 'toggle-sidebar': setSidebarVisible(v => !v); break;
      case 'palette': setShowPalette(true); break;
      case 'quick-open': setShowQuickOpen(true); break;
      case 'inline-edit': requestInlineEdit(); break;
      case 'search': setActiveView('search'); break;
      case 'explorer': setActiveView('explorer'); break;
      case 'git': setActiveView('git'); break;
      case 'promptlab': setActiveView('promptlab'); break;
      case 'collaboration':
        setActiveView('collaboration');
        setSidebarVisible(true);
        break;
      case 'reveal-explorer':
        if (activeFilePath) {
          setActiveView('explorer');
          setSidebarVisible(true);
          revealInExplorer(activeFilePath);
        }
        break;
      case 'reopen-tab': void reopenClosedTab(); break;
      case 'toggle-chat': setShowAI(v => !v); break;
      case 'toggle-terminal': setShowTerminal(v => !v); break;
      case 'new-terminal':
        setShowTerminal(true);
        setNewTerminalSignal(n => n + 1);
        break;
      case 'settings': setShowSettings(true); break;
      case 'upgrade': openUpgrade(); break;
    }
  }, [handleOpenFolder, saveActiveFile, saveActiveFileAs, saveAllFiles, activeFilePath, closeFile, requestInlineEdit, openUpgrade, runEditorCommand, revealInExplorer, reopenClosedTab, toggleSplit, storeProjectPath]);

  const openRecentProject = useCallback(() => {
    setShowRecent(true);
  }, []);

  const handleOpenRecent = useCallback(async (projectPath: string) => {
    const result = await window.downai.recents.open(projectPath);
    if (result) openProject(result.path, result.tree);
  }, [openProject]);

  useEffect(() => {
    refreshLicense();
    window.downai.settings.load().then(s => setAutoSaveEnabled(s.autoSave !== false));
    window.downai.on('menu:open-folder', handleOpenFolder);
    window.downai.on('menu:save', saveActiveFile);
    window.downai.on('menu:save-as', () => { void saveActiveFileAs(); });
    restoreSession();
  }, [handleOpenFolder, saveActiveFile, saveActiveFileAs, refreshLicense, restoreSession]);

  useEffect(() => {
    if (!projectPath) return;
    return window.downai.project.onChanged(() => { void refreshTree(); });
  }, [projectPath, refreshTree]);

  useEffect(() => {
    if (!projectPath) return;
    const t = setTimeout(() => {
      window.downai.session.save({
        projectPath,
        openFiles: openFiles.map(f => f.path),
        activeFilePath,
      });
    }, 500);
    return () => clearTimeout(t);
  }, [projectPath, openFiles, activeFilePath]);

  const commands = useMemo(() => [
    { id: 'open', label: 'Open Folder', shortcut: 'Ctrl+O', action: handleOpenFolder },
    { id: 'recent', label: 'Open Recent Project', action: openRecentProject },
    { id: 'quick', label: 'Go to File', shortcut: 'Ctrl+P', action: () => setShowQuickOpen(true) },
    { id: 'save', label: 'Save File', shortcut: 'Ctrl+S', action: saveActiveFile },
    { id: 'saveas', label: 'Save As…', shortcut: 'Ctrl+Shift+S', action: () => void saveActiveFileAs() },
    { id: 'saveall', label: 'Save All', shortcut: 'Ctrl+Alt+S', action: saveAllFiles },
    { id: 'find', label: 'Find in File', shortcut: 'Ctrl+F', action: () => runEditorCommand({ type: 'find' }) },
    { id: 'replace', label: 'Replace in File', shortcut: 'Ctrl+H', action: () => runEditorCommand({ type: 'replace' }) },
    { id: 'duplicate', label: 'Duplicate Line', shortcut: 'Ctrl+Shift+D', action: () => runEditorCommand({ type: 'duplicateLine' }) },
    { id: 'split', label: 'Split Editor', shortcut: 'Ctrl+\\', action: () => toggleSplit() },
    { id: 'minimap', label: 'Toggle Minimap', shortcut: 'Ctrl+Shift+M', action: () => runEditorCommand({ type: 'toggleMinimap' }) },
    { id: 'zen', label: 'Toggle Zen Mode', shortcut: 'Ctrl+K Z', action: () => setZenMode(v => !v) },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', shortcut: 'Ctrl+Shift+/', action: () => setShowShortcuts(true) },
    { id: 'copy-path', label: 'Copy Relative Path', action: () => activeFilePath && window.downai.clipboard.write(activeFilePath) },
    { id: 'goto', label: 'Go to Line', shortcut: 'Ctrl+G', action: () => setShowGoToLine(true) },
    { id: 'format', label: 'Format Document', shortcut: 'Shift+Alt+F', action: () => runEditorCommand({ type: 'format' }) },
    { id: 'wrap', label: 'Toggle Word Wrap', action: () => runEditorCommand({ type: 'toggleWordWrap' }) },
    { id: 'sidebar', label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: () => setSidebarVisible(v => !v) },
    { id: 'close', label: 'Close Tab', shortcut: 'Ctrl+W', action: () => activeFilePath && closeFile(activeFilePath) },
    { id: 'reopen', label: 'Reopen Closed Tab', shortcut: 'Ctrl+Shift+T', action: () => void reopenClosedTab() },
    { id: 'close-others', label: 'Close Other Tabs', action: () => activeFilePath && closeOtherFiles(activeFilePath) },
    { id: 'close-all', label: 'Close All Tabs', action: closeAllFiles },
    { id: 'reveal', label: 'Reveal in Explorer', shortcut: 'Ctrl+Shift+E', action: () => {
      if (!activeFilePath) return;
      setActiveView('explorer');
      setSidebarVisible(true);
      revealInExplorer(activeFilePath);
    }},
    { id: 'palette', label: 'Command Palette', shortcut: 'Ctrl+Shift+P', action: () => setShowPalette(true) },
    { id: 'inline', label: 'Inline Edit', shortcut: 'Ctrl+K', action: requestInlineEdit },
    { id: 'chat', label: 'Toggle Chat', shortcut: 'Ctrl+L', action: () => setShowAI(v => !v) },
    { id: 'terminal', label: 'Toggle Terminal', shortcut: 'Ctrl+J', action: () => setShowTerminal(v => !v) },
    { id: 'newterm', label: 'New Terminal', action: () => handleMenuAction('new-terminal') },
    { id: 'search', label: 'Search in Files', shortcut: 'Ctrl+Shift+F', action: () => setActiveView('search') },
    { id: 'git', label: 'Source Control', action: () => setActiveView('git') },
    { id: 'collab', label: 'Live Share', shortcut: 'Ctrl+Shift+L', action: () => {
      setActiveView('collaboration');
      setSidebarVisible(true);
    }},
    { id: 'promptlab', label: 'Prompt Lab', action: () => {
      setActiveView('promptlab');
      setSidebarVisible(true);
    }},
    { id: 'settings', label: 'Settings', action: () => setShowSettings(true) },
    { id: 'upgrade', label: 'Upgrade to Pro', action: () => openUpgrade() },
    { id: 'license', label: 'Activate License', action: () => setShowLicense(true) },
  ], [handleOpenFolder, openRecentProject, saveActiveFile, saveActiveFileAs, saveAllFiles, openUpgrade, requestInlineEdit, handleMenuAction, runEditorCommand, activeFilePath, closeFile, reopenClosedTab, closeOtherFiles, closeAllFiles, revealInExplorer, toggleSplit]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zenMode) {
        setZenMode(false);
        return;
      }
      if (e.ctrlKey && e.shiftKey && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(true);
      }
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      }
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        runEditorCommand({ type: 'replace' });
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        runEditorCommand({ type: 'duplicateLine' });
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'M') {
        e.preventDefault();
        runEditorCommand({ type: 'toggleMinimap' });
      }
      if (e.ctrlKey && e.key === '\\') {
        e.preventDefault();
        toggleSplit();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'L') {
        e.preventDefault();
        setActiveView('collaboration');
        setSidebarVisible(true);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        setShowPalette(true);
      }
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        setShowQuickOpen(true);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        void reopenClosedTab();
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        setActiveView('explorer');
        setSidebarVisible(true);
        if (activeFilePath) revealInExplorer(activeFilePath);
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setActiveView('search');
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'G') {
        e.preventDefault();
        setActiveView('git');
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        void saveActiveFileAs();
      }
      if (e.ctrlKey && e.altKey && e.key === 's') {
        e.preventDefault();
        saveAllFiles();
      }
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        runEditorCommand({ type: 'find' });
      }
      if (e.ctrlKey && e.key === 'g') {
        e.preventDefault();
        setShowGoToLine(true);
      }
      if (e.ctrlKey && e.key === 'w') {
        e.preventDefault();
        if (activeFilePath) closeFile(activeFilePath);
      }
      if (e.shiftKey && e.altKey && e.key === 'F') {
        e.preventDefault();
        runEditorCommand({ type: 'format' });
      }
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveActiveFile();
      }
      if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        handleOpenFolder();
      }
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        setShowAI(v => !v);
      }
      if (e.ctrlKey && e.key === 'j') {
        e.preventDefault();
        setShowTerminal(v => !v);
      }
      if (e.ctrlKey && e.key === 'b') {
        e.preventDefault();
        setSidebarVisible(v => !v);
      }
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        requestInlineEdit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveActiveFile, saveActiveFileAs, saveAllFiles, handleOpenFolder, requestInlineEdit, runEditorCommand, activeFilePath, closeFile, reopenClosedTab, revealInExplorer, toggleSplit, zenMode]);

  const topTitle = projectPath
    ? `${projectPath.split(/[/\\]/).pop()} — DownAI`
    : 'DownAI';

  return (
    <div className={`${styles.app} ${zenMode ? styles.zen : ''}`}>
      {!zenMode && (
      <div className={styles.topBar}>
        <MenuBar onAction={handleMenuAction} />
        <div className={styles.topTitle}>{topTitle}</div>
        {!projectPath && (
          <TopBarActions
            onOpenSettings={() => setShowSettings(true)}
            onOpenClone={() => setShowClone(true)}
            onOpenChat={() => setShowAI(true)}
            showChat={showAI}
          />
        )}
        <TitleBar />
      </div>
      )}
      <div className={styles.body}>
        {projectPath && !zenMode && (
          <ActivityBar
            activeView={activeView}
            onViewChange={(view) => { setActiveView(view); setSidebarVisible(true); }}
            showAI={showAI}
            onToggleAI={() => setShowAI(v => !v)}
            onOpenSettings={() => setShowSettings(true)}
          />
        )}
        {projectPath && !zenMode && sidebarVisible && activeView === 'explorer' && <Sidebar />}
        {projectPath && !zenMode && sidebarVisible && activeView === 'search' && <SearchPanel />}
        {projectPath && !zenMode && sidebarVisible && activeView === 'git' && <GitPanel />}
        {projectPath && !zenMode && sidebarVisible && activeView === 'promptlab' && <PromptLabPanel />}
        {projectPath && !zenMode && sidebarVisible && activeView === 'collaboration' && <CollaborationPanel />}
        <div className={styles.center}>
          <main className={styles.main}>
            {!projectPath ? (
              <WelcomeScreen
                onOpenFolder={handleOpenFolder}
                onOpenSettings={() => setShowSettings(true)}
                onUpgrade={() => openUpgrade()}
                onClone={() => setShowClone(true)}
                onOpenChat={() => setShowAI(true)}
              />
            ) : (
              <EditorArea />
            )}
          </main>
          {projectPath && !zenMode && (
            <BottomPanel
              visible={showTerminal}
              onClose={() => setShowTerminal(false)}
              newTerminalSignal={newTerminalSignal}
            />
          )}
        </div>
        {showAI && !zenMode && (
          <AIPanel onClose={() => setShowAI(false)} onUpgrade={openUpgrade} />
        )}
      </div>
      {!zenMode && <StatusBar />}
      <CommandPalette open={showPalette} onClose={() => setShowPalette(false)} commands={commands} />
      <QuickOpen open={showQuickOpen} onClose={() => setShowQuickOpen(false)} />
      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onActivateLicense={() => { setShowSettings(false); setShowLicense(true); }}
        />
      )}
      {showClone && (
        <CloneRepoModal onClose={() => setShowClone(false)} onClone={handleClone} />
      )}
      {showUpgrade && (
        <UpgradeModal
          onClose={() => setShowUpgrade(false)}
          onActivate={() => { setShowUpgrade(false); setShowLicense(true); }}
          reason={upgradeReason}
        />
      )}
      {showLicense && <LicenseModal onClose={() => setShowLicense(false)} />}
      <GoToLineModal
        open={showGoToLine}
        onClose={() => setShowGoToLine(false)}
        onGo={(line) => runEditorCommand({ type: 'gotoLine', line })}
      />
      <RecentProjectsModal
        open={showRecent}
        onClose={() => setShowRecent(false)}
        onOpen={handleOpenRecent}
      />
      <KeyboardShortcutsModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
    </div>
  );
}
