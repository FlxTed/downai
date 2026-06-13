import { safeStorage } from 'electron';

export function isSecureStorageAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

export function encryptSecret(plain: string): string {
  if (!plain) return '';
  if (!safeStorage.isEncryptionAvailable()) return plain;
  return safeStorage.encryptString(plain).toString('base64');
}

export function decryptSecret(stored: string): string {
  if (!stored) return '';
  if (!safeStorage.isEncryptionAvailable()) return stored;
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'));
  } catch {
    return '';
  }
}

export function isEncryptedSecret(stored: string): boolean {
  if (!stored || !safeStorage.isEncryptionAvailable()) return false;
  try {
    safeStorage.decryptString(Buffer.from(stored, 'base64'));
    return true;
  } catch {
    return false;
  }
}
