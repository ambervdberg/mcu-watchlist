# Marvel Chronological Watchlist

Public Marvel chronological watchlist with passwordless email sign-in for personal progress.

### Live: <https://mcu-watchlist.codequest.nl>

## Structure

```text
apps/web/       Astro frontend (Svelte islands)
apps/api/       Azure Functions v4 TypeScript API
infra/          Azure Bicep infrastructure
azure.yaml      azd service and deployment hook config
```

## Setup

Requires Node 22 (pinned via `volta`, see root `package.json`).

```sh
npm run install:web
npm run install:api
cp apps/api/local.settings.json.example apps/api/local.settings.json
```

Fill in `apps/api/local.settings.json` (gitignored, never commit it):

| Key | Purpose |
|---|---|
| `SESSION_SECRET` | HMAC key signing the session cookie. Any random string. |
| `OMDB_API_KEY` | Title/episode metadata. Free key at https://www.omdbapi.com/apikey.aspx |
| `STORAGE_CONNECTION_STRING` | Azure Table Storage connection string (real account, or Azurite for local-only). |
| `RESEND_API_KEY` | Sends magic-link sign-in emails. Free key at https://resend.com/api-keys |
| `EMAIL_FROM` | Must be a Resend-verified sender address. |
| `APP_BASE_URL` | Used to build magic-link URLs; `http://localhost:4280` for local dev. |
| `TITLE_INFO_TABLE_NAME` | Table name for cached title info, e.g. `TitleInfo`. |
| `FUNCTIONS_WORKER_RUNTIME` | Always `node`. |

## Commands

```sh
npm run install:web    # npm install inside apps/web
npm run install:api    # npm install inside apps/api
npm run build:web      # Astro static build
npm run build:api      # tsc build of the API
npm run dev            # build both, then swa start (frontend + API together)
npm run start:local    # swa start only, against the already-built API
npm run azd:up         # azd up (provision + deploy)
npm run azd:deploy     # azd deploy
```

`npm run dev` builds both apps, then starts Azure Static Web Apps CLI against `apps/web/build` and `apps/api`.

## Tests

```sh
cd apps/api && npm test        # tsc, then node --test against the compiled test files
cd apps/web && npm test        # vitest unit tests, then playwright e2e
cd apps/web && npm run lint    # prettier --check + eslint
cd apps/web && npm run check   # astro check type checking
```

## Contributing

PRs welcome. By submitting one, you agree your contribution is licensed under the same terms as the rest of the project (see below).

## License

[PolyForm Noncommercial 1.0.0](./LICENSE). Free to use, modify, and contribute to for any noncommercial purpose. Commercial use (including selling the app or a derivative of it) is not permitted.
