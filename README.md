<div align="center">

<img src="public/logo.svg" width="90" alt="AutoDM logo" />

# AutoDM

**Private Instagram comment-to-DM automation with a real follow-to-unlock gate.**

Someone comments a keyword on your post → they get a DM → they tap a button → AutoDM checks
that they actually follow you → only then does the link land in their inbox.
One owner, one Next.js app, official Meta APIs only. No scraping, no browser bots, no third-party servers.

`Next.js 16 (one deployment)` · `Turso / libSQL` · `Vercel` · `Instagram API with Instagram Login`

<img src="https://img.shields.io/badge/Next.js-16-000?style=for-the-badge&logo=nextdotjs" alt="Next.js 16" />
<img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
<img src="https://img.shields.io/badge/Turso-libSQL-4FF8D2?style=for-the-badge&logo=turso&logoColor=black" alt="Turso" />
<img src="https://img.shields.io/badge/Meta-official_API-E1306C?style=for-the-badge&logo=instagram&logoColor=white" alt="Official Instagram API" />

</div>

---

## ✨ What it does

- **Comment → DM**: a keyword comment on one specific post/Reel (or any post) triggers a Meta **Private Reply**, the purpose-built comment-to-DM channel.
- **DM keyword replies**: someone DMs you `GUIDE` and the flow starts straight away.
- **Story reply triggers**: someone replies `GUIDE` to your story and gets the same flow, routed to its own automations.
- **Follow-to-unlock gate**: tapping **"Send me the link"** runs a follower check (`is_user_follow_business`):
  - ✅ **following** → content message + tappable link button (plain-text fallback if Meta rejects the template)
  - 👋 **not following** → "Visit profile" + "I've followed" buttons; tapping rechecks
  - ⚠️ **unknown / API error** → content is **held back**, with a friendly error and a "Try again" button
- **Public comment replies**: optionally reply under the comment with a random line from your list ("Sent! Check your DMs 📬").
- **Three match modes**: `exact`, `contains` (whole word), or `any`. Always case-insensitive and emoji/punctuation tolerant.
- **`{username}` personalization**: greet commenters by their @handle.
- **Live DM preview**: the automation editor renders an Instagram-style chat preview as you type.
- **Dashboard**: conversion funnel (comment → DM → request → follow check → delivered), activity logs with filters, follower-check history, failed-webhook list with one-click **Retry now**.

## 🛡️ Built to keep your Instagram account safe

| Rule | How it's enforced |
|---|---|
| No duplicate sends | `webhook_events.event_key` is unique; partial unique indexes on `dm_logs` allow one opening DM per comment and one content delivery per person per automation |
| Fail closed | An unknown follower status **never** releases the content |
| ~200 DMs/hour Meta limit | Capped at **180/hour** per account, leaving room for your own DMs |
| 24-hour messaging window | DM events older than 24h are never answered |
| Policy blocks (Meta error 368) | **Circuit breaker**: all sends pause for 24h instead of retrying into a ban |
| Rate-limit errors (4/17/32/613) | No fallback burst, event left for retry |
| Expired token (error 190) | Account marked expired, dashboard banner, automations stop |
| Webhook authenticity | HMAC-SHA256 over the raw body, timing-safe compare (Instagram **or** Facebook app secret) |
| Tokens at rest | AES-256-GCM encrypted, auto-refreshed by the daily cron when < 30 days remain |

## 🏗️ Architecture

One Next.js app. No Redis, no worker servers, no queue service.

```
Instagram comment / DM / story reply
          │
          ▼
Meta webhook ──► /api/webhooks/instagram ── verify HMAC ── store + dedup event ── 200 OK
                                                  │
                                                  ▼
                            claim event atomically (UPDATE … RETURNING)
                            match automation → keyword → window / pause / hourly cap
                                                  │
                     ┌────────────────────────────┴───────────────────────┐
             private reply + "Send me the link"               failed → kept with error
                     │                                         → daily cron retries (3×, 6 days)
                     ▼                                         → or "Retry now" in Logs
        postback UNLOCK:<id> → follower check
          ├─ following      → content + link button
          ├─ not following  → follow prompt, recheck on tap
          └─ unknown        → held back, "Try again"
```

- **Turso / libSQL** stores everything: owner + sessions, the Instagram connection, automations, webhook events, follower checks and message logs.
- **Vercel Cron** hits `/api/cron` daily for token refresh, event retries and cleanup.
- **Server Actions** handle every dashboard mutation; each one checks the owner session, and Next.js checks the Origin header (CSRF).

## 🖥️ Screens

All screens were designed in **Google Stitch** and ported to Tailwind v4:

| Screen | Highlights |
|---|---|
| **Login** | Owner-only sign-in, generic errors, live DB health pill |
| **Overview** | KPI tiles, 5-step delivery funnel, recent activity, time-range tabs |
| **Automations** | Summary metrics, keyword chips, pause/resume/edit/delete |
| **Editor** | Trigger cards, match-mode picker, post grid, follow-gate toggle, live DM preview |
| **Activity logs** | Status filters, messages, follower checks, failed events + Retry now |
| **Settings** | Connection + token status, webhook config check, password change, safety rails |

## 🚀 Quick start

You need: Node 24+, a [Meta developer](https://developers.facebook.com) app, and (for production) [Turso](https://turso.tech) + [Vercel](https://vercel.com).

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local
#    → fill APP_ENCRYPTION_KEY, META_*, CRON_SECRET (each one is explained in the file)

# 3. Create the owner (there is no signup page, on purpose)
npm run hash-password            # paste OWNER_USERNAME + OWNER_PASSWORD_HASH into .env.local
npm run db:migrate               # creates tables and the single owner
#    → then delete OWNER_USERNAME / OWNER_PASSWORD_HASH from .env.local

# 4. Run
npm run dev
```

Meta needs a public HTTPS URL for OAuth and webhooks. Use a tunnel (`cloudflared tunnel --url http://localhost:3000`
or ngrok) and set `META_REDIRECT_URI` to `https://<tunnel>/api/instagram/callback`.

<details>
<summary><b>📱 Meta app setup</b></summary>

1. developers.facebook.com → your app → **Instagram → API setup with Instagram login**.
2. Permissions: `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments`.
3. **Business login settings → OAuth redirect URI:** exactly your `META_REDIRECT_URI`.
4. **Webhooks:** callback `https://<domain>/api/webhooks/instagram`, verify token = `META_WEBHOOK_VERIFY_TOKEN`;
   subscribe to `comments`, `messages`, `messaging_postbacks`.
5. In AutoDM: **Settings → Connect Instagram**. This also subscribes your account to the webhook fields
   (use **Resubscribe webhooks** if events stop arriving).
6. Instagram app → Settings → Messages and calls → **Connected tools → allow access to messages**.

**Development mode** only delivers events from accounts with a role on the app, so add a second Instagram account as a
tester to try it end to end. To trigger on the public, submit **App Review** for Advanced Access on the two
`manage_*` permissions with a screencast of the working flow.

</details>

<details>
<summary><b>☁️ Production on Vercel</b></summary>

1. `turso db create autodm && turso db show autodm --url && turso db tokens create autodm`.
   Create a **separate** database for Preview so previews never touch production automations.
2. Set all env vars in Vercel **per environment** (Production / Preview). `META_REDIRECT_URI` = your production domain.
3. Run migrations against production once from your machine:
   ```bash
   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... OWNER_USERNAME=... OWNER_PASSWORD_HASH='...' npm run db:migrate
   ```
   The owner row is pinned to `id = 1`, so setup can never create a second owner. `OWNER_*` never go to Vercel.
4. Deploy. `vercel.json` schedules `/api/cron` daily at 03:00 UTC.
5. Backups: Turso keeps point-in-time restore; `turso db shell autodm .dump > backup.sql` for a manual copy.

</details>

## 🔐 Security model

- **One owner, no registration.** Created once through `db:migrate`, enforced by a `CHECK (id = 1)` constraint.
- **Passwords**: Argon2id, never stored or logged in plaintext. Changing it signs out every other session.
- **Sessions**: random tokens, only their SHA-256 hash is stored; `HttpOnly`, `SameSite=Lax`, `Secure` in production, 7-day expiry.
- **Login rate limit**: 5 failures per IP and 30 globally per 15 minutes, with a generic error message.
- **Instagram tokens**: AES-256-GCM encrypted at rest, decrypted only at send time, never logged.
- **OAuth**: state cookie checked on callback.
- **Webhooks**: signature verified before anything else runs.

## 🧰 Scripts & endpoints

| Command | What it does |
|---|---|
| `npm test` | Keyword matching, URL validation, templating, webhook signature checks |
| `npm run db:migrate` | Apply `migrations/*.sql` (tracked in `_migrations`) |
| `npm run hash-password` | Print an Argon2id hash for the owner |

| Path | Who | Purpose |
|---|---|---|
| `GET/POST /api/webhooks/instagram` | Meta | Subscription handshake / signed events |
| `GET /api/instagram/connect`, `/callback` | Owner | OAuth |
| `GET /api/cron` | Vercel Cron (`Bearer CRON_SECRET`) | Token refresh, retries, cleanup |
| `GET /api/health` | Anyone | DB reachability + version |

## 📏 Known limits

- The cron runs daily (Vercel Hobby limit), so automatic retries can take up to a day. Use **Retry now** in Logs, or tighten the schedule on Pro.
- Content is delivered once per person per automation; a second tap after delivery does nothing.
- One Instagram account per install.

## ⚠️ Disclaimer

- AutoDM talks to Instagram **only** through Meta's official APIs, using **your own** Meta app and credentials.
  It never scrapes, never automates a browser, and never asks for your Instagram password.
- The safety rails are designed to keep you inside Meta's published limits, but **you** are responsible for how
  you use automation and for complying with Instagram's Terms of Use and Meta's Platform Policies.
- Not affiliated with, endorsed by, or sponsored by Meta or Instagram.

---

<div align="center">

Built with ❤️ for creators who'd rather make content than copy-paste links.

</div>
