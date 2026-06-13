import { File } from 'lucide-react';

const EXT_COLORS: Record<string, string> = {
  ts: '#519aba', tsx: '#519aba', js: '#cbcb41', jsx: '#cbcb41', mjs: '#cbcb41',
  py: '#4ec9b0', rs: '#ce9178', go: '#4ec9b0', json: '#cbcb41',
  css: '#ce9178', scss: '#ce9178', html: '#e34c26', md: '#519aba',
  vue: '#42b883', svelte: '#ff3e00', java: '#b07219', cpp: '#519aba',
  yaml: '#cbcb41', yml: '#cbcb41', sql: '#569cd6', sh: '#4ec9b0',
};

export function FileIcon({ name, size = 16 }: { name: string; size?: number }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const color = EXT_COLORS[ext] || '#858585';
  return <File size={size} style={{ color, flexShrink: 0 }} strokeWidth={1.5} />;
}
