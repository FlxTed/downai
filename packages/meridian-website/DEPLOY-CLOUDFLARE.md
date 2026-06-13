# Cloudflare Pages — DownAI marketing site



Deploy the static site to Cloudflare Pages. **Installers are too large for Pages** (25 MB limit) — host them on R2 or GitHub Releases and point the manifest at those URLs.



## Quick deploy (Dashboard)



1. Push this repo to GitHub.

2. [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → Connect Git.

3. Build settings:



| Setting | Value |

|---------|--------|

| **Root directory** | *(leave empty — repo root)* |

| **Build command** | `npm ci && npm run website:build:cf` |

| **Build output directory** | `packages/meridian-website/dist` |

| **Node.js version** | 20 |



4. Add environment variables (Settings → Environment variables):



| Variable | Example | Required |

|----------|---------|----------|

| `DOWNAI_DOWNLOAD_BASE_URL` | `https://downloads.downai.dev` | Yes for downloads |

| `DOWNAI_WINDOWS_DOWNLOAD_URL` | Full URL to `.exe` | Optional override |

| `DOWNAI_MAC_DOWNLOAD_URL` | Full URL to `.dmg` | Optional override |



5. Custom domain → add `downai.dev` (or your domain) → DNS auto-configures.



## Host installers (pick one)



### Option A — Cloudflare R2 (recommended)



1. R2 → Create bucket `downai-downloads` → allow public access or custom domain `downloads.downai.dev`.

2. Upload `DownAI-Setup-1.0.0.exe` (and `.dmg` when built).

3. Set `DOWNAI_DOWNLOAD_BASE_URL=https://downloads.downai.dev` in Pages env.

4. Before each deploy, run locally:



```bash

npm run sync-downloads:cf

```



This writes `manifest.json` with external URLs (no large files in `dist`).



### Option B — GitHub Releases



1. Create a release, attach installers.

2. Set per-file URLs:



```bash

set DOWNAI_WINDOWS_DOWNLOAD_URL=https://github.com/you/downai/releases/download/v1.0.0/DownAI-Setup-1.0.0.exe

npm run sync-downloads:cf

```



Commit the updated `manifest.json` or run `sync-downloads:cf` in CI before build.



## Local commands



```bash

npm run website          # dev server

npm run website:build    # full build (includes local installers if present)

npm run website:build:cf # Cloudflare build (strips .exe/.dmg from dist)

npm run sync-downloads   # copy installers + manifest (local paths)

npm run sync-downloads:cf # manifest only, external URLs

```



## Stripe redirect



After creating your Payment Link, set **After payment** → `https://yourdomain.com/success.html`.



Replace `https://buy.stripe.com/test_REPLACE_ME` in `index.html` with your live link before deploy.



## Checklist before go-live



- [ ] Custom domain + HTTPS on Pages

- [ ] Installers on R2 or GitHub Releases; manifest URLs work

- [ ] Stripe Payment Link + success redirect

- [ ] API deployed with Stripe webhook (optional auto-license email)

- [ ] Support email addresses updated in HTML if not using `@downai.dev`

