# app.smartloop.ai

[![Deploy](https://github.com/smartloop-ai/app.smartloop.ai/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/smartloop-ai/app.smartloop.ai/actions/workflows/deploy-pages.yml)
[![Built with Next.js](https://img.shields.io/badge/built%20with-Next.js-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)

The account console for [Smartloop](https://smartloop.ai) at
**[app.smartloop.ai](https://app.smartloop.ai)**. It's where you sign up, sign
in, manage access tokens for [Docent](https://github.com/smartloop-ai/docent)
and Smartloop Studio, turn on web search, and manage your plan, credits and
billing.

It's a static [Next.js](https://nextjs.org/) export served from GitHub Pages.
There is no server of its own: every page is plain HTML and JavaScript that
talks to the Smartloop API (`api.smartloop.ai`) from the browser.

## What's in it

| Area | Pages | What it does |
|---|---|---|
| Sign-in | `/login`, `/signup`, `/verify`, `/resend`, `/forgot`, `/reset` | Email and social sign-in, account verification, password reset |
| CLI and Studio sign-in | `/oauth-callback`, `/redirect`, `/mcp-servers/oauth-callback` | Completes OAuth for Docent and Studio and hands the result back to the app (`smartloop://...`) |
| Invites | `/invite`, `/invite-verify` | Request and redeem an invite |
| Overview | `/dashboard` | Getting started, token usage and estimated savings |
| Models | `/models` | The model catalogue and published benchmark scores |
| Cloud models | `/cloud-models/usage`, `/cloud-models/history` | Credit usage and call history for cloud models |
| GPU boxes | `/gpushed` | [gpushed](https://gpushed.smartloop.ai) balance, top-ups, the current box, daily spend and GPU prices (from `gpushed-api.smartloop.ai`) |
| Settings | `/settings/tokens`, `/settings/websearch`, `/settings/billing` | Access tokens, web search, plan, credits and invoices |
| Plans and payment | `/plans`, `/pricing`, `/upgrade`, `/payment/*` | Upgrade and Stripe Checkout return pages |
| Account | `/profile` | Name, email and password |

## Quick start

You need Node.js 20 or later.

```sh
git clone https://github.com/smartloop-ai/app.smartloop.ai.git
cd app.smartloop.ai
npm ci
make run
```

`make run` starts a dev server at http://localhost:3000 against the production
API, so you can sign in with your own Smartloop account. To point it at an API
running on your machine, start it with `make supabase-dev` in slp-api (it seeds
`dev@smartloop.local` and `admin@smartloop.local`, password `SmartloopDev1#`)
and use `make run-local`, or set `SLP_BASE_URL` yourself:

```sh
SLP_BASE_URL=http://127.0.0.1:55321/functions/v1/api npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with live reload |
| `npm run build` | Static export into `out/` |
| `npm run serve` | Serves `out/` the way GitHub Pages will |
| `npm run typecheck` | TypeScript check |
| `npm run models:coverage` | Lists catalogue models with no published benchmark figure |

## Configuration

Settings are read at build time and baked into the bundle
(`next.config.mjs`). Put them in `.env.local` or pass them on the command line.

| Variable | Default | What it sets |
|---|---|---|
| `SLP_BASE_URL` | `https://api.smartloop.ai` | Base URL of the Smartloop API (`/v1` and `/ws` are added) |
| `ALLOW_HASH_LOGIN` | `false` | Allows signing in with a token passed in the URL hash |

There are no secrets in this app. Anything it needs at runtime comes from the
API after you sign in.

## What's where

```
src/app/              One folder per route (Next.js App Router), each with a page.tsx
  components/         Shared UI: app shell, header, charts, sign-in buttons
  settings/sections/  The settings panels: tokens, web search, billing, credits
  services/           API client for users and sessions
  hooks/useAuth.ts    Session handling
  constants.js        API endpoints and shared copy
  models/             Model catalogue page and published-scores.json
public/               Copied as-is to the site root (images, fonts, CNAME)
scripts/              Maintenance scripts (model benchmark coverage)
```

Every route is exported as static HTML (`output: 'export'` with trailing
slashes), so `/login` is served from `out/login/index.html`. There are no
dynamic route segments; anything that varies per request, such as an OAuth
`code` or a `client_id`, is read from the query string in the browser.

## Deployment

Merging to `main` publishes the app to GitHub Pages
(`.github/workflows/deploy-pages.yml`); there's nothing to deploy by hand. Pull
requests are checked by CI first (type check and build). DNS for
`app.smartloop.ai` is on Cloudflare.

## Contributing

Issues and pull requests are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers
the workflow and the checks a PR has to pass. For a problem with Studio or
Docent rather than this console, use the
[Docent repo](https://github.com/smartloop-ai/docent/issues).

## License

[MIT](LICENSE). The license doesn't grant rights to Smartloop's names, logos
or other trademarks.
