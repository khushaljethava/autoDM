"use server";
// Server actions get Next's built-in Origin check (CSRF); each one re-checks the session.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hash, verify } from "@node-rs/argon2";
import { db, one, run } from "@/lib/db";
import { createSession, destroySession, login, requireOwner } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { isHttpUrl, parseKeywords } from "@/lib/match";
import { listMedia, subscribeWebhooks, type Account } from "@/lib/instagram";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (path: string, msg: string): never => redirect(`${path}?msg=${encodeURIComponent(msg)}`);

export async function loginAction(f: FormData) {
  if (!(await login(str(f, "username"), String(f.get("password") ?? "")))) redirect("/login?error=1");
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function changePasswordAction(f: FormData) {
  const owner = await requireOwner();
  const current = String(f.get("current") ?? "");
  const next = String(f.get("next") ?? "");
  const row = await one<{ password_hash: string }>("SELECT password_hash FROM owner_users WHERE id = ?", [owner.id]);
  if (!row || !(await verify(row.password_hash, current).catch(() => false))) back("/settings", "Current password is wrong");
  if (next.length < 12) back("/settings", "New password must be at least 12 characters");
  await run("UPDATE owner_users SET password_hash = ?, updated_at = ? WHERE id = ?", [await hash(next), Date.now(), owner.id]);
  await run("DELETE FROM sessions WHERE owner_id = ?", [owner.id]); // sign out everywhere else
  await createSession(owner.id);
  back("/settings", "Password changed");
}

// ── Automations ──────────────────────────────────────────────────────────────

const TRIGGERS = ["comment", "dm", "story_reply"];
const MODES = ["exact", "contains", "any"];

export async function saveAutomation(f: FormData) {
  await requireOwner();
  const acc = await one<Account>("SELECT * FROM instagram_accounts WHERE connection_status = 'connected' LIMIT 1");
  if (!acc) return back("/settings", "Connect Instagram first");

  const id = Number(str(f, "id")) || null;
  const formPath = id ? `/automations/${id}` : "/automations/new";
  const trigger = str(f, "trigger_type");
  const mode = str(f, "match_mode");
  const keywords = parseKeywords(str(f, "keywords"));
  const url = str(f, "content_url");
  const requireFollow = f.get("require_follow") === "on";
  const v = {
    name: str(f, "name"),
    initial: str(f, "initial_message"),
    content: str(f, "content_message"),
    notFollowing: str(f, "not_following_message"),
    verifyError: str(f, "verification_error_message"),
  };

  // Browser validation catches these first; this is the server-side guard.
  if (!TRIGGERS.includes(trigger) || !MODES.includes(mode)) back(formPath, "Invalid trigger or match mode");
  if (!v.name || !v.content) back(formPath, "Name and content message are required");
  if (trigger === "comment" && !v.initial) back(formPath, "Opening DM is required for comment automations");
  if (mode !== "any" && !keywords.length) back(formPath, "Add at least one keyword, or choose “any message”");
  if (url && !isHttpUrl(url)) back(formPath, "Link must start with http:// or https://");
  if (requireFollow && (!v.notFollowing || !v.verifyError)) back(formPath, "Follow-gate messages are required when the gate is on");

  let mediaId: string | null = trigger === "comment" ? str(f, "media_id") || null : null;
  let caption: string | null = null;
  if (mediaId === "any") mediaId = null;
  if (mediaId) {
    // Look the caption up server-side instead of trusting a hidden field.
    const media = await listMedia(acc).catch(() => []);
    caption = media.find((m) => m.id === mediaId)?.caption?.slice(0, 200) ?? null;
  }

  const now = Date.now();
  const cols = [
    acc.id, v.name, trigger, mediaId, caption, mode,
    v.initial || "Here you go 👇", str(f, "button_label") || "Send me the link", str(f, "comment_replies"),
    requireFollow ? 1 : 0, v.content, url || null, str(f, "link_button_label") || "Open link",
    v.notFollowing, v.verifyError, f.get("is_active") === "on" ? 1 : 0,
  ];
  const fields = "account_id, name, trigger_type, media_id, media_caption, match_mode, initial_message, button_label, comment_replies, require_follow, content_message, content_url, link_button_label, not_following_message, verification_error_message, is_active";

  let automationId = id;
  if (id) {
    const set = fields.split(", ").map((c) => `${c} = ?`).join(", ");
    await run(`UPDATE automations SET ${set}, updated_at = ? WHERE id = ?`, [...cols, now, id]);
  } else {
    const r = await run(`INSERT INTO automations (${fields}, created_at, updated_at) VALUES (${cols.map(() => "?").join(", ")}, ?, ?)`, [...cols, now, now]);
    automationId = Number(r.lastInsertRowid);
  }
  await db.batch(
    [
      { sql: "DELETE FROM automation_keywords WHERE automation_id = ?", args: [automationId] },
      ...keywords.map((k) => ({ sql: "INSERT INTO automation_keywords (automation_id, keyword, created_at) VALUES (?, ?, ?)", args: [automationId, k, now] })),
    ],
    "write",
  );
  revalidatePath("/automations");
  redirect("/automations");
}

export async function toggleAutomation(f: FormData) {
  await requireOwner();
  await run("UPDATE automations SET is_active = 1 - is_active, updated_at = ? WHERE id = ?", [Date.now(), Number(str(f, "id"))]);
  revalidatePath("/automations");
}

export async function deleteAutomation(f: FormData) {
  await requireOwner();
  const id = Number(str(f, "id"));
  // Explicit deletes: SQLite foreign-key cascades depend on a per-connection pragma.
  await db.batch(
    ["automation_keywords", "dm_logs", "verification_attempts"]
      .map((t) => ({ sql: `DELETE FROM ${t} WHERE automation_id = ?`, args: [id] }))
      .concat({ sql: "DELETE FROM automations WHERE id = ?", args: [id] }),
    "write",
  );
  revalidatePath("/automations");
}

// ── Instagram ────────────────────────────────────────────────────────────────

export async function disconnectInstagram() {
  await requireOwner();
  // ponytail: token is discarded locally; it lapses on Meta's side within 60 days. Remove the app in Instagram settings to cut it now.
  await run("UPDATE instagram_accounts SET connection_status = 'disconnected', access_token_encrypted = '', updated_at = ?", [Date.now()]);
  back("/settings", "Instagram disconnected");
}

export async function resubscribeWebhooks() {
  await requireOwner();
  const acc = await one<Account>("SELECT * FROM instagram_accounts WHERE connection_status = 'connected' LIMIT 1");
  if (!acc) return back("/settings", "Connect Instagram first");
  const ok = await subscribeWebhooks(acc.instagram_user_id, decrypt(acc.access_token_encrypted)).then(() => true, () => false);
  back("/settings", ok ? "Webhook fields subscribed" : "Webhook subscription failed; try reconnecting");
}
