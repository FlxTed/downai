import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { app } from 'electron';
import { randomUUID } from 'crypto';

const DEVICE_PATH = path.join(app.getPath('userData'), 'device.json');

export async function getDeviceId(): Promise<string> {
  try {
    if (existsSync(DEVICE_PATH)) {
      const data = JSON.parse(await fs.readFile(DEVICE_PATH, 'utf-8'));
      if (data.id) return data.id as string;
    }
  } catch {
    /* regenerate */
  }
  const id = randomUUID();
  await fs.writeFile(DEVICE_PATH, JSON.stringify({ id }, null, 2));
  return id;
}
