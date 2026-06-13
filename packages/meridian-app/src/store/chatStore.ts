import { create } from 'zustand';

export type ChatMode = 'agent' | 'ask' | 'edit';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  images?: string[];
}

export interface ChatThread {
  id: string;
  title: string;
  messages: ChatMessage[];
}

interface ChatState {
  loaded: boolean;
  threads: ChatThread[];
  activeThreadId: string;
  mode: ChatMode;
  load: () => Promise<void>;
  persist: () => Promise<void>;
  setMode: (mode: ChatMode) => void;
  setActiveThread: (id: string) => void;
  newThread: (id: string) => void;
  updateThreads: (updater: (threads: ChatThread[]) => ChatThread[]) => void;
  updateActiveMessages: (updater: (messages: ChatMessage[]) => ChatMessage[]) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  loaded: false,
  threads: [{ id: 'default', title: 'New Chat', messages: [] }],
  activeThreadId: 'default',
  mode: 'ask',

  load: async () => {
    const data = await window.downai.chat.load();
    set({
      loaded: true,
      threads: data.threads.length ? data.threads : [{ id: 'default', title: 'New Chat', messages: [] }],
      activeThreadId: data.activeThreadId || data.threads[0]?.id || 'default',
      mode: data.mode || 'ask',
    });
  },

  persist: async () => {
    const { threads, activeThreadId, mode } = get();
    await window.downai.chat.save({ threads, activeThreadId, mode });
  },

  setMode: (mode) => {
    set({ mode });
    void get().persist();
  },

  setActiveThread: (id) => {
    set({ activeThreadId: id });
    void get().persist();
  },

  newThread: (id) => {
    set(state => ({
      threads: [{ id, title: 'New Chat', messages: [] }, ...state.threads],
      activeThreadId: id,
    }));
    void get().persist();
  },

  updateThreads: (updater) => {
    set(state => ({ threads: updater(state.threads) }));
    void get().persist();
  },

  updateActiveMessages: (updater) => {
    const { activeThreadId } = get();
    get().updateThreads(threads =>
      threads.map(t => {
        if (t.id !== activeThreadId) return t;
        const messages = updater(t.messages);
        const firstUser = messages.find(m => m.role === 'user');
        const label = firstUser.content.trim() || (firstUser.images?.length ? 'Image message' : 'New Chat');
        const title =
          t.title === 'New Chat' && firstUser
            ? label.slice(0, 36) + (label.length > 36 ? '…' : '')
            : t.title;
        return { ...t, messages, title };
      })
    );
  },
}));
