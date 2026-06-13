import { create } from 'zustand';

interface OutputState {
  lines: string[];
  append: (line: string) => void;
  clear: () => void;
}

export const useOutputStore = create<OutputState>((set) => ({
  lines: [],
  append: (line) =>
    set(s => ({ lines: [...s.lines.slice(-500), `[${new Date().toLocaleTimeString()}] ${line}`] })),
  clear: () => set({ lines: [] }),
}));
