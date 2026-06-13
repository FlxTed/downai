export function applyTheme(theme: 'dark' | 'light') {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
}

export function editorMonacoTheme(theme: 'dark' | 'light') {
  return theme === 'light' ? 'downai-light' : 'downai-dark';
}
