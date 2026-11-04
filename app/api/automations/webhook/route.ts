// Create (or update) a link-in-DM automation for one post/Reel from outside the dashboard.
//   POST /api/automations/webhook
//   Authorization: Bearer $AUTOMATION_WEBHOOK_SECRET
//   { "post": "<media id or Instagram link>", "url": "https://…",
//     "template"?: "random (default)|classic|hype|minimal|mystery|curious", "name"?: "…" }
// No keywords: any comment on that post triggers it. One automation per post: calling again for the
// same post updates its link.
import { createHash, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { one, run } from "@/lib/db";
import { resolvePost } from "@/lib/hook";
import { listMedia, type Account } from "@/lib/instagram";
import { isHttpUrl } from "@/lib/match";
import { TEMPLATES, templateByKey } from "@/lib/templates";
import { syncAutomation, zernioEnabled, type AutomationFields } from "@/lib/zernio";

const digest = (s: string) => createHash("sha256").update(s).digest();
const err = (status: number, error: string, extra: object = {}) => Response.json({ ok: false, error, ...extra }, { status });

export async function POST(req: NextRequest) {
  const secret = process.env.AUTOMATION_WEBHOOK_SECRET?.trim();
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !timingSafeEqual(digest(got), digest(secret))) return err(401, "Unauthorized");

  let b: { post?: unknown; media_id?: unknown; url?: unknown; template?: unknown; name?: unknown };
  try {
    b = await req.json();
  } catch {
    return err(400, "Body must be JSON");
  }
  const ref = String(b.post ?? b.media_id ?? "").trim();
  const url = String(b.url ?? "").trim();
  if (!ref) return err(400, "“post” is required: a media id or an Instagram post/Reel link");
  if (!isHttpUrl(url)) return err(400, "“url” must start with http:// or https://");
  // No template given: pick one at random so automations created by the hook don't all read the same.
  const t = b.template === undefined || b.template === "random" ? TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)] : templateByKey(String(b.template));
  if (!t) return err(400, `Unknown template. Use random or one of: ${TEMPLATES.map((x) => x.key).join(", ")}`);

  const acc = await one<Account>("SELECT * FROM instagram_accounts WHERE connection_status = 'connected' LIMIT 1");
  if (!acc) return err(409, "Connect Instagram in AutoDM settings first");
  const post = resolvePost(ref, await listMedia(acc).catch(() => []));
  if (!post) return err(404, "Couldn't find that post on your account. Pass its media id or its instagram.com link.");

  const now = Date.now();
  const existing = await one<{ id: number }>("SELECT id FROM automations WHERE media_id = ? AND trigger_type = 'comment' ORDER BY id LIMIT 1", [post.id]);
  let id: number;
  if (existing) {
    id = existing.id;
    await run("UPDATE automations SET content_url = ?, match_mode = 'any', is_active = 1, updated_at = ? WHERE id = ?", [url, now, id]);
  } else {
    const r = await run(
      `INSERT INTO automations (account_id, name, trigger_type, media_id, media_caption, match_mode, initial_message, button_label, comment_replies,
         require_follow, content_message, content_url, link_button_label, not_following_message, verification_error_message, is_active, created_at, updated_at)
       VALUES (?, ?, 'comment', ?, ?, 'any', ?, ?, ?, 1, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [acc.id, typeof b.name === "string" && b.name.trim() ? b.name.trim().slice(0, 80) : `${t.name} · ${post.caption?.slice(0, 40) || post.id}`,
        post.id, post.caption?.slice(0, 200) ?? null, t.initial_message, t.button_label, t.comment_replies,
        t.content_message, url, t.link_button_label, t.not_following_message, t.verification_error_message, now, now],
    );
    id = Number(r.lastInsertRowid);
  }
  await run("DELETE FROM automation_keywords WHERE automation_id = ?", [id]); // any comment triggers it

  let zernioId: string | null = null;
  if (zernioEnabled()) {
    const row = (await one<AutomationFields & { zernio_id: string | null }>("SELECT * FROM automations WHERE id = ?", [id]))!;
    try {
      zernioId = await syncAutomation(row, [], row.zernio_id);
      if (zernioId !== row.zernio_id) await run("UPDATE automations SET zernio_id = ? WHERE id = ?", [zernioId, id]);
    } catch (e) {
      return err(502, `Saved in AutoDM (#${id}) but not synced to Zernio: ${(e as Error).message}`, { id });
    }
  }

  revalidatePath("/automations");
  return Response.json({ ok: true, action: existing ? "updated" : "created", id, media_id: post.id, template: t.key, trigger: "any comment", zernio_id: zernioId }, { status: existing ? 200 : 201 });
}
