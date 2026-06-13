import { app } from 'electron';
import path from 'path';
import { existsSync } from 'fs';

export function getAppIconPath(): string {
  const packaged = path.join(process.resourcesPath, 'icon.png');
  if (app.isPackaged && existsSync(packaged)) return packaged;
  return path.join(__dirname, '../public/icon.png');
}
