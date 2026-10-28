# AutoDM

Private, owner-only Instagram comment-to-DM automation with a real follow-to-unlock gate.
One Next.js app on Vercel, Turso (libSQL) for data, official Instagram API with Instagram Login only.

## What it does

- **Triggers:** a keyword comment on a specific post/Reel (or any post), a keyword DM, or a keyword story reply.
- **Matching:** `exact` (the whole message is the keyword, ignoring surrounding punctuation/emoji), `contains` (keyword appears as a whole word), or `any`. Always case-insensitive.
- **Flow for comments:**
  1. Optional public reply under the comment (random pick from your list).
  2. Private reply DM with a **“Send me the link”** button.
  3. Tap → follower check via `is_user_follow_business`:
     - following → content message + link button (plain-text link fallback),
     - not following → “Visit profile” + “I've followed” buttons; tapping rechecks,
     - unknown/API error → content is **held back**, error message + “Try again”.
- DM / story-reply triggers skip step 2 (the person already messaged you) and go straight to the check.
- `{username}` in messages becomes `@handle` (comment triggers only; DMs don't carry the handle).

## Safety rails

| Rule | How |
|---|---|
| No duplicate sends | `webhook_events.event_key` unique; partial unique indexes on `dm_logs` (one opening DM per comment, one content delivery per person per automation) |
| Fail closed | unknown follower status never releases content |
| DM rate | 180 DMs/hour per account (Meta allows ~200); private replies have their own allowance |
| Policy block (Meta error 368) | all sends pause for 24h |
| Expired token (190) | account marked expired, banner in the dashboard, automations stop |
| 24h messaging window | DM events older than 24h are not answered |
| Webhook authenticity | HMAC-SHA256 over the raw body, timing-safe compare |
| Tokens | AES-256-GCM at rest, refreshed by the daily cron when <30 days remain |
| Login | Argon2id, 5 failures / 15 min per IP + global cap, generic error, HttpOnly SameSite=Lax cookie, sessions stored hashed |

## Setup

### 1. Local

```bash
npm install
cp .env.example .env.local        # fill APP_ENCRYPTION_KEY, META_*, CRON_SECRET
npm run hash-password             # paste the printed OWNER_PASSWORD_HASH + OWNER_USERNAME into .env.local
npm run db:migrate                # creates tables and the owner (once)
# now delete OWNER_USERNAME / OWNER_PASSWORD_HASH from .env.local
npm run dev
```

Meta needs a public HTTPS URL for OAuth and webhooks; use a tunnel (`cloudflared tunnel --url http://localhost:3000`
or ngrok) and set `META_REDIRECT_URI` to `https://<tunnel>/api/instagram/callback`.

### 2. Meta app

1. developers.facebook.com → your app → **Instagram → API setup with Instagram login**.
2. Permissions: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`.
3. **Business login settings → OAuth redirect URI:** exactly `META_REDIRECT_URI`.
4. **Webhooks:** callback `https://<domain>/api/webhooks/instagram`, verify token = `META_WEBHOOK_VERIFY_TOKEN`; subscribe to `comments`, `messages`, `messaging_postbacks`.
5. In the app: **Settings → Connect Instagram**. This also subscribes your account to webhook fields (Meta sends nothing without it; use “Resubscribe webhooks” if needed).
6. Instagram app → Settings → Messages and calls → **Connected tools → allow access to messages**.

**Development mode** only delivers events from accounts with a role on the app (add a second Instagram account as
Instagram tester to test end to end). To trigger on the public, submit **App Review** for Advanced Access on the two
`manage_*` permissions with a screencast of the working flow.

### 3. Production (Vercel)

1. `turso db create autodm && turso db show autodm --url && turso db tokens create autodm`.
   Create a **separate** database for Preview so previews never touch production automations.
2. Set all env vars in Vercel per environment (Production / Preview). `META_REDIRECT_URI` = your production domain.
3. Run migrations against production once from your machine:
   `DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... OWNER_USERNAME=... OWNER_PASSWORD_HASH='...' npm run db:migrate`.
   The owner row is pinned to `id = 1`, so the setup can never create a second owner; OWNER_* never go to Vercel.
4. Deploy. `vercel.json` schedules `/api/cron` daily (token refresh, event retries, cleanup).
5. Backups: Turso keeps point-in-time restore; `turso db shell autodm .dump > backup.sql` for a manual copy.

## Scripts

- `npm test`: keyword matching, URL validation, templating, webhook signature checks.
- `npm run db:migrate`: apply `migrations/*.sql` (tracked in `_migrations`).
- `npm run hash-password`: print an Argon2id hash.

## Endpoints

| Path | Who | Purpose |
|---|---|---|
| `GET/POST /api/webhooks/instagram` | Meta | subscription handshake / signed events |
| `GET /api/instagram/connect`, `/callback` | owner | OAuth (state cookie checked) |
| `GET /api/cron` | Vercel Cron (`Bearer CRON_SECRET`) | token refresh, retries, cleanup |
| `GET /api/health` | anyone | DB reachability |

Dashboard mutations are Server Actions (`app/actions.ts`); each verifies the owner session, and Next checks the
Origin header on every action call (CSRF).

## Known limits

- The cron runs daily (Vercel Hobby limit), so a failed send is retried up to a day later. Upgrade the schedule if you're on Pro.
- Content is delivered once per person per automation; a second tap after delivery does nothing.
- One Instagram account per install.
