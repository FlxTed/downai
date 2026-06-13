#!/usr/bin/env node
/**
 * Download the macOS .dmg from the latest successful GitHub Actions run,
 * sync downloads, and optionally redeploy the website.
 */
import { execSync } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const releaseDir = join(root, 'packages/meridian-app/release');
const destDir = join(root, 'packages/meridian-website/public/downloads');
const deploy = process.argv.includes('--deploy');

function gh(args) {
  return execSync(`gh ${args}`, { encoding: 'utf-8', cwd: root, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
}

function getRepo() {
  return gh('repo view --json nameWithOwner -q .nameWithOwner');
}

async function download(url, dest, headers = {}) {
  const res = await fetch(url, headers);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  mkdirSync(dirname(dest), { recursive: true });
  await pipeline(res.body, createWriteStream(dest));
}

function extractZip(zipPath, outDir) {
  mkdirSync(outDir, { recursive: true });
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force"`,
      { stdio: 'inherit' }
    );
  } else {
    execSync(`unzip -o "${zipPath}" -d "${outDir}"`, { stdio: 'inherit' });
  }
}

function findDmg(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (name.endsWith('.dmg')) return full;
  }
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    try {
      return findDmg(full);
    } catch {
      /* not a directory */
    }
  }
  return null;
}

const repo = getRepo();
console.log(`Repo: ${repo}`);

const runsJson = gh('run list --workflow=build-installers.yml --status=success --limit=10 --json databaseId');
const runs = JSON.parse(runsJson);
if (!runs.length) {
  throw new Error('No successful macOS build yet. Push to main and wait for GitHub Actions.');
}

let saved = false;
for (const run of runs) {
  try {
    const artifactsJson = gh(`api repos/${repo}/actions/runs/${run.databaseId}/artifacts`);
    const artifacts = JSON.parse(artifactsJson).artifacts || [];
    const mac = artifacts.find((a) => a.name === 'downai-macos');
    if (!mac) continue;

    const zipPath = join(releaseDir, 'downai-macos.zip');
    mkdirSync(releaseDir, { recursive: true });
    console.log(`Downloading macOS artifact from run ${run.databaseId}…`);

    const token = gh('auth token');
    await download(mac.archive_download_url, zipPath, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });

    const extractDir = join(releaseDir, 'mac-artifact');
    extractZip(zipPath, extractDir);
    const dmg = findDmg(extractDir);
    if (!dmg) throw new Error('No .dmg in artifact');

    const dest = join(destDir, dmg.split(/[/\\]/).pop());
    mkdirSync(destDir, { recursive: true });
    copyFileSync(dmg, dest);
    console.log(`Saved → ${dest}`);
    saved = true;
    break;
  } catch (e) {
    console.warn(`Run ${run.databaseId}: ${e.message}`);
  }
}

if (!saved) throw new Error('Could not download macOS installer from GitHub Actions.');

execSync('npm run sync-downloads', { stdio: 'inherit', cwd: root });
if (deploy) execSync('npm run website:deploy', { stdio: 'inherit', cwd: root });
console.log('Mac installer ready.');
