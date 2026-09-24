# Abode accounts and enquiries

The application runs entirely on Cloudflare Workers, Static Assets, D1 and R2. Better Auth 1.7.5 handles Google OAuth and database-backed sessions. Google provides customer identity; it does not host the application or its customer database.

## Configuration

Cloudflare Worker secrets (never commit values):

- `BETTER_AUTH_SECRET`: a cryptographically generated session-signing and token-encryption secret. Keep stable; replacing it signs customers out and affects encrypted OAuth tokens.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: the web client from the dedicated **Abode Ghana** Google Cloud project `bubbly-display-509620-j8`.

Worker variables in `wrangler.json`:

- `AUTH_URL`: `https://abode.eo-kingsford.workers.dev`
- `ADMIN_EMAILS`: verified Google email allowlist. Initially `eo.kingsford@gmail.com`.

Exact Google authorized redirect URI:

```text
https://abode.eo-kingsford.workers.dev/api/auth/callback/google
```

Use only basic OpenID, email and profile scopes. OAuth setup needs the account owner's acceptance of Google's User Data Policy and authorization to create the client. Google may require a custom verified domain for production brand verification. A custom-domain move must update Google origins/redirects, `AUTH_URL`, canonical/OG URLs, robots and manifest assets together.

`GET /api/auth-options` reports actual provider readiness. The sign-in UI disables Google when credentials are missing. Google sign-in creates the customer account on first use. Email/password registration remains disabled; Google handles its own password recovery. A future email login/recovery feature needs a verified sending domain and a working email service. Nothing pretends that verification emails or enquiries have been emailed.

## Data and access

- Native Better Auth D1 tables, encrypted OAuth tokens, 14-day HttpOnly secure production cookies and database rate limits.
- Guest-to-account claims are atomic and idempotent. Claimed guest cookies cannot reopen transferred data or transfer it to another account.
- Existing account selections take precedence at array limits. Cart quantities merge up to 99, duplicate plans retain the existing account version, blank contact fields may inherit guest entries.
- Staff access requires a valid session, a verified provider email and an exact allowlist match. Changing a contact email cannot grant access.
- Every saved-state, enquiry and staff mutation carries the owner returned by the authenticated server read. The server rejects stale-tab account changes with `409 IDENTITY_CHANGED`; the client clears stale data and reloads without replaying the mutation. Atomic SQL guards also reject guest writes that overlap a completed sign-in claim.
- Staff inbox: `/admin`; customer history: `/account`. Status changes use compare-and-set conflict detection and atomic audit records.
- New enquiries use `new`; older `saved-preview` records remain visible. Statuses are `new`, `in-review`, `awaiting-customer`, `quoted`, `closed`. Status changes send no emails.
- Intake validates each form, recalculates guide totals from the catalogue and limits submissions per identity and trusted Cloudflare IP. IP quota hashes rotate hourly and old quota rows expire.
- The PWA caches a fixed list of public icons and the offline fallback only. It never caches authentication, API responses or customer pages.

## Database and deployment

Apply migrations 0001–0003 before deploying this release. They add account/session tables, guest claim records, staff audit records and intake quotas without removing existing shopper state or enquiries. Migration 0001 was generated from Better Auth's native schema. The Drizzle schema and final snapshot record the combined result for future migrations.

```sh
pnpm db:migrate
pnpm build
pnpm verify
pnpm run deploy
```

Cloudflare Workers Builds deploys `main`; it does not apply D1 migrations automatically. Back up D1 privately and apply new compatible migrations before pushing a release that depends on them. Secrets stay in the existing Worker across deployments.

## Verification

Run `scripts/verify-auth.mjs` for actual native Better Auth/D1 session, OAuth-state, CSRF, rate-limit and guest-transfer tests. `scripts/verify-worker.mjs` checks the compiled Worker and catalogue. Inbox and intake have focused D1 tests. A successful Google account selection and return through the live callback still requires the configured real Google client; fixture tests alone do not prove that connection.
