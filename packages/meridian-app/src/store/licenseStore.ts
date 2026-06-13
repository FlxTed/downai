import { create } from 'zustand';

export interface LicenseStatus {
  plan: 'free' | 'pro';
  isPro: boolean;
  email?: string;
  expiresAt?: number;
  aiMessagesToday: number;
  aiDailyLimit: number;
}

interface LicenseState {
  status: LicenseStatus;
  loaded: boolean;
  refresh: () => Promise<void>;
  activate: (key: string) => Promise<void>;
  deactivate: () => Promise<void>;
}

const defaultStatus: LicenseStatus = {
  plan: 'free',
  isPro: false,
  aiMessagesToday: 0,
  aiDailyLimit: 10,
};

export const useLicenseStore = create<LicenseState>((set) => ({
  status: defaultStatus,
  loaded: false,

  refresh: async () => {
    const status = await window.downai.license.status();
    set({ status, loaded: true });
  },

  activate: async (key: string) => {
    const status = await window.downai.license.activate(key);
    set({ status });
  },

  deactivate: async () => {
    const status = await window.downai.license.deactivate();
    set({ status });
  },
}));
