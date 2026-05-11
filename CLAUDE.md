# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this site is

A single-page Jekyll static site deployed to https://skz.dev. The entire product is one hero: a translucent name card centered over a full-bleed Three.js particle field. No app, no marketing funnel, no second page. The aim is restraint — "an email link and a link to my blog, above a row of social media links" (per the README).

The blog at https://blog.skz.dev lives in a separate repo (`skzv/my-plain-blog`) and is unrelated.

## Commands

```bash
bundle install                              # one-time setup
bundle exec jekyll serve --port 3003        # local dev — auto-regenerates
JEKYLL_ENV=production bundle exec jekyll build   # production build (analytics fire)
```

Ruby 3.1 + bundler 2.6.x. The CI uses `ruby/setup-ruby@v1` with `bundler-cache: true` and builds with `JEKYLL_ENV=production`.

There are no tests, no lint step, no JS build. Editing `index.html` or `_includes/*` triggers Jekyll auto-regen; editing `_config.yml` or `_layouts/*` requires a server restart.

## Architecture

The whole page is `index.html` at the repo root. It pulls `_includes/head.html` (meta + favicon), `_includes/analytics.html` (three analytics scripts, production-gated), and the inline Three.js module that renders the particle wave.

- **Styles:** `css/main.css` is the production stylesheet — plain CSS, hand-edited. The `_sass/main.scss` + `assets/css/styles.scss` pipeline exists but contains only a stub `.current { color: green }` rule. Don't add styles there expecting them to show up on the main page; they won't unless something in `index.html` links to the compiled output.
- **Three.js loader:** `index.html` imports `three@0.128.0` as an ES module from `cdn.jsdelivr.net`. **Do not use Skypack** — their CDN returns HTTP 500 for this module. If jsDelivr ever fails, the fallback is to self-host under `assets/js/` (a commented import already references `/js/three.module.js`).
- **Analytics gating:** `_includes/analytics.html` is wrapped in `{% if jekyll.environment == "production" %}`. Local `jekyll serve` runs in `development` and skips all three scripts. To smoke-test analytics locally, build with `JEKYLL_ENV=production`.
- **Plausible URL:** uses public `plausible.io/js/plausible.js`. A prior subdomain proxy (`a-api.skz.dev`) is unconfigured in DNS — don't reintroduce it without setting up the DNS record first.

## Deploy

`.github/workflows/github-pages.yml` runs on push to `main`. It uses `ruby/setup-ruby@v1` with Ruby 3.1, builds with `JEKYLL_ENV=production`, and deploys `_site/` to the `gh-pages` branch via `peaceiris/actions-gh-pages@v4`. GitHub Pages serves `gh-pages` at https://skz.dev (the `CNAME` file pins the custom domain).

**Do not switch back to `helaili/jekyll-action@v2`** — its Docker image is stuck on Ruby 2.7.8 and can't run a bundler that understands modern nokogiri's `-linux-gnu` platform variant.

After a push, the CDN can serve stale HTML for a minute or two. Bust with a query string (`?cb=1`) when verifying.

## The design system folder

`sasha-kuznetsov-design-system/` is a vendored handoff bundle from [claude.ai/design](https://claude.ai/design) — a design system *distilled from this very repo* (tokens, voice/visual guidelines, React UI kit recreation, preview cards). It is **excluded from the Jekyll build** via `exclude:` in `_config.yml`. Read it for brand intent (especially `README.md` and `colors_and_type.css`), but the production code is the source of truth — the bundle is reference material, not a dependency.

The bundle contains a nested `_config.yml` under `project/_source/` (a snapshot of this repo). The CI workflow handles this fine because it uses `bundle exec jekyll build` which reads the root config. Don't introduce a tool that auto-discovers `_config.yml` files without scoping it.
