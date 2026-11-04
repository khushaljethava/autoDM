// Zernio webhook: the opening DM's button tap ("autodm:gate:<automationId>") lands here, and
// AutoDM re-checks the follow live every time instead of trusting Zernio's cached answer.
import { after, type NextRequest } from "next/server";
import { one, run } from "@/lib/db";
import { render, verifySignature } from "@/lib/match";
import { contentButtons, followStatus, GATE_PREFIX, sendDm } from "@/lib/zernio";

export const maxDuration = 60;

type Payload = {
  id: string;
  event: string;
  account?: { accountId?: string };
  message?: { conversationId: string; direction?: string; sender?: { id: string; username?: string }; metadata?: { postbackPayload?: string } };
};

type Gate = { id: number; is_active: number; content_message: string; content_url: string | null; link_button_label: string; not_following_message: string; verification_error_message: string };

export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());
  const secret = process.env.ZERNIO_WEBHOOK_SECRET?.trim();
  const sig = req.headers.get("x-zernio-signature");
  if (!secret || !sig || !verifySignature(raw, `sha256=${sig}`, [secret])) return new Response("Invalid signature", { status: 401 });

  let p: Payload;
  try {
    p = JSON.parse(raw.toString("utf8"));
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const tap = p.message?.metadata?.postbackPayload;
  if (p.event !== "message.received" || p.message?.direction === "outgoing" || !tap?.startsWith(GATE_PREFIX)) return new Response("ok");

  // Zernio retries until it gets a 2xx: its event id makes each tap run once.
  const r = await run(
    `INSERT INTO webhook_events (event_key, event_type, payload, processing_status, attempts, received_at)
     VALUES (?, 'messaging', ?, 'received', 0, ?) ON CONFLICT(event_key) DO NOTHING`,
    [`zernio:${p.id}`, raw.toString("utf8").slice(0, 10_000), Date.now()],
  );
  if (!r.rowsAffected) return new Response("ok");

  after(() => handleTap(p, Number(tap.slice(GATE_PREFIX.length))).catch((e) => console.error("[zernio/gate] failed", e)));
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
  const retry = [{ type: "postback", title: "I've followed", payload: GATE_PREFIX + a.id }];
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
