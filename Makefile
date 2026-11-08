# The app is a static Next.js export served from GitHub Pages; merges to main
# deploy it (.github/workflows/deploy-pages.yml). Everything dynamic lives on
# the Smartloop API (api.smartloop.ai).

OUT_DIR=out

# Install dependencies
install:
	npm ci

# Dev server against the production API
run:
	SLP_BASE_URL=https://api.smartloop.ai npm run dev

# Dev server against the API running locally: slp-api's `make supabase-dev`
run-local:
	SLP_BASE_URL=http://127.0.0.1:55321/functions/v1/api npm run dev

# Build the static export into ./out
build:
	SLP_BASE_URL=https://api.smartloop.ai npm run build

# Serve ./out locally, the way Pages will
serve: build
	npm run serve

.PHONY: install run run-local build serve
