import { create } from 'zustand';

interface BookmarksState {
  byProject: Record<string, string[]>;
  loaded: boolean;
  load: () => Promise<void>;
  persist: () => Promise<void>;
  toggle: (projectPath: string, filePath: string) => void;
  list: (projectPath: string) => string[];
  isPinned: (projectPath: string, filePath: string) => boolean;
}

export const useBookmarksStore = create<BookmarksState>((set, get) => ({
  byProject: {},
  loaded: false,

  load: async () => {
    const data = await window.downai.bookmarks.load();
    set({ byProject: data, loaded: true });
  },

  persist: async () => {
    await window.downai.bookmarks.save(get().byProject);
  },

  list: (projectPath) => get().byProject[projectPath] ?? [],

  isPinned: (projectPath, filePath) =>
    (get().byProject[projectPath] ?? []).includes(filePath),

  toggle: (projectPath, filePath) => {
    const current = get().byProject[projectPath] ?? [];
    const next = current.includes(filePath)
      ? current.filter(p => p !== filePath)
      : [filePath, ...current];
    set({ byProject: { ...get().byProject, [projectPath]: next } });
    void get().persist();
  },
}));
