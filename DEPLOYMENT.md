# Deploy OrthoReminder to Railway (solo, low-cost, secure)

## Context

You want to deploy OrthoReminder so you can use it from your phone, with auto-deploys,
at the lowest reasonable cost. It stores **patient PII**, so even as a single-user app it
must be treated as sensitive and locked down on the public internet.

**Viability verdict: Yes, deploy it largely as-is.** The codebase is already well-hardened
for production — this is unusually good for a personal project:

- Global `JwtAuthGuard` (every route authenticated by default; opt out via `@Public()`)
- Global rate limiting (`ThrottlerGuard`, 120/min; login tightened to 5/min)
- `helmet`, env-driven CORS allowlist (enforced in production via `env.validation.ts`)
- `ValidationPipe({ whitelist: true })` → strips unknown fields (mass-assignment safe)
- bcrypt rounds = 12; `httpOnly` + `secure` (prod) + `sameSite=lax` auth cookie
- Patient images/avatars stored **privately** in Cloudflare R2, served via short-lived
  signed URLs (no public static file serving)
- Fail-fast env validation (refuses to boot without `JWT_SECRET` ≥ 32 chars, R2 creds, etc.)
- No public self-registration; first admin created by `prisma/seed.ts`
- `.env` is gitignored and not tracked; 15 Prisma migrations are committed

**Chosen stack:** Railway (managed Postgres + API + Web, git-push auto-deploy, ~$5/mo) with
your domain + **Cloudflare Access** in front of the web app for an identity gate.

**Target architecture** (only the web service is public):

```
Phone / Browser
   │  https://app.yourdomain.com
Cloudflare (DNS + Access: only your email gets in)
   │
Railway: web (Next.js, public)  ──private network──▶  Railway: api (NestJS, PRIVATE)
                                                          │
                                                      Railway: Postgres (managed)
                                                          │
                                                   Cloudflare R2 (images)
```

The API has **no public URL** — it's reachable only from the web service over Railway's
private network. The browser never calls the API cross-origin, so there's a minimal attack
surface and no CORS headaches.

---

## Step 0 — One required code change before deploying

`api/src/main.ts:57` hard-codes `await app.listen(3001)`. Railway injects a `PORT` and
private networking needs IPv6 binding. Change it to:

```ts
await app.listen(process.env.PORT ?? 3001, '::');
```

`'::'` binds dual-stack (IPv4 + IPv6) so it works for both Railway private networking and
local dev. This is the **only** code change needed. Commit and push.

(Optional quality-of-life, not required: JWT expiry is 60 min with no refresh token
(`api/src/auth/auth.module.ts:13` + cookie `maxAge` in `auth.controller.ts:34`), so you
re-login hourly. Acceptable for solo use; bump both to e.g. `8h` only if it annoys you.)

---

## Step 1 — Railway project + Postgres

1. Create a Railway account (GitHub login), then **New Project → Deploy from GitHub repo**,
   select this repo.
2. In the project, **New → Database → PostgreSQL**. Railway provisions it and exposes a
   `DATABASE_URL` you'll reference from the API service.

## Step 2 — API service (private)

Add a service from the repo and configure (Settings):

- **Root Directory:** `api`
- **Build Command:** `pnpm prisma generate && pnpm run build`
- **Pre-Deploy Command:** `pnpm prisma migrate deploy`  *(runs migrations on every deploy)*
- **Start Command:** `pnpm run start:prod`
- **Networking:** do **not** generate a public domain — keep it private.

Railway auto-detects pnpm via Nixpacks. The committed `api/pnpm-workspace.yaml`
(`onlyBuiltDependencies`) already whitelists Prisma's build scripts, so `prisma generate`
works under pnpm.

**API environment variables:**

| Var | Value |
|-----|-------|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference) |
| `JWT_SECRET` | generate: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"` |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://app.yourdomain.com` |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | from your existing Cloudflare R2 bucket |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`, `BOOTSTRAP_ADMIN_NAME` | **strong** unique password — this is your prod login |
| *(optional)* `TWILIO_*`, `WHATSAPP_*`, `RESEND_API_KEY`/`EMAIL_FROM`, `TODOIST_API_TOKEN`, `DENTALINK_*` | only if you use those integrations |

Use **fresh** secrets for prod (new `JWT_SECRET`, new admin password) — don't reuse your
local `api/.env` values.

## Step 3 — Web service (public)

Add a second service from the same repo:

- **Root Directory:** `web`
- **Build Command:** `pnpm run build`
- **Start Command:** `pnpm run start`  *(Next binds `$PORT` automatically)*
- **Networking:** generate a public domain (you'll attach your custom domain in Step 5).

**Web environment variables** (point at the API over the private network — see
`web/next.config.ts` and `web/src/lib/utils.ts`):

| Var | Value |
|-----|-------|
| `API_INTERNAL_URL` | `http://${{api.RAILWAY_PRIVATE_DOMAIN}}:${{api.PORT}}` |
| `NEXT_PUBLIC_API_URL` | same as above (used only for SSR server-side calls) |

The browser calls same-origin `/api/*`; `next.config.ts` rewrites that to `API_INTERNAL_URL`
server-side, forwarding the auth cookie. No cross-origin requests, so CORS just needs
`ALLOWED_ORIGINS` set as above.

## Step 4 — Seed the first admin (one-time)

After the first successful API deploy, run the seed once to create your login. Easiest:
install the Railway CLI locally, then:

```
railway run --service api pnpm prisma db seed
```

(or use the API service's shell in the Railway dashboard). It reads `BOOTSTRAP_ADMIN_*`.

## Step 5 — Domain + Cloudflare Access (the security gate)

1. **Custom domain:** in the web service → Settings → Domains, add `app.yourdomain.com`.
   Railway shows a CNAME target; add that CNAME in Cloudflare DNS (proxied / orange cloud).
   TLS is automatic.
2. **Cloudflare Access** (Zero Trust → Access → Applications → Add a self-hosted app):
   - Domain: `app.yourdomain.com`
   - Policy: **Allow**, rule = *Emails* → your email (or Google login).
   - Now only you can even load the site; the public never reaches the login page. Your app's
     JWT login still applies underneath. Free on your Cloudflare plan; works on the phone
     (you authenticate to Cloudflare once, then use the app normally).

> **Caveat — inbound WhatsApp webhooks:** because the API is private and Access guards the
> web app, Meta/Twilio **inbound** webhooks can't reach you. Outbound reminders (the main
> use case) still work fine. If you later need inbound webhooks, expose just that route via a
> dedicated public path with an Access *bypass* policy + the existing `WHATSAPP_VERIFY_TOKEN`.

## Step 6 — Auto-deploy

Railway's GitHub integration redeploys on every push to `main` by default. In each service's
Settings, set **Watch Paths** (`api/**` for the API, `web/**` for the web) so a change to one
doesn't needlessly rebuild the other.

---

## Backups (do this — it's patient data)

Railway Postgres has plugin-level backups; enable them in the Postgres service. For an
off-platform copy, optionally add a scheduled `pg_dump` to your R2 bucket later. At minimum,
confirm Railway backups are on before entering real patient data.

## Verification (end-to-end)

1. **API health (private):** from the web service shell, `curl http://${API_INTERNAL_URL}/health`
   → `{"status":"ok","db":"up"}`. Confirms API up + DB reachable + migrations applied.
2. **Access gate:** open `https://app.yourdomain.com` in a logged-out/incognito browser →
   you should hit the Cloudflare Access login first, not the app.
3. **App login:** authenticate through Access, then log in with `BOOTSTRAP_ADMIN_EMAIL` /
   password. Confirm the auth cookie is set and `/api/auth/profile` returns your user.
4. **Core flow:** create a test patient, upload an image (verifies R2 + signed URLs), confirm
   it renders. Check aligner tracking and a patient list load.
5. **Phone:** open the domain on your phone, authenticate via Access, verify the dashboard is
   usable.
6. **Auto-deploy:** push a trivial change to `main`, confirm only the relevant service rebuilds.

## Cost summary

| Item | Cost |
|------|------|
| Railway Hobby (Web + API + Postgres, small app) | ~$5/mo (includes $5 usage credit) |
| Cloudflare DNS + Access (Zero Trust free) | $0 |
| Cloudflare R2 (existing, image storage) | ~free tier / a few ¢ |
| Domain | already owned |
| **Total** | **~$5/mo** |
