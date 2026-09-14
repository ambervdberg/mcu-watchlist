# CLAUDE.md

Guidance for Claude Code in this repo.

 @.claude.local.md

## What this is

A public Marvel (MCU) chronological watchlist, hosted on Azure Static Web Apps. Catalog browsing (browse/search/filter, title and episode detail) is open to anonymous visitors. Anyone can create an account with just an email (passwordless, magic-link) to save watched/skipped progress.

Catalog scope is the undisputed MCU timeline. Marvel Animation's separate-universe shows (X-Men '97, Your Friendly Neighborhood Spider-Man) stay out.

## Commands

```powershell
npm run install:api    # npm install inside apps/api
npm run build:api      # tsc build of the API (apps/api -> apps/api/dist)
npm run install:web    # npm install inside apps/web
npm run build:web      # Astro static build (apps/web -> apps/web/build)
npm run dev             # build:api + build:web, then swa start (local frontend + API together)
npm run dev:web         # astro dev only (frontend, no API), the one that honours PUBLIC_FAKE_LOGIN
npm run start:local     # swa start only, against the already-built API
npm run azd:up         # azd up (provision + deploy)
npm run azd:deploy     # azd deploy
npm run media-cache:missing    # fetch OMDb/TMDB metadata for catalog titles missing from titleInfo.snapshot.json
npm run media-cache:stale      # re-fetch snapshot entries older than 7 days
npm run media-cache:typecheck  # tsc --checkJs over the scripts/media-cache*.mjs files
npm run update-snapshot        # re-fetch all titles, then build, so both snapshot files are current
```

`media-cache:missing`/`media-cache:stale` only write to `apps/web/.media-cache`. Run `npm run build:web` after, that step writes `titleInfo.snapshot.json`.

To add a movie or show: add it to `apps/web/src/lib/data/items.ts` with its IMDb id, run `npm run update-snapshot`, commit the snapshot files with it.

The frontend is an Astro app (Svelte islands) in `apps/web`, building to `apps/web/build`.

API tests: `cd apps/api && npm test` (tsc, then `node --test` against `auth.test.js`, `userAuth.test.js`, `authHandlers.test.js`, `progressStore.test.js`).

Web tests: `cd apps/web && npm run test:unit` (vitest, domain/state/api-gateway). `npm test` adds `playwright test`. `npm run lint` runs prettier + eslint. `npm run check` runs `astro check`.

## Architecture

```
apps/web/                                  Astro frontend (Svelte islands), builds to apps/web/build
apps/web/static/staticwebapp.config.json   SWA routing/platform config (node:20 API runtime, 404 page)
apps/api/                                  Azure Functions v4 (TypeScript) managed API, deployed with the SWA
apps/api/src/functions/                    route registration + handlers, one file per HTTP function
apps/api/src/auth/                         session cookie, magic-link, user/token stores, email sender, rate limiter
apps/api/src/progress/                     WatchProgress table store
apps/web/src/lib/data/mediaMetadata/       Astro Content Layer loaders: OMDb/TMDB fetch baked into the build, with a committed JSON snapshot fallback
scripts/media-cache*.mjs                   Standalone CLI to pre-fetch/refresh titleInfo.snapshot.json outside a build, core logic in media-cache-core.mjs, tested by media-cache-script.test.ts
apps/api/src/shared/                       cross-cutting helpers (http, tableStorage)
infra/main.bicep                           Storage account + Tables + Static Web App + app settings
azure.yaml                                 azd service/hook config
```

**Frontend** (`apps/web`, `output: 'static'`, fully prerendered, no SSR server in production)
- Pages live under `apps/web/src/pages/` (`index.astro`, `title/[id].astro` via `getStaticPaths()`), wrapped in `apps/web/src/layouts/BaseLayout.astro`.
- Catalog data is typed in `apps/web/src/lib/data/items.ts`.
- Domain/API layers under `apps/web/src/lib` are framework-agnostic.
- State (`apps/web/src/lib/state/{session,progress,filters}.ts`) is nanostores: each module exports a factory plus a module-level singleton wired to the real gateway. Tests use the factory with `lib/api/fakes.ts`. Production code imports the singleton directly.
- Timeline and detail UI are Svelte islands (`client:load`, or `client:visible` for the heaviest below-the-fold one). Each island imports the shared singletons directly, no provider/context layer needed.
- Never pass a store singleton as an Astro island **prop**. Astro serializes island props through JSON and drops functions, so the store's methods arrive `null` on the client. Import the singleton inside the island instead.
- **Fake logged-in state for local debugging**: set `PUBLIC_FAKE_LOGIN=true` in an untracked `apps/web/.env`, run `npm run dev:web` from the root (`astro dev`). `npm run dev` does a production build, where `DEV` is false, so fake login stays off there. The session/progress singletons swap in `lib/api/fakes.ts`'s in-memory gateways, pre-seeded signed-in. Only active when Astro's `DEV` flag is true, never in a production build. Real auth needs HTTPS (see the cookie note below), so this is the only way to see logged-in UI without deploying.

**Auth** (app-owned, passwordless email magic-link, no password anywhere)
- Catalog browsing and title/episode metadata are anonymous and don't touch the API. Only progress requires sign-in.
- `POST /api/auth/request-link` (`apps/api/src/auth/userAuth.ts`) gets-or-creates a `Users` row, stores a hashed one-time token in `LoginTokens`, emails the link via `auth/emailSender.ts` (Resend).
- `GET /api/auth/consume-link` verifies and burns the token, then sets the signed `marvel_user_session` cookie (`apps/api/src/auth/auth.ts`): `HttpOnly`/`Secure`/`SameSite=Strict`, payload `{userId, iat, exp}` base64url-encoded, HMAC-SHA256-signed with `SESSION_SECRET`, verified with `timingSafeEqual`.
- The cookie is `Secure`, so auth only works over HTTPS. Test it against the deployed SWA URL, not local HTTP.
- `POST /api/login` is a stub, always returns `410`.

**Progress** (`apps/api/src/progress/progressStore.ts`): one row per user in `WatchProgress` (`PartitionKey: userId`, `RowKey: marvel-mcu`), `watchedIds`/`skippedIds`/`watchedDates`/`watchedEpisodes` as JSON strings. No shared/household row.

**Title detail & episodes** (baked at build time, no runtime API)
- `apps/web/src/lib/data/mediaMetadata/titleInfoLoader.ts` (an Astro Content Layer loader, registered in `content.config.ts`) fetches OMDb plot/rating/poster/runtime plus a trailer picked from TMDB's videos endpoint (scored by season-name match and "official trailer" keywords), via `titleInfoFetch.ts`. `tmdb/tmdbId.ts` resolves the catalog item's IMDb id to a TMDB id first.
- A sibling loader (`episodeInfoLoader.ts`) bakes per-season episode lists from TMDB, via `episodeInfoFetch.ts`.
- Per-item upstream failures (missing `OMDB_API_KEY`/`TMDB_API_KEY`, network error, rate limit) never fail the build: `snapshot.ts`'s `withSnapshotFallback` falls back to the committed `titleInfo.snapshot.json`/`episodeInfo.snapshot.json`. A successful fetch updates that snapshot for the next commit.
- Merge rule: a fetch never overwrites real prior snapshot data, it only fills a gap the prior entry never had a real value for. Exceptions are `released` and `imdbRating` (title and episode level), which take the live value whenever it is real, since those change over time. See `mergeTitleInfoWithPrior` in `titleInfoFetch.ts`.
- `title/[id].astro` and the `TitleDetail` island read this baked data as static props. No client-side fetch, no `/api/title-info` or `/api/episodes`.
- `npm run check` (`astro check`) also runs these loaders and can write `titleInfo.snapshot.json`/`episodeInfo.snapshot.json` to disk, even for a type check alone.

**API functions** (`apps/api/src/functions/`): `auth/request-link`, `auth/consume-link`, `login` (410 stub), `logout`, `me`, `progress` (`GET`/`PUT`). Each checks auth itself. Azure Functions v4's `app.http` model has no shared middleware.

**Infra** (`infra/main.bicep`)
- Deploys into the pre-existing resource group `rg-marvel`. Never create/delete this RG from automation.
- Table Storage (not Cosmos DB), tables `WatchProgress`, `Users`, `LoginTokens`.
- App settings via `Microsoft.Web/staticSites/config`, never in frontend JS: `APP_BASE_URL`, `EMAIL_FROM`, `RESEND_API_KEY`, `SESSION_SECRET`, `STORAGE_CONNECTION_STRING`, `TABLE_NAME`, `APPLICATIONINSIGHTS_CONNECTION_STRING`.
- `sessionSecret` and `resendApiKey` are required secure Bicep parameters. Set with `azd env set SESSION_SECRET <value>` and `azd env set RESEND_API_KEY <value>` before `azd up`/`azd deploy`, or provisioning fails.
- `appBaseUrl`/`APP_BASE_URL` is set to `https://mcu.watch` via `azd env set APP_BASE_URL`. Empty falls back to the auto-generated `*.azurestaticapps.net` hostname. The custom domain itself is attached outside Bicep.
- `OMDB_API_KEY` and `TMDB_API_KEY` are build-time secrets, not SWA app settings. Read via `process.env.OMDB_API_KEY` in `titleInfoFetch.ts` and `getTmdbApiKey()` in `tmdb/tmdbKey.ts` during `astro build`. Locally, export both or put them in an untracked `apps/web/.env`. For `azd up`/`azd deploy`, run `azd env set OMDB_API_KEY <value>` and `azd env set TMDB_API_KEY <value>` first. Missing either key just falls back to the committed snapshot, doesn't fail the build or deploy.

## A real azd gotcha in azure.yaml

`azd`'s `staticwebapp` host doesn't run an Oryx build for the managed API and doesn't pass `--api-language`/`--api-version` to the SWA CLI deploy. Without those, the SWA backend can't detect the Functions runtime and silently deploys zero functions. `/api/*` then returns the 404 page instead of JSON, with no error from `azd up`/`azd deploy`.

The root `postdeploy` hook in `azure.yaml` works around this: after `azd`'s deploy, it redeploys `apps/web/build` via `npx @azure/static-web-apps-cli deploy`, passing `--api-language node --api-version 20` explicitly. Don't remove this hook without re-checking that `/api/me` returns JSON, not HTML, after a deploy.

If `/api/*` returns HTML again, check `az rest --method get --uri ".../staticSites/<name>/builds/default/functions?api-version=2023-01-01"`. An empty `value` array means zero registered functions, this bug again.

## Monitoring

`infra/main.bicep` provisions Application Insights (`appInsights` + `logAnalyticsWorkspace`), wired to the API via `APPLICATIONINSIGHTS_CONNECTION_STRING`. Server-side only, no client-side snippet, no cookies, no visitor identity, so no consent banner. `DisableIpMasking` stays `false`, client IPs stay anonymized.

Two queries in Application Insights (Portal → `appi-marvel-*` → Logs):
- App usage: `AppRequests | where Name == "me"`. The frontend calls this on every page load regardless of auth state, a proxy for total visits.
- Resend email volume: `AppTraces | where Message == "resend:email_sent"` (and `"resend:email_failed"`). Logged in `emailSender.ts` without the recipient address.

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
