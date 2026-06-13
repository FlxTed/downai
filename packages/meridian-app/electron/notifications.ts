import { Notification, BrowserWindow, app, nativeImage } from 'electron';
import { existsSync } from 'fs';
import { getAppIconPath } from './iconPath';
export interface NotificationPayload {
  title: string;
  body: string;
}

function getNotificationIcon() {
  const iconPath = getAppIconPath();
  if (existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) return img;
  }
  return undefined;
}

export function showDesktopNotification(
  mainWindow: BrowserWindow | null,
  payload: NotificationPayload
): boolean {
  if (!Notification.isSupported()) return false;

  const notification = new Notification({
    title: payload.title,
    body: payload.body,
    icon: getNotificationIcon(),
    silent: false,
  });

  notification.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  notification.show();
  return true;
}

export function shouldNotifyInBackground(mainWindow: BrowserWindow | null): boolean {
  if (!mainWindow) return true;
  return !mainWindow.isFocused() || mainWindow.isMinimized();
}

export function initNotifications() {
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.isPackaged ? 'dev.downai.app' : 'dev.downai.app.dev');
  }
}
