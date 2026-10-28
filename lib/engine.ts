// Webhook → stored event → automation → DMs. Every send is logged and deduped in dm_logs.
import { all, one, run } from "./db";
import { matchKeyword, render, type MatchMode } from "./match";
import { buttonMessage, followsAccount, MetaError, replyToComment, sendMessage, type Account, type Message, type Recipient } from "./instagram";

export type Automation = {
  id: number;
  account_id: number;
  name: string;
  trigger_type: "comment" | "dm" | "story_reply";
  media_id: string | null;
  media_caption: string | null;
  match_mode: MatchMode;
  initial_message: string;
  button_label: string;
  comment_replies: string;
  require_follow: number;
  content_message: string;
  content_url: string | null;
  link_button_label: string;
  not_following_message: string;
  verification_error_message: string;
  is_active: number;
  keywords: string | null; // newline-joined
};

type Item = { key: string; type: "comment" | "messaging"; accountIgId: string; commentId?: string; mediaId?: string; data: unknown };

type CommentValue = { id: string; text?: string; from?: { id: string; username?: string }; media?: { id: string } };
type MessagingValue = {
  sender?: { id: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; quick_reply?: { payload?: string }; reply_to?: { story?: unknown } };
  postback?: { mid?: string; payload?: string };
};
export type WebhookBody = { entry?: { id: string | number; changes?: { field: string; value: CommentValue }[]; messaging?: MessagingValue[] }[] };

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const DM_HOURLY_CAP = 180; // ponytail: Meta allows ~200/h; 20 left for your manual DMs
const UNLOCK = "UNLOCK:";
// Errors where a fallback message won't help: bad token, policy block, rate limits.
const NO_FALLBACK_CODES = [190, 368, 4, 17, 32, 613];

export const AUTOMATION_SELECT =
  "SELECT a.*, (SELECT group_concat(keyword, char(10)) FROM automation_keywords k WHERE k.automation_id = a.id) AS keywords FROM automations a";
const keywordsOf = (a: Automation) => (a.keywords ?? "").split("\n").filter(Boolean);
const errText = (e: unknown) => (e instanceof MetaError ? `Meta ${e.code ?? "?"}: ${e.message}` : e instanceof Error ? e.message : String(e)).slice(0, 500);

// ── Ingest ───────────────────────────────────────────────────────────────────

export function splitWebhook(body: WebhookBody): Item[] {
  const items: Item[] = [];
  for (const entry of body?.entry ?? []) {
    const accountIgId = String(entry.id);
    for (const ch of entry.changes ?? []) {
      if (ch.field === "comments" && ch.value?.id) {
        items.push({ key: `comment:${ch.value.id}`, type: "comment", accountIgId, commentId: ch.value.id, mediaId: ch.value.media?.id, data: ch.value });
      }
    }
    for (const m of entry.messaging ?? []) {
      if (m.message?.is_echo || (!m.message && !m.postback)) continue; // echoes, reads, deliveries
      const mid = m.message?.mid ?? m.postback?.mid ?? `${m.sender?.id}:${m.timestamp}`;
      items.push({ key: `msg:${mid}`, type: "messaging", accountIgId, data: m });
    }
  }
  return items;
}

/**
 * Persist first, then process inline before acking Meta. If the function dies mid-way the
 * row stays received/processing and the cron retries it; dedup makes retries safe.
 */
export async function ingest(body: WebhookBody) {
  for (const it of splitWebhook(body)) {
    const r = await run(
      `INSERT INTO webhook_events (event_key, comment_id, media_id, event_type, payload, processing_status, attempts, received_at)
       VALUES (?, ?, ?, ?, ?, 'received', 0, ?) ON CONFLICT(event_key) DO NOTHING`,
      [it.key, it.commentId ?? null, it.mediaId ?? null, it.type, JSON.stringify(it), Date.now()],
    );
    if (r.rowsAffected) await processEvent(Number(r.lastInsertRowid));
  }
}

export async function processEvent(id: number) {
  // Atomic claim: only one invocation gets the row.
  const ev = await one<{ payload: string }>(
    "UPDATE webhook_events SET processing_status = 'processing', attempts = attempts + 1 WHERE id = ? AND processing_status IN ('received', 'failed') RETURNING payload",
    [id],
  );
  if (!ev) return;
  try {
    const it = JSON.parse(ev.payload) as Item;
    await (it.type === "comment" ? onComment(it) : onMessaging(it));
    await run("UPDATE webhook_events SET processing_status = 'completed', processed_at = ?, error = NULL WHERE id = ?", [Date.now(), id]);
  } catch (e) {
    await run("UPDATE webhook_events SET processing_status = 'failed', processed_at = ?, error = ? WHERE id = ?", [Date.now(), errText(e), id]);
  }
}

/** Cron: retry failed / stuck events inside the 7-day private-reply window, max 3 attempts. */
export async function retryEvents() {
  const now = Date.now();
  await run("UPDATE webhook_events SET processing_status = 'failed' WHERE processing_status = 'processing' AND received_at < ?", [now - 10 * 60_000]);
  const rows = await all<{ id: number }>(
    "SELECT id FROM webhook_events WHERE processing_status IN ('received', 'failed') AND attempts < 3 AND received_at > ? ORDER BY id LIMIT 100",
    [now - 6 * DAY],
  );
  for (const r of rows) await processEvent(r.id);
  return rows.length;
}

// ── Routing ──────────────────────────────────────────────────────────────────

function connectedAccount(igId: string) {
  return one<Account>("SELECT * FROM instagram_accounts WHERE instagram_user_id = ? AND connection_status = 'connected'", [igId]);
}

function activeAutomations(accountId: number, trigger: Automation["trigger_type"], mediaId?: string) {
  // Post-specific automations win over "any post" ones.
  return all<Automation>(
    `${AUTOMATION_SELECT} WHERE a.account_id = ? AND a.is_active = 1 AND a.trigger_type = ?
     ${mediaId !== undefined ? "AND (a.media_id IS NULL OR a.media_id = ?)" : ""} ORDER BY a.media_id IS NULL, a.id`,
    mediaId !== undefined ? [accountId, trigger, mediaId] : [accountId, trigger],
  );
}

async function onComment(it: Item) {
  const c = it.data as CommentValue;
  if (!c.from || c.from.id === it.accountIgId) return; // never react to our own replies
  const acc = await connectedAccount(it.accountIgId);
  if (!acc) return;

  for (const a of await activeAutomations(acc.id, "comment", c.media?.id ?? "")) {
    const keyword = matchKeyword(c.text ?? "", keywordsOf(a), a.match_mode);
    if (!keyword) continue;
    const ctx: Ctx = { acc, a, userId: c.from.id, commentId: c.id, keyword };

    const replies = a.comment_replies.split("\n").map((s) => s.trim()).filter(Boolean);
    if (replies.length) {
      const reply = render(replies[Math.floor(Math.random() * replies.length)], c.from.username);
      await logged(ctx, "comment_reply", () => replyToComment(acc, c.id, reply)).catch(() => {}); // best-effort, DM still goes
    }

    const text = render(a.initial_message, c.from.username);
    await logged(ctx, "initial", () =>
      sendWithFallback(
        acc,
        { comment_id: c.id },
        buttonMessage(text, [{ type: "postback", title: a.button_label, payload: `${UNLOCK}${a.id}` }]),
        { text: `${text}\n\nReply to this message and I'll send it.` },
      ),
    );
    return; // first matching automation wins
  }
}

async function onMessaging(it: Item) {
  const m = it.data as MessagingValue;
  const userId = m.sender?.id;
  if (!userId || userId === it.accountIgId) return;
  if (m.timestamp && Date.now() - m.timestamp > DAY) return; // 24h messaging window closed
  const acc = await connectedAccount(it.accountIgId);
  if (!acc) return;

  // 1. Button tap: routed by payload, never by visible text.
  const payload = m.postback?.payload ?? m.message?.quick_reply?.payload;
  if (payload?.startsWith(UNLOCK)) {
    const a = await one<Automation>(`${AUTOMATION_SELECT} WHERE a.id = ? AND a.account_id = ? AND a.is_active = 1`, [Number(payload.slice(UNLOCK.length)), acc.id]);
    if (a) await unlock({ acc, a, userId, commentId: null, keyword: null });
    return;
  }

  const text = m.message?.text;
  if (!text) return;

  // 2. DM / story-reply keyword automations.
  for (const a of await activeAutomations(acc.id, m.message?.reply_to?.story ? "story_reply" : "dm")) {
    const keyword = matchKeyword(text, keywordsOf(a), a.match_mode);
    if (keyword) return unlock({ acc, a, userId, commentId: null, keyword });
  }

  // 3. A typed reply ("done!", "I followed") to an opening DM that hasn't been fulfilled yet.
  const pending = await one<Automation>(
    `${AUTOMATION_SELECT} JOIN dm_logs l ON l.automation_id = a.id
     WHERE l.instagram_user_id = ? AND l.message_type = 'initial' AND l.message_status = 'sent' AND l.created_at > ? AND a.is_active = 1
       AND NOT EXISTS (SELECT 1 FROM dm_logs c WHERE c.automation_id = a.id AND c.instagram_user_id = l.instagram_user_id AND c.message_type = 'content' AND c.message_status = 'sent')
     ORDER BY l.created_at DESC LIMIT 1`,
    [userId, Date.now() - 7 * DAY],
  );
  if (pending) await unlock({ acc, a: pending, userId, commentId: null, keyword: null });
}

// ── Follow gate + delivery ───────────────────────────────────────────────────

type Ctx = { acc: Account; a: Automation; userId: string; commentId: string | null; keyword: string | null };

async function unlock(ctx: Ctx) {
  const { acc, a, userId } = ctx;
  const retry = { type: "postback" as const, payload: `${UNLOCK}${a.id}` };

  if (a.require_follow) {
    const { follows, error } = await followsAccount(acc, userId);
    const status = follows === true ? "following" : follows === false ? "not_following" : error ? "failed" : "unknown";
    await run("INSERT INTO verification_attempts (automation_id, instagram_user_id, status, api_error_code, created_at) VALUES (?, ?, ?, ?, ?)", [
      a.id,
      userId,
      status,
      error ?? null,
      Date.now(),
    ]);
    if (follows === false) {
      await logged(ctx, "not_following", () =>
        send(acc, { id: userId }, buttonMessage(a.not_following_message, [
          { type: "web_url", title: "Visit profile", url: `https://www.instagram.com/${acc.username}/` },
          { ...retry, title: "I've followed" },
        ])),
      );
      return;
    }
    if (follows === null) {
      // Unknown is never treated as following, and never as not-following.
      await logged(ctx, "error", () => send(acc, { id: userId }, buttonMessage(a.verification_error_message, [{ ...retry, title: "Try again" }])));
      return;
    }
  }

  await logged(ctx, "content", () =>
    a.content_url
      ? sendWithFallback(
          acc,
          { id: userId },
          buttonMessage(a.content_message, [{ type: "web_url", title: a.link_button_label, url: a.content_url }]),
          { text: `${a.content_message}\n\n${a.content_url}` },
        )
      : send(acc, { id: userId }, { text: a.content_message }),
  );
}

/** Inserts a pending log row (unique indexes reject duplicates), runs the send, records Meta's result. */
async function logged(ctx: Ctx, type: "initial" | "comment_reply" | "content" | "not_following" | "error", fn: () => Promise<string | null>) {
  const ins = await run(
    `INSERT INTO dm_logs (automation_id, comment_id, instagram_user_id, matched_keyword, message_type, message_status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?) ON CONFLICT DO NOTHING`,
    [ctx.a.id, ctx.commentId, ctx.userId, ctx.keyword, type, Date.now()],
  );
  if (!ins.rowsAffected) return false; // already sent or in flight
  const id = Number(ins.lastInsertRowid);
  try {
    const mid = await fn();
    await run("UPDATE dm_logs SET message_status = 'sent', meta_message_id = ? WHERE id = ?", [mid, id]);
    return true;
  } catch (e) {
    await run("UPDATE dm_logs SET message_status = 'failed', error_message = ? WHERE id = ?", [errText(e), id]);
    throw e;
  }
}

async function send(acc: Account, recipient: Recipient, message: Message) {
  if (acc.paused_until && acc.paused_until > Date.now()) throw new Error("Sending paused for 24h after a Meta policy block (368)");
  if ("id" in recipient) {
    // Private replies have their own Meta allowance; regular DMs share ~200/hour.
    const r = await one<{ n: number }>(
      "SELECT COUNT(*) AS n FROM dm_logs l JOIN automations a ON a.id = l.automation_id WHERE a.account_id = ? AND l.message_type IN ('content', 'not_following', 'error') AND l.message_status = 'sent' AND l.created_at > ?",
      [acc.id, Date.now() - HOUR],
    );
    if ((r?.n ?? 0) >= DM_HOURLY_CAP) throw new Error("Hourly DM cap reached; will retry");
  }
  try {
    const mid = await sendMessage(acc, recipient, message);
    await run("UPDATE instagram_accounts SET last_api_success_at = ? WHERE id = ?", [Date.now(), acc.id]);
    return mid;
  } catch (e) {
    if (e instanceof MetaError && e.code === 190) await run("UPDATE instagram_accounts SET connection_status = 'expired', updated_at = ? WHERE id = ?", [Date.now(), acc.id]);
    if (e instanceof MetaError && e.code === 368) await run("UPDATE instagram_accounts SET paused_until = ? WHERE id = ?", [Date.now() + DAY, acc.id]);
    throw e;
  }
}

/** Meta sometimes rejects button templates for a recipient; fall back to plain text. */
async function sendWithFallback(acc: Account, recipient: Recipient, primary: Message, fallback: Message) {
  try {
    return await send(acc, recipient, primary);
  } catch (e) {
    if (!(e instanceof MetaError) || NO_FALLBACK_CODES.includes(e.code ?? -1)) throw e;
    return send(acc, recipient, fallback);
  }
}
