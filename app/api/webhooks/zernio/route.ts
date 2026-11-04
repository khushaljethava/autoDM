// Zernio webhook: the opening DM's button tap ("autodm:gate:<automationId>") lands here, and
// AutoDM re-checks the follow live every time instead of trusting Zernio's cached answer.
import { createHash } from "node:crypto";
import { after, type NextRequest } from "next/server";
import { all, one, run } from "@/lib/db";
import { render, verifySignature } from "@/lib/match";
import { contentButtons, followStatus, GATE_PREFIX, sendDm, zernioLogs } from "@/lib/zernio";

export const maxDuration = 60;

type Payload = {
  id: string;
  event: string;
  account?: { accountId?: string; username?: string };
  message?: {
    conversationId: string;
    direction?: string;
    text?: string | null;
    platformMessageId?: string;
    sender?: { id: string; username?: string };
    metadata?: { postbackPayload?: string };
  };
};

const RETRY_TITLE = "I've followed";

/**
 * Which automation a button tap belongs to. Zernio's docs promise metadata.postbackPayload, but live
 * comment-automation taps arrive without it: just a "postback_…" message whose text is the button title.
 */
async function tappedAutomation(p: Payload): Promise<number | null> {
  const m = p.message;
  const payload = m?.metadata?.postbackPayload;
  if (payload?.startsWith(GATE_PREFIX)) return Number(payload.slice(GATE_PREFIX.length));
  if (!m?.platformMessageId?.startsWith("postback_") || !m.text || !m.sender?.id) return null;

  if (m.text === RETRY_TITLE) {
    // Our own "I've followed" button: the automation that last checked this person.
    const last = await one<{ automation_id: number }>("SELECT automation_id FROM verification_attempts WHERE instagram_user_id = ? ORDER BY id DESC LIMIT 1", [m.sender.id]);
    return last?.automation_id ?? null;
  }
  const hits = await all<{ id: number; zernio_id: string }>(
    "SELECT id, zernio_id FROM automations WHERE is_active = 1 AND require_follow = 1 AND zernio_id IS NOT NULL AND button_label = ?",
    [m.text],
  );
  if (hits.length <= 1) return hits[0]?.id ?? null;
  // Same label on several automations: pick the one whose opening DM reached this person last.
  let best: { id: number; at: string } | null = null;
  for (const h of hits) {
    const at = (await zernioLogs(h.zernio_id).catch(() => [])).find((l) => l.commenterId === m.sender!.id)?.createdAt;
    if (at && (!best || at > best.at)) best = { id: h.id, at };
  }
  return best?.id ?? null;
}

type Gate = { id: number; is_active: number; content_message: string; content_url: string | null; link_button_label: string; not_following_message: string; verification_error_message: string };

export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());
  const secret = process.env.ZERNIO_WEBHOOK_SECRET?.trim();
  const sig = req.headers.get("x-zernio-signature");
  if (!secret || !sig || !verifySignature(raw, `sha256=${sig}`, [secret])) {
    // Fingerprint only (never the secret) so a mismatch with .env.local is easy to spot.
    console.error("[zernio] rejected webhook", { hasSecret: !!secret, secretFp: secret ? createHash("sha256").update(secret).digest("hex").slice(0, 8) : null, hasSignature: !!sig });
    return new Response("Invalid signature", { status: 401 });
  }

  let p: Payload;
  try {
    p = JSON.parse(raw.toString("utf8"));
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  if (p.event !== "message.received" || p.message?.direction === "outgoing") return new Response("ok");
  const automationId = await tappedAutomation(p);
  if (!automationId) return new Response("ok"); // an ordinary DM, not a gate tap

  // Zernio retries until it gets a 2xx: its event id makes each tap run once.
  const r = await run(
    `INSERT INTO webhook_events (event_key, event_type, payload, processing_status, attempts, received_at)
     VALUES (?, 'messaging', ?, 'received', 0, ?) ON CONFLICT(event_key) DO NOTHING`,
    [`zernio:${p.id}`, raw.toString("utf8").slice(0, 10_000), Date.now()],
  );
  if (!r.rowsAffected) return new Response("ok");

  after(() => handleTap(p, automationId).catch((e) => console.error("[zernio/gate] failed", e)));
  return new Response("ok"); // Zernio wants a 2xx within 5 seconds
}

async function handleTap(p: Payload, automationId: number) {
  const accountId = p.account?.accountId, conv = p.message?.conversationId, user = p.message?.sender;
  if (!accountId || !conv || !user?.id) return;
  const a = await one<Gate>("SELECT * FROM automations WHERE id = ?", [automationId]);
  if (!a?.is_active) return;

  const now = Date.now();
  const { isFollower, reason } = await followStatus(accountId, user.id).catch((e: Error) => ({ isFollower: null, reason: e.message }));
  const check = isFollower === true ? "following" : isFollower === false ? "not_following" : reason === "error" || !reason ? "failed" : "unknown";
  await run("INSERT INTO verification_attempts (automation_id, instagram_user_id, status, api_error_code, created_at) VALUES (?, ?, ?, ?, ?)", [a.id, user.id, check, isFollower === null ? (reason ?? null) : null, now]);

  // Follower → content. Not following / unknown → the matching message, with a button to check again.
  // Not following yet: one button opens the profile to follow, the other checks again when they're back.
  const handle = p.account?.username;
  const retry = [
    ...(handle ? [{ type: "url", title: "View profile", url: `https://www.instagram.com/${encodeURIComponent(handle)}/` }] : []),
    { type: "postback", title: RETRY_TITLE, payload: GATE_PREFIX + a.id },
  ];
  const [type, text, buttons] =
    isFollower === true ? (["content", a.content_message, contentButtons(a)] as const)
    : isFollower === false ? (["not_following", a.not_following_message, retry] as const)
    : (["error", a.verification_error_message, retry] as const);

  let status = "sent", error: string | null = null, msgId: string | null = null;
  try {
    msgId = await sendDm(conv, accountId, render(text, user.username), [...buttons]);
  } catch (e) {
    status = "failed";
    error = (e as Error).message.slice(0, 300);
  }
  await run(
    "INSERT INTO dm_logs (automation_id, instagram_user_id, message_type, message_status, meta_message_id, error_message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [a.id, user.id, type, status, msgId, error, Date.now()],
  );
  await run("UPDATE webhook_events SET processing_status = ?, processed_at = ?, error = ? WHERE event_key = ?", [status === "sent" ? "completed" : "failed", Date.now(), error, `zernio:${p.id}`]);
}
