import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

function bookmarksPath() {
  return join(app.getPath('userData'), 'bookmarks.json');
}

export function loadBookmarks(): Record<string, string[]> {
  try {
    const p = bookmarksPath();
    if (!existsSync(p)) return {};
    return JSON.parse(readFileSync(p, 'utf-8')) as Record<string, string[]>;
  } catch {
    return {};
  }
}

export function saveBookmarks(data: Record<string, string[]>) {
  mkdirSync(app.getPath('userData'), { recursive: true });
  writeFileSync(bookmarksPath(), JSON.stringify(data, null, 2));
}
