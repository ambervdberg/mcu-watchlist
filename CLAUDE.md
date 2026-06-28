# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

 @.claude.local.md

## What this is

A public Marvel (MCU) chronological watchlist, hosted on Azure Static Web Apps. The catalog (browse/search/filter, title and episode detail) is open to anonymous visitors. Anyone can create a personal account with just an email address (passwordless, magic-link) to save their own watched/skipped progress.

## Commands

```powershell
npm run install:api    # npm install inside apps/api
npm run build:api      # tsc build of the API (apps/api -> apps/api/dist)
npm run install:web    # npm install inside apps/web
npm run build:web      # Astro static build (apps/web -> apps/web/build)
npm run dev             # build:api + build:web, then swa start (local frontend + API together)
npm run start:local     # swa start only, against the already-built API
npm run azd:up         # azd up (provision + deploy)
npm run azd:deploy     # azd deploy
npm run media-cache:missing    # fetch OMDb/imdbapi metadata only for catalog titles absent from titleInfo.snapshot.json
npm run media-cache:stale      # re-fetch snapshot entries older than 7 days
npm run media-cache:typecheck  # tsc --checkJs over the scripts/media-cache*.mjs files
```

The frontend is an Astro app (Svelte islands) in `apps/web`. Its deployable output is `apps/web/build`.

The API has real tests: `cd apps/api && npm test` runs `tsc` then `node --test` against the compiled `auth.test.js`, `userAuth.test.js`, `authHandlers.test.js`, and `progressStore.test.js`.

The frontend also has real tests: `cd apps/web && npm run test:unit` runs vitest against the domain/state/api-gateway test files; `cd apps/web && npm test` runs that plus `playwright test` (installs browsers first). `cd apps/web && npm run lint` runs `prettier --check` + `eslint`; `cd apps/web && npm run check` runs `astro check` type checking.

## Architecture

```
apps/web/                                  Astro frontend (Svelte islands); build output goes to apps/web/build
apps/web/static/staticwebapp.config.json   SWA routing/platform config (node:20 API runtime, fallback)
apps/api/                                  Azure Functions v4 (TypeScript) managed API, deployed alongside the SWA
apps/api/src/functions/                    route registration + handlers, one file per HTTP function
apps/api/src/auth/                         session cookie, magic-link, user/token stores, email sender, rate limiter
apps/api/src/progress/                     WatchProgress table store
apps/web/src/lib/data/mediaMetadata/       Astro Content Layer loaders: OMDb/imdbapi.dev fetch baked into the build, with a committed JSON snapshot fallback
scripts/media-cache*.mjs                   Standalone offline CLI to pre-fetch/refresh titleInfo.snapshot.json outside a build (missing/stale modes); core logic in media-cache-core.mjs, tested by media-cache-script.test.ts
apps/api/src/shared/                       cross-cutting helpers (http, tableStorage)
infra/main.bicep                           Storage account + Tables + Static Web App + app settings
azure.yaml                                 azd service/hook config
```

**Frontend** — `apps/web` is an Astro app (`output: 'static'`, fully prerendered at build time, no SSR server in production).
- Pages live under `apps/web/src/pages/` (`index.astro`, `title/[id].astro` via `getStaticPaths()`), both wrapped in `apps/web/src/layouts/BaseLayout.astro`.
- Catalog data is typed in `apps/web/src/lib/data/items.ts`.
- Domain/API layers under `apps/web/src/lib` are framework-agnostic and unaffected by the page/component layer.
- State (`apps/web/src/lib/state/{session,progress,filters}.ts`) is nanostores: each module exports a factory (e.g. `createSessionStore`) plus a module-level singleton wired to the real gateway. Tests use the factory with `lib/api/fakes.ts`; production code imports the singleton directly.
- Timeline and detail UI are Svelte components mounted as islands (`client:load`, or `client:visible` for the heaviest below-the-fold island) on otherwise-static pages. Each island reads the shared singletons directly (`import { sessionStore } from '$lib/state/session'`, native `$store` syntax) — there is no provider/context layer, since nanostores satisfy Svelte's store contract on their own.
- Don't pass a store singleton as an Astro component **prop** into an island — Astro serializes island props through JSON, which silently drops functions, so a store's methods arrive as `null` on the client. Import the singleton inside the island component instead.
- **Fake logged-in state for local debugging**: set `PUBLIC_FAKE_LOGIN=true` in an untracked `apps/web/.env` and run `npm run dev` (Astro's own dev server, `astro dev`). The session/progress singletons (`lib/state/session.ts`, `lib/state/progress.ts`) then swap in `lib/api/fakes.ts`'s in-memory gateways, pre-seeded as signed-in, instead of the real HTTP gateways. Only takes effect when Astro's `DEV` flag is also true, so it can never leak into a production build. Real auth needs the `Secure` cookie below, which only works over HTTPS against a deployed SWA, this is the only way to see the logged-in UI without deploying.

**Auth model** — app-owned, per-user, passwordless email magic-link auth, no password anywhere.
- Catalog browsing and title/episode metadata are anonymous-accessible (and don't touch the API at all, see "Title detail & episode tracking" below); only watched/skipped/episode progress requires sign-in.
- `POST /api/auth/request-link` (`apps/api/src/auth/userAuth.ts`) gets-or-creates a `Users` row for the email, stores a one-time hashed token in `LoginTokens`, and emails the raw link via `auth/emailSender.ts` (Resend).
- `GET /api/auth/consume-link` verifies and burns the token, then sets the signed `marvel_user_session` cookie (see `apps/api/src/auth/auth.ts`): `HttpOnly`/`Secure`/`SameSite=Strict`, payload `{userId, iat, exp}` base64url-encoded and HMAC-SHA256-signed with `SESSION_SECRET`, verified with `timingSafeEqual`.
- Because the cookie is `Secure`, the full auth flow only works correctly over HTTPS, test it against the deployed SWA URL, not over plain local HTTP.
- `POST /api/login` (the old password endpoint) is kept only as a stub that always returns `410`.

**Progress storage** (`apps/api/src/progress/progressStore.ts`) — one row per user in the `WatchProgress` table (`PartitionKey: userId`, `RowKey: marvel-mcu`), storing `watchedIds`/`skippedIds`/`watchedDates`/`watchedEpisodes` as JSON strings. No shared/household row, every account's progress is isolated.

**Title detail & episode tracking** — baked at build time, not served by any runtime API.
- `apps/web/src/lib/data/mediaMetadata/titleInfoLoader.ts` is an Astro Content Layer loader (registered in `apps/web/src/content.config.ts`) that, for every catalog item in `items.ts`, fetches OMDb plot/rating/poster/runtime plus a trailer picked from imdbapi.dev's videos endpoint (scored by season-name match and "official trailer" keywords), via `titleInfoFetch.ts` (a straight port of the old `apps/api/src/media/titleInfoFetcher.ts`).
- A sibling loader bakes per-season episode lists from imdbapi.dev the same way.
- Per-item upstream failures (missing `OMDB_API_KEY`, network error, rate limit) never fail the build: `snapshot.ts`'s `withSnapshotFallback` falls back to the committed `titleInfo.snapshot.json`, and a successful fetch updates that snapshot on disk for the next commit.
- Pages (`title/[id].astro`) and the `TitleDetail` island read this baked data as static props; there is no client-side fetch and no `/api/title-info` or `/api/episodes` endpoint anymore.

**API functions** (`apps/api/src/functions/`) — `auth/request-link`, `auth/consume-link`, `login` (410 stub), `logout`, `me`, `progress` (`GET`/`PUT`). Each checks auth itself (via `requireAuthenticatedUser`/`isAuthenticated`) rather than relying on shared middleware, Azure Functions v4's `app.http` model doesn't have one.

**Infra** (`infra/main.bicep`)
- Deploys into the **pre-existing** resource group `rg-marvel` (never create/delete this RG from automation).
- Storage account + Table Storage (not Cosmos DB, explicit constraint from the handoff), with tables `WatchProgress`, `Users`, `LoginTokens`.
- App settings pushed via `Microsoft.Web/staticSites/config`, never embedded in frontend JS: `APP_BASE_URL`, `EMAIL_FROM`, `RESEND_API_KEY`, `SESSION_SECRET`, `STORAGE_CONNECTION_STRING`, `TABLE_NAME`, `APPLICATIONINSIGHTS_CONNECTION_STRING`.
- `sessionSecret` and `resendApiKey` are required, non-defaulted secure Bicep parameters, set each with `azd env set <NAME> <value>` (`SESSION_SECRET`, `RESEND_API_KEY`) before `azd up`/`azd deploy`, or provisioning will fail.
- `appBaseUrl`/`APP_BASE_URL` is optional and only needed for a custom domain, it falls back to the auto-generated `*.azurestaticapps.net` hostname (used to build magic-link URLs).
- `OMDB_API_KEY` is **not** a SWA app setting anymore (it was, back when `/api/title-info` fetched at runtime). It's a **build-time** secret read by `apps/web/src/lib/data/mediaMetadata/titleInfoFetch.ts` via `process.env.OMDB_API_KEY` while `astro build` runs. Locally, export it in the shell (or put it in an untracked `apps/web/.env`) before `npm run build:web`. For `azd up`/`azd deploy`, run `azd env set OMDB_API_KEY <value>` first, `azd` injects its env values into the `web` service's build step, so the key reaches the Astro build that produces `apps/web/build`. Missing key just means loader falls back to the committed snapshot (see above), it doesn't fail the build or deploy.

## A real `azd` gotcha baked into `azure.yaml`

`azd`'s `staticwebapp` host does **not** run an Oryx build for the managed API and doesn't pass `--api-language`/`--api-version` to the underlying SWA CLI deploy. Without those, the SWA backend can't detect the Functions runtime language and silently deploys **zero functions** — `/api/*` then falls through `navigationFallback` to `index.html` instead of returning JSON, with no error surfaced by `azd up`/`azd deploy`.

The root-level `postdeploy` hook in `azure.yaml` works around this: after `azd`'s own (incomplete) deploy, it re-deploys `apps/web/build` via `npx @azure/static-web-apps-cli deploy` directly, passing `--api-language node --api-version 20` explicitly. Don't remove this hook without re-verifying `/api/me` returns JSON (not HTML) after a deploy — that's the regression signal if this gap ever resurfaces or gets fixed upstream.

If `/api/*` ever starts returning HTML again, check `az rest --method get --uri ".../staticSites/<name>/builds/default/functions?api-version=2023-01-01"` — an empty `value` array means the managed Functions backend has zero registered functions, which is exactly this bug.

## Monitoring

`infra/main.bicep` provisions a workspace-based Application Insights resource (`appInsights` + `logAnalyticsWorkspace`) wired to the API via the `APPLICATIONINSIGHTS_CONNECTION_STRING` app setting. This is server-side only — no client-side snippet runs in the browser, so it sets no cookies and collects no visitor identity, which is why there's no consent banner or privacy policy tied to it. `DisableIpMasking` is left `false` so client IPs stay anonymized (last octet zeroed) the same way the rest of the app avoids storing PII.

Two things to check in Application Insights (Azure Portal → the `appi-marvel-*` resource → Logs):
- **App usage**: `AppRequests | where Name == "me"` — the frontend calls this on every page load regardless of auth state, so its count is a good proxy for total visits.
- **Resend email volume**: `AppTraces | where Message  == "resend:email_sent"` (and `"resend:email_failed"` for failures) — these are explicit log lines in `emailSender.ts`, logged without the recipient address, so they reflect Resend usage independently of how many sign-in attempts failed before ever calling Resend (e.g. invalid email).

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
