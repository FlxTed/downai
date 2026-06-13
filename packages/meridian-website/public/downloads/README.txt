Place release installers here (auto-synced by npm run sync-downloads):

  DownAI-Setup-1.0.0.exe   Windows NSIS installer
  DownAI-1.0.0.dmg         macOS disk image
  manifest.json             Download metadata for the website

From repo root:
  npm run release          Build Windows installer + sync + website dist
  npm run build:exe        Build Windows installer only
  npm run sync-downloads   Copy release artifacts here + update manifest.json
