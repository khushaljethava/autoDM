import type { NextRequest } from "next/server";
import { all, run } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { MetaError, refreshToken, type Account } from "@/lib/instagram";
import { retryEvents } from "@/lib/engine";

export const maxDuration = 300;
const DAY = 24 * 3600_000;

// Daily (vercel.json). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const now = Date.now();

  let refreshed = 0;
  for (const acc of await all<Account>("SELECT * FROM instagram_accounts WHERE connection_status = 'connected'")) {
    if (acc.token_expires_at && acc.token_expires_at - now > 30 * DAY) continue;
    try {
      const t = await refreshToken(decrypt(acc.access_token_encrypted));
      await run("UPDATE instagram_accounts SET access_token_encrypted = ?, token_expires_at = ?, updated_at = ? WHERE id = ?", [encrypt(t.token), t.expiresAt, now, acc.id]);
      refreshed++;
    } catch (e) {
      if ((e instanceof MetaError && e.code === 190) || (acc.token_expires_at && acc.token_expires_at < now)) {
        await run("UPDATE instagram_accounts SET connection_status = 'expired', updated_at = ? WHERE id = ?", [now, acc.id]);
      }
    }
  }

  const retried = await retryEvents();
  await run("DELETE FROM sessions WHERE expires_at < ?", [now]);
  await run("DELETE FROM login_failures WHERE at < ?", [now - DAY]);
  return Response.json({ ok: true, refreshed, retried });
}
