import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { app } from 'electron';
import { getDeviceId } from './deviceId';

const LICENSE_PATH = path.join(app.getPath('userData'), 'license.json');
const isDev = !app.isPackaged;
const DEFAULT_API_BASE = isDev ? 'http://localhost:8787' : 'https://api.downai.dev';

export interface LicenseInfo {
  sessionToken?: string;
  plan: 'free' | 'pro';
  email?: string;
  activatedAt: number;
  expiresAt?: number;
}

export interface LicenseStatus {
  plan: 'free' | 'pro';
  isPro: boolean;
  email?: string;
  expiresAt?: number;
  aiMessagesToday: number;
  aiDailyLimit: number;
}

const FREE_AI_DAILY_LIMIT = 10;
const PRO_AI_DAILY_LIMIT = 999999;

function decodeTokenExpiry(token: string): number | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.licenseExpiresAt ?? (payload.exp ? payload.exp * 1000 : undefined);
  } catch {
    return undefined;
  }
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return !payload.exp || payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

async function getApiBase(hostedApiUrl?: string): Promise<string> {
  if (hostedApiUrl) {
    return hostedApiUrl.replace(/\/v1\/chat\/?$/, '').replace(/\/$/, '');
  }
  return DEFAULT_API_BASE;
}

export async function loadLicense(): Promise<LicenseInfo> {
  const defaults: LicenseInfo = { plan: 'free', activatedAt: Date.now() };
  try {
    if (existsSync(LICENSE_PATH)) {
      const data = await fs.readFile(LICENSE_PATH, 'utf-8');
      const license = JSON.parse(data) as LicenseInfo & { key?: string };

      if ((license as { key?: string }).key && !license.sessionToken) {
        return defaults;
      }

      if (license.plan === 'pro' && license.sessionToken) {
        if (isTokenExpired(license.sessionToken)) {
          return defaults;
        }
        if (license.expiresAt && license.expiresAt < Date.now()) {
          return defaults;
        }
      } else if (license.plan === 'pro') {
        return defaults;
      }

      return license;
    }
  } catch {
    /* defaults */
  }
  return defaults;
}

export async function saveLicense(license: LicenseInfo) {
  await fs.writeFile(LICENSE_PATH, JSON.stringify(license, null, 2));
}

export async function activateLicense(key: string, hostedApiUrl?: string): Promise<LicenseStatus> {
  const deviceId = await getDeviceId();
  const base = await getApiBase(hostedApiUrl);

  const response = await fetch(`${base}/v1/license/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: key.trim(), deviceId }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'License activation failed. Check your key and internet connection.');
  }

  const license: LicenseInfo = {
    sessionToken: data.token,
    plan: 'pro',
    email: data.email,
    activatedAt: Date.now(),
    expiresAt: data.expiresAt,
  };
  await saveLicense(license);
  return getLicenseStatus(license);
}

export async function deactivateLicense() {
  await saveLicense({ plan: 'free', activatedAt: Date.now() });
  return getLicenseStatus({ plan: 'free', activatedAt: Date.now() });
}

export async function getSessionToken(): Promise<string> {
  const license = await loadLicense();
  return license.sessionToken || '';
}

async function getAiUsageToday(): Promise<number> {
  const usagePath = path.join(app.getPath('userData'), 'ai-usage.json');
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (existsSync(usagePath)) {
      const data = JSON.parse(await fs.readFile(usagePath, 'utf-8'));
      return data[today] || 0;
    }
  } catch {
    /* zero */
  }
  return 0;
}

export async function incrementAiUsage() {
  const usagePath = path.join(app.getPath('userData'), 'ai-usage.json');
  const today = new Date().toISOString().slice(0, 10);
  let usage: Record<string, number> = {};
  try {
    if (existsSync(usagePath)) {
      usage = JSON.parse(await fs.readFile(usagePath, 'utf-8'));
    }
  } catch {
    /* fresh */
  }
  usage[today] = (usage[today] || 0) + 1;
  await fs.writeFile(usagePath, JSON.stringify(usage, null, 2));
}

export async function getLicenseStatus(license?: LicenseInfo): Promise<LicenseStatus> {
  const lic = license || (await loadLicense());
  const hasValidToken = lic.plan === 'pro' && !!lic.sessionToken && !isTokenExpired(lic.sessionToken);
  const isPro = hasValidToken;
  const aiMessagesToday = await getAiUsageToday();

  return {
    plan: isPro ? 'pro' : 'free',
    isPro,
    email: lic.email,
    expiresAt: lic.expiresAt ?? (lic.sessionToken ? decodeTokenExpiry(lic.sessionToken) : undefined),
    aiMessagesToday,
    aiDailyLimit: isPro ? PRO_AI_DAILY_LIMIT : FREE_AI_DAILY_LIMIT,
  };
}

export async function canUseAi(): Promise<{ allowed: boolean; reason?: string; status: LicenseStatus }> {
  const status = await getLicenseStatus();
  if (status.aiMessagesToday >= status.aiDailyLimit) {
    return {
      allowed: false,
      reason: status.isPro
        ? 'Daily limit reached.'
        : `Free plan includes ${FREE_AI_DAILY_LIMIT} AI messages per day. Upgrade to Pro for unlimited.`,
      status,
    };
  }
  return { allowed: true, status };
}
