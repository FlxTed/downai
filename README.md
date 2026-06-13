# DownAI

**DownAI** is a native Windows code editor with Monaco, project tools, file search, and integrated AI chat. Free to start; **Pro** unlocks unlimited AI.

## Quick start (development)

```bash
npm install
npm run dev
```

## Build installers

```bash
npm run icons
npm run build:exe    # Windows → packages/meridian-app/release/
npm run build:mac    # macOS (run on a Mac) → DownAI-1.0.0.dmg
npm run website:build
```

Copy installers to the download site:

```bash
cp "packages/meridian-app/release/DownAI Setup 1.0.0.exe" packages/meridian-website/public/downloads/DownAI-Setup-1.0.0.exe
cp "packages/meridian-app/release/DownAI-1.0.0.dmg" packages/meridian-website/public/downloads/DownAI-1.0.0.dmg
npm run website:build
```

## Marketing site

```bash
npm run website          # dev server at http://localhost:5173
npm run website:build    # static export → packages/meridian-website/dist
```

Deploy `packages/meridian-website/dist` to Vercel, Netlify, or any static host. Point **downai.dev** (or your domain) at it.

## Monetization

| Plan | Price | AI limit |
|------|-------|----------|
| Free | $0 | 10 messages/day |
| Pro | $19/mo | Unlimited |

1. Create a [Stripe Payment Link](https://dashboard.stripe.com/payment-links) for $19/mo
2. Replace `https://buy.stripe.com/test_REPLACE_ME` in `packages/meridian-website/index.html`
3. After each purchase, generate and email a key:

```bash
node scripts/generate-license.mjs 1
```

4. Customer activates in **Settings → Plan → Activate license** or **Ctrl+Shift+P → Activate License**

See **[BUSINESS.md](./BUSINESS.md)** for the full launch checklist.

## AI setup

**Default (like Cursor): DownAI** — users chat without pasting a key. You host a small API with *your* OpenAI key:

```bash
cp packages/prism-api/.env.example packages/prism-api/.env
# Add OPENAI_API_KEY=sk-...
npm run api
```

Deploy `packages/prism-api` to Railway/Fly/Render. Point the app at it (Settings → DownAI → endpoint, or ship `https://api.downai.dev/v1/chat` in production).

**Optional: BYOK** — Settings → “Your API key” sends requests directly to OpenAI from the user’s machine (how Prism worked before).

| | Cursor | Prism (now) |
|---|--------|-------------|
| Who holds the OpenAI key? | Cursor’s servers | **You** (hosted) or user (BYOK) |
| User pastes `sk-...`? | No (normal use) | No (DownAI mode) |
| Limits | Cursor account | Free 10/day · Pro unlimited (license key) |
| Where requests go | Cursor cloud → OpenAI | Your API → OpenAI |

For BYOK: Settings → **Your API key**, then **Ctrl+L** to chat. Key stays on the user's machine.

## Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+O | Open folder |
| Ctrl+S | Save file |
| Ctrl+L | Toggle chat |
| Ctrl+J | Toggle terminal |
| Ctrl+Shift+P | Command palette |
| Ctrl+Shift+F | Search in files |

## Project structure

```
packages/meridian-app/     Desktop app (Electron + React)
packages/meridian-website/ Marketing site + download
scripts/generate-license.mjs   Pro key generator (keep secret)
scripts/generate-icons.mjs     Icon assets for electron-builder
```

## License keys

Format: `DOWNAI-PRO-XXXX-XXXX-XXXXXXXX` — validated offline via HMAC. Keys expire based on embedded duration (default 12 months when generated with `generate-license.mjs`). Legacy keys from prior names still work.

**Do not commit or publish `scripts/generate-license.mjs` SECRET in production** — rotate the secret and rebuild if leaked.
