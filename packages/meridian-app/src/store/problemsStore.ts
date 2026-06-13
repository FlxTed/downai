import { create } from 'zustand';

export interface Problem {
  id: string;
  path: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

interface ProblemsState {
  problems: Problem[];
  setProblems: (problems: Problem[]) => void;
  clearForFile: (path: string) => void;
}

export const useProblemsStore = create<ProblemsState>((set) => ({
  problems: [],
  setProblems: (problems) => set({ problems }),
  clearForFile: (path) =>
    set(state => ({ problems: state.problems.filter(p => p.path !== path) })),
}));

export function scanFileProblems(path: string, content: string, language: string): Problem[] {
  const problems: Problem[] = [];
  const lines = content.split('\n');

  if (language === 'json') {
    try {
      JSON.parse(content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      const match = msg.match(/position (\d+)/i);
      let line = 1;
      if (match) {
        const pos = Number(match[1]);
        line = content.slice(0, pos).split('\n').length;
      }
      problems.push({
        id: `${path}:json`,
        path,
        line,
        column: 1,
        message: msg,
        severity: 'error',
      });
    }
  }

  if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(language)) {
    let braces = 0;
    let parens = 0;
    let brackets = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const ch of line) {
        if (ch === '{') braces++;
        if (ch === '}') braces--;
        if (ch === '(') parens++;
        if (ch === ')') parens--;
        if (ch === '[') brackets++;
        if (ch === ']') brackets--;
      }
      if (braces < 0 || parens < 0 || brackets < 0) {
        problems.push({
          id: `${path}:bracket:${i + 1}`,
          path,
          line: i + 1,
          column: 1,
          message: 'Unexpected closing bracket',
          severity: 'error',
        });
        break;
      }
    }
    if (braces > 0) {
      problems.push({
        id: `${path}:brace-open`,
        path,
        line: lines.length,
        column: 1,
        message: `Unclosed { (${braces} remaining)`,
        severity: 'warning',
      });
    }
    if (parens > 0) {
      problems.push({
        id: `${path}:paren-open`,
        path,
        line: lines.length,
        column: 1,
        message: `Unclosed ( (${parens} remaining)`,
        severity: 'warning',
      });
    }
  }

  lines.forEach((line, i) => {
    if (/\bTODO\b|\bFIXME\b|\bHACK\b/.test(line)) {
      problems.push({
        id: `${path}:todo:${i + 1}`,
        path,
        line: i + 1,
        column: line.search(/\b(TODO|FIXME|HACK)\b/) + 1,
        message: line.trim().slice(0, 80),
        severity: 'warning',
      });
    }
  });

  return problems;
}
