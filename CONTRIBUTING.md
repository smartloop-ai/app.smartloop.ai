# Contributing

Thanks for helping improve the Smartloop console at app.smartloop.ai.

By contributing, you agree that your changes are licensed under the
[MIT License](LICENSE), the same as the rest of the repo.

## Before you start

**Open an issue first** for a new page, a new setting or a change to how
sign-in or billing works, so we can agree on the shape before you spend time
on it. Typos and small fixes can go straight to a pull request.

## Workflow

1. **Fork and branch.** Branch from `main` with a short descriptive name, for
   example `tokens-copy-button`.
2. **Run it locally.** `npm ci && make run`, then sign in with your Smartloop
   account at http://localhost:3000. Check your change in light and dark mode
   and at phone width.
3. **Check before pushing.** `npm run typecheck` catches type errors and
   `npm run build` catches anything that breaks the static export. CI runs
   both on every pull request.
4. **Open a pull request** against `main`. Say what changed and why, and add a
   screenshot for anything visual. Once it's merged, it deploys on its own.

## Things to keep in mind

- **It's a static export.** No API routes, server actions, middleware or
  dynamic route segments: `npm run build` fails if a page needs a server. Read
  per-request values from the query string in the browser.
- **The API is the source of truth.** Plans, prices and limits come from the
  API or link to [smartloop.ai/pricing](https://smartloop.ai/pricing); don't
  hard-code a second copy.
- **No secrets.** Everything in the bundle is public. Never add API keys or
  tokens to the code or to build variables.
- **Name UI elements consistently.** One term for one thing: an *access
  token*, a *credit*, a *project*.

## Commits

Write commit messages that say what the change does, in the imperative:
"Add a copy button to access tokens", not "updates". One logical change per
pull request makes review faster.

## Security

Please don't open a public issue for a security problem. Email
support@smartloop.ai instead.
