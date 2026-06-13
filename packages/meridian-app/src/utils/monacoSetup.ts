import type { Monaco } from '@monaco-editor/react';

export interface EditorPreferences {
  fontSize?: number;
  minimap?: boolean;
  theme?: 'dark' | 'light';
}

export const BASE_EDITOR_OPTIONS = {
  fontFamily: 'JetBrains Mono, Cascadia Code, Consolas, monospace',
  fontLigatures: true,
  scrollBeyondLastLine: false,
  padding: { top: 8 },
  lineNumbers: 'on' as const,
  renderLineHighlight: 'line' as const,
  cursorBlinking: 'smooth' as const,
  cursorSmoothCaretAnimation: 'on' as const,
  smoothScrolling: true,
  bracketPairColorization: { enabled: true },
  automaticLayout: true,
  tabSize: 2,
  wordWrap: 'off' as const,
  overviewRulerBorder: false,
  guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
  stickyScroll: { enabled: true },
  folding: true,
  foldingHighlight: true,
  matchBrackets: 'always' as const,
  formatOnPaste: true,
  quickSuggestions: { other: true, comments: false, strings: true },
  suggestOnTriggerCharacters: true,
  acceptSuggestionOnEnter: 'on' as const,
  renderWhitespace: 'selection' as const,
  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
  find: { addExtraSpaceOnTop: false },
};

export function buildEditorOptions(prefs: EditorPreferences = {}) {
  return {
    ...BASE_EDITOR_OPTIONS,
    fontSize: prefs.fontSize ?? 14,
    minimap: { enabled: prefs.minimap !== false, scale: 1, showSlider: 'mouseover' as const },
  };
}

export function defineDownAIThemes(monaco: Monaco) {
  monaco.editor.defineTheme('downai-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: '569cd6' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'number', foreground: 'b5cea8' },
      { token: 'type', foreground: '4ec9b0' },
      { token: 'function', foreground: 'dcdcaa' },
      { token: 'variable', foreground: '9cdcfe' },
      { token: 'constant', foreground: '4fc1ff' },
    ],
    colors: {
      'editor.background': '#181818',
      'editor.foreground': '#cccccc',
      'editor.lineHighlightBackground': '#1f1f1f',
      'editor.selectionBackground': '#264f78',
      'editor.inactiveSelectionBackground': '#3a3d41',
      'editorCursor.foreground': '#cccccc',
      'editorLineNumber.foreground': '#6b6b6b',
      'editorLineNumber.activeForeground': '#cccccc',
      'editorIndentGuide.background': '#2b2b2b',
      'editorIndentGuide.activeBackground': '#404040',
      'editorWidget.background': '#1c1c1c',
      'editorWidget.border': '#2b2b2b',
      'editorSuggestWidget.background': '#1c1c1c',
      'editorSuggestWidget.border': '#2b2b2b',
      'editorSuggestWidget.selectedBackground': '#232323',
      'minimap.background': '#181818',
      'scrollbarSlider.background': '#424242',
      'scrollbarSlider.hoverBackground': '#4f4f4f',
      'editorBracketMatch.background': '#00000000',
      'editorBracketMatch.border': '#555555',
    },
  });

  monaco.editor.defineTheme('downai-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0000ff' },
      { token: 'string', foreground: 'a31515' },
      { token: 'number', foreground: '098658' },
      { token: 'type', foreground: '267f99' },
    ],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#1e1e1e',
      'editor.lineHighlightBackground': '#f5f5f5',
      'editor.selectionBackground': '#add6ff',
      'editorLineNumber.foreground': '#6b6b6b',
      'minimap.background': '#f8f8f8',
    },
  });
}

export function registerSnippets(monaco: Monaco) {
  monaco.languages.registerCompletionItemProvider('typescript', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      return {
        suggestions: [
          {
            label: 'log',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'console.log(${1});',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            documentation: 'Console log',
            range,
          },
          {
            label: 'func',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'function ${1:name}(${2}) {\n\t${3}\n}',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
          {
            label: 'arrow',
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: 'const ${1:name} = (${2}) => {\n\t${3}\n};',
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          },
        ],
      };
    },
  });
}

/** @deprecated use buildEditorOptions */
export const EDITOR_OPTIONS = buildEditorOptions();

/** @deprecated use defineDownAIThemes */
export function defineDownAITheme(monaco: Monaco) {
  defineDownAIThemes(monaco);
}
