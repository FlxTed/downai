import type { FileNode } from '../store/editorStore';

export function flattenFiles(tree: FileNode[]): { path: string; name: string }[] {
  const out: { path: string; name: string }[] = [];
  const walk = (nodes: FileNode[]) => {
    for (const n of nodes) {
      if (n.type === 'file') out.push({ path: n.path, name: n.name });
      else if (n.children) walk(n.children);
    }
  };
  walk(tree);
  return out;
}

export function fuzzyMatch(query: string, text: string): boolean {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t.includes(q)) return true;
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}
