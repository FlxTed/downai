import { useState, useRef, useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import Editor, { OnMount } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import type { Monaco } from '@monaco-editor/react';
import { useEditorStore } from '../store/editorStore';
import { useProblemsStore, scanFileProblems } from '../store/problemsStore';
import { useCollaborationStore } from '../store/collaborationStore';
import { EmptyEditor } from './EmptyEditor';
import { Breadcrumbs } from './Breadcrumbs';
import { InlineEdit } from './InlineEdit';
import { FileIcon } from '../utils/fileIcons';
import { buildEditorOptions, defineDownAIThemes, registerSnippets, type EditorPreferences } from '../utils/monacoSetup';
import { applyTheme, editorMonacoTheme } from '../utils/theme';
import styles from './EditorArea.module.css';

interface InlineState {
  selection: string;
  replaceAll: boolean;
}

function FileEditor({
  file,
  isPrimary,
  prefs,
  onContentChange,
  onCursor,
  onMountExtra,
}: {
  file: { path: string; content: string; language: string };
  isPrimary: boolean;
  prefs: EditorPreferences;
  onContentChange: (path: string, value: string) => void;
  onCursor?: (line: number, col: number) => void;
  onMountExtra?: (editor: MonacoEditor.IStandaloneCodeEditor, monaco: Monaco) => void;
}) {
  return (
    <div className={styles.pane}>
      <Editor
        key={file.path + (isPrimary ? '-primary' : '-split')}
        language={file.language}
        value={file.content}
        theme={editorMonacoTheme(prefs.theme ?? 'dark')}
        onChange={(value) => onContentChange(file.path, value || '')}
        onMount={(editor, monaco) => {
          if (onCursor) {
            editor.onDidChangeCursorPosition(e => {
              onCursor(e.position.lineNumber, e.position.column);
            });
          }
          onMountExtra?.(editor, monaco);
        }}
        options={buildEditorOptions(prefs)}
        beforeMount={(monaco) => {
          defineDownAIThemes(monaco);
          registerSnippets(monaco);
        }}
      />
    </div>
  );
}

export function EditorArea() {
  const {
    openFiles, activeFilePath, splitFilePath, setActiveFile, closeFile, updateFileContent,
    getActiveFile, setCursorPosition, inlineEditSignal, revealRequest, clearReveal,
    editorCommand, clearEditorCommand, setSplitFile, closeSplit,
  } = useEditorStore();
  const collabStatus = useCollaborationStore(s => s.status);
  const collabPeers = useCollaborationStore(s => s.peers);
  const broadcastDoc = useCollaborationStore(s => s.broadcastDoc);
  const broadcastCursor = useCollaborationStore(s => s.broadcastCursor);
  const broadcastActiveFile = useCollaborationStore(s => s.broadcastActiveFile);
  const activeFile = getActiveFile();
  const splitFile = openFiles.find(f => f.path === splitFilePath);
  const primaryRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const remoteDecorationsRef = useRef<string[]>([]);
  const docBroadcastTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const cursorBroadcastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wordWrapRef = useRef(false);
  const minimapRef = useRef(true);
  const [inlineEdit, setInlineEdit] = useState<InlineState | null>(null);
  const [prefs, setPrefs] = useState<EditorPreferences>({ fontSize: 14, minimap: true, theme: 'dark' });
  const setProblems = useProblemsStore(s => s.setProblems);
  const problems = useProblemsStore(s => s.problems);

  useEffect(() => {
    window.downai.settings.load().then(s => {
      const next = {
        fontSize: s.fontSize ?? 14,
        minimap: s.minimap !== false,
        theme: (s.theme as 'dark' | 'light') || 'dark',
      };
      setPrefs(next);
      applyTheme(next.theme);
      minimapRef.current = next.minimap !== false;
    });
  }, []);

  useEffect(() => {
    const all = openFiles.flatMap(file =>
      scanFileProblems(file.path, file.content, file.language)
    );
    setProblems(all);
  }, [openFiles, setProblems]);

  useEffect(() => {
    const editor = primaryRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !activeFilePath) return;
    const model = editor.getModel();
    if (!model) return;
    const fileProblems = problems.filter(p => p.path === activeFilePath);
    monaco.editor.setModelMarkers(
      model,
      'downai',
      fileProblems.map(p => ({
        severity: p.severity === 'error' ? monaco.MarkerSeverity.Error : monaco.MarkerSeverity.Warning,
        message: p.message,
        startLineNumber: p.line,
        startColumn: Math.max(1, p.column),
        endLineNumber: p.line,
        endColumn: Math.max(2, p.column + 1),
      }))
    );
  }, [problems, activeFilePath]);

  const handleContentChange = useCallback((path: string, content: string) => {
    updateFileContent(path, content);
    if (collabStatus !== 'connected') return;
    const prev = docBroadcastTimers.current.get(path);
    if (prev) clearTimeout(prev);
    docBroadcastTimers.current.set(
      path,
      setTimeout(() => broadcastDoc(path, content), 120)
    );
  }, [updateFileContent, collabStatus, broadcastDoc]);

  const handleCursorChange = useCallback((line: number, column: number) => {
    setCursorPosition(line, column);
    if (collabStatus !== 'connected' || !activeFilePath) return;
    if (cursorBroadcastTimer.current) clearTimeout(cursorBroadcastTimer.current);
    cursorBroadcastTimer.current = setTimeout(() => {
      broadcastCursor(activeFilePath, line, column);
    }, 80);
  }, [setCursorPosition, collabStatus, activeFilePath, broadcastCursor]);

  useEffect(() => {
    if (collabStatus === 'connected' && activeFilePath) {
      broadcastActiveFile(activeFilePath);
    }
  }, [collabStatus, activeFilePath, broadcastActiveFile]);

  useEffect(() => {
    const editor = primaryRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !activeFilePath) {
      remoteDecorationsRef.current = editor?.deltaDecorations(remoteDecorationsRef.current, []) || [];
      return;
    }

    const decorations = collabPeers
      .filter((peer) => peer.activeFile === activeFilePath)
      .map((peer) => ({
        range: new monaco.Range(peer.line, peer.column, peer.line, peer.column),
        options: {
          className: 'collab-remote-cursor',
          hoverMessage: { value: `${peer.name} · Ln ${peer.line}, Col ${peer.column}` },
        },
      }));

    remoteDecorationsRef.current = editor.deltaDecorations(remoteDecorationsRef.current, decorations);
  }, [collabPeers, activeFilePath]);

  const openInline = useCallback((replaceAll: boolean) => {
    const editor = primaryRef.current;
    const file = getActiveFile();
    if (!editor || !file) return;
    const sel = editor.getSelection();
    const model = editor.getModel();
    if (!model || !sel) return;
    const text = model.getValueInRange(sel);
    setInlineEdit({
      selection: text.trim() ? text : file.content,
      replaceAll: replaceAll || !text.trim(),
    });
  }, [getActiveFile]);

  const onPrimaryMount = useCallback((editor: MonacoEditor.IStandaloneCodeEditor, monaco: Monaco) => {
    primaryRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => openInline(false));
  }, [openInline]);

  useEffect(() => {
    if (!inlineEditSignal) return;
    openInline(false);
  }, [inlineEditSignal, openInline]);

  useEffect(() => {
    if (!revealRequest || revealRequest.path !== activeFilePath) return;
    const tryReveal = () => {
      const editor = primaryRef.current;
      if (!editor) return;
      editor.revealLineInCenter(revealRequest.line);
      editor.setPosition({ lineNumber: revealRequest.line, column: 1 });
      editor.focus();
      clearReveal();
    };
    const t = setTimeout(tryReveal, 50);
    return () => clearTimeout(t);
  }, [revealRequest, activeFilePath, activeFile?.content, clearReveal]);

  useEffect(() => {
    if (!editorCommand) return;
    const editor = primaryRef.current;
    if (!editor) {
      clearEditorCommand();
      return;
    }

    if (editorCommand.type === 'find') {
      editor.getAction('actions.find')?.run();
    } else if (editorCommand.type === 'replace') {
      editor.getAction('editor.action.startFindReplaceAction')?.run();
    } else if (editorCommand.type === 'format') {
      editor.getAction('editor.action.formatDocument')?.run();
    } else if (editorCommand.type === 'gotoLine') {
      editor.revealLineInCenter(editorCommand.line);
      editor.setPosition({ lineNumber: editorCommand.line, column: 1 });
      editor.focus();
    } else if (editorCommand.type === 'toggleWordWrap') {
      wordWrapRef.current = !wordWrapRef.current;
      editor.updateOptions({ wordWrap: wordWrapRef.current ? 'on' : 'off' });
    } else if (editorCommand.type === 'toggleMinimap') {
      minimapRef.current = !minimapRef.current;
      editor.updateOptions({ minimap: { enabled: minimapRef.current } });
      setPrefs(p => ({ ...p, minimap: minimapRef.current }));
    } else if (editorCommand.type === 'duplicateLine') {
      editor.getAction('editor.action.copyLinesDownAction')?.run();
    }
    clearEditorCommand();
  }, [editorCommand, clearEditorCommand]);

  const applyInlineEdit = useCallback((newCode: string) => {
    const editor = primaryRef.current;
    const path = activeFile?.path;
    if (!editor || !path) return;
    if (inlineEdit?.replaceAll) {
      editor.setValue(newCode);
    } else {
      const sel = editor.getSelection();
      if (sel) {
        editor.executeEdits('inline-edit', [{ range: sel, text: newCode, forceMoveMarkers: true }]);
      }
    }
    updateFileContent(path, editor.getValue());
    setInlineEdit(null);
  }, [activeFile?.path, updateFileContent, inlineEdit?.replaceAll]);

  if (openFiles.length === 0) {
    return <EmptyEditor />;
  }

  return (
    <div className={styles.area}>
      <div className={styles.tabs}>
        {openFiles.map(file => (
          <button
            key={file.path}
            className={`${styles.tab} ${file.path === activeFilePath ? styles.activeTab : ''} ${file.path === splitFilePath ? styles.splitTab : ''}`}
            onClick={() => setActiveFile(file.path)}
            onContextMenu={(e) => {
              e.preventDefault();
              setSplitFile(file.path);
            }}
          >
            <FileIcon name={file.name} size={14} />
            <span className={styles.tabName}>{file.name}</span>
            {file.isDirty && <span className={styles.dirtyDot} />}
            <span
              className={styles.tabClose}
              onClick={(e) => {
                e.stopPropagation();
                if (splitFilePath === file.path) setSplitFile(null);
                closeFile(file.path);
              }}
            >
              <X size={14} />
            </span>
          </button>
        ))}
        {splitFilePath && (
          <button className={styles.splitClose} onClick={closeSplit} title="Close split">
            Split ×
          </button>
        )}
      </div>
      <Breadcrumbs />
      <div className={`${styles.editorWrap} ${splitFile ? styles.split : ''}`}>
        {activeFile && (
          <FileEditor
            file={activeFile}
            isPrimary
            prefs={prefs}
            onContentChange={handleContentChange}
            onCursor={handleCursorChange}
            onMountExtra={onPrimaryMount}
          />
        )}
        {splitFile && (
          <FileEditor
            file={splitFile}
            isPrimary={false}
            prefs={prefs}
            onContentChange={handleContentChange}
          />
        )}
      </div>
      {inlineEdit && activeFile && (
        <InlineEdit
          selection={inlineEdit.selection}
          language={activeFile.language}
          replaceAll={inlineEdit.replaceAll}
          onClose={() => setInlineEdit(null)}
          onApply={applyInlineEdit}
        />
      )}
    </div>
  );
}
