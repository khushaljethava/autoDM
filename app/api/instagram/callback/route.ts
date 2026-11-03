import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { run } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { exchangeCode, getMe, subscribeWebhooks } from "@/lib/instagram";

const done = (msg: string): never => redirect(`/settings?msg=${encodeURIComponent(msg)}`);

export async function GET(req: NextRequest) {
  await requireOwner();
  const p = req.nextUrl.searchParams;
  const jar = await cookies();
  const expected = jar.get("ig_oauth_state")?.value;
  jar.delete("ig_oauth_state");
  if (!expected || p.get("state") !== expected) done("Login expired or was tampered with; try again");
  if (p.get("error")) done(`Instagram said: ${p.get("error_description") ?? p.get("error")}`);
  const code = p.get("code");
  if (!code) return done("No authorization code returned");

  let msg = "Instagram connected";
  try {
    const { token, expiresAt } = await exchangeCode(code);
    const me = await getMe(token);
    const now = Date.now();
    // One account in this release: anything connected before is disconnected.
    await run("UPDATE instagram_accounts SET connection_status = 'disconnected', access_token_encrypted = '', updated_at = ? WHERE instagram_user_id != ?", [now, me.user_id]);
    await run(
      `INSERT INTO instagram_accounts (instagram_user_id, username, access_token_encrypted, token_expires_at, connection_status, last_api_success_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'connected', ?, ?, ?)
       ON CONFLICT(instagram_user_id) DO UPDATE SET username = excluded.username, access_token_encrypted = excluded.access_token_encrypted,
         token_expires_at = excluded.token_expires_at, connection_status = 'connected', paused_until = NULL,
         last_api_success_at = excluded.last_api_success_at, updated_at = excluded.updated_at`,
      [me.user_id, me.username, encrypt(token), expiresAt, now, now, now],
    );
    await subscribeWebhooks(me.user_id, token).catch(() => (msg = "Connected, but webhook subscription failed; use “Resubscribe” in settings"));
  } catch (e) {
    console.error("[instagram/callback] connect failed", { redirect_uri: process.env.META_REDIRECT_URI?.trim(), app_id: process.env.META_APP_ID?.trim() }, e);
    msg =`Connection failed: ${e instanceof Error ? e.message : "unknown error"}`.slice(0, 300);
  }
  done(msg);
}
