#!/usr/bin/env node
/**
 * Download the macOS .dmg from the latest successful GitHub Actions run,
 * sync downloads, and optionally redeploy the website.
 */
import { execSync, spawnSync } from 'child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const releaseDir = join(root, 'packages/meridian-app/release');
const destDir = join(root, 'packages/meridian-website/public/downloads');
const deploy = process.argv.includes('--deploy');

function gitHubToken() {
  const input = 'protocol=https\nhost=github.com\n\n';
  const result = spawnSync('git', ['credential', 'fill'], {
    input,
    encoding: 'utf-8',
    cwd: root,
  });
  if (result.status !== 0) throw new Error('Could not read GitHub credentials. Run: gh auth login');
  const line = result.stdout.split('\n').find((l) => l.startsWith('password='));
  if (!line) throw new Error('No GitHub token in credential store');
  return line.replace('password=', '').trim();
}

function getRepo() {
  const url = execSync('git remote get-url origin', { encoding: 'utf-8', cwd: root }).trim();
  const match = url.match(/github\.com[:/](.+?)(?:\.git)?$/i);
  if (!match) throw new Error('Origin is not a GitHub repo');
  return match[1];
}

async function ghApi(path, token) {
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'downai-fetch-mac',
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${path} (${res.status})`);
  return res.json();
}

async function download(url, dest, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
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
    if (name.endsWith('.dmg')) return join(dir, name);
  }
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    try {
      const nested = findDmg(full);
      if (nested) return nested;
    } catch {
      /* skip */
    }
  }
  return null;
}

const token = gitHubToken();
const repo = getRepo();
console.log(`Repo: ${repo}`);

const { workflow_runs: runs } = await ghApi(
  `repos/${repo}/actions/workflows/build-installers.yml/runs?status=success&per_page=10`,
  token
);

if (!runs?.length) {
  throw new Error('No successful macOS build yet. Push to main and wait for GitHub Actions.');
}

let saved = false;
for (const run of runs) {
  try {
    const { artifacts } = await ghApi(`repos/${repo}/actions/runs/${run.id}/artifacts`, token);
    const mac = artifacts?.find((a) => a.name === 'downai-macos');
    if (!mac) continue;

    const zipPath = join(releaseDir, 'downai-macos.zip');
    mkdirSync(releaseDir, { recursive: true });
    console.log(`Downloading macOS artifact from run ${run.id}…`);
    await download(mac.archive_download_url, zipPath, token);

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
    console.warn(`Run ${run.id}: ${e.message}`);
  }
}

if (!saved) throw new Error('Could not download macOS installer from GitHub Actions.');

execSync('npm run sync-downloads', { stdio: 'inherit', cwd: root });
if (deploy) execSync('npm run release:deploy', { stdio: 'inherit', cwd: root });
console.log('Mac installer ready.');
