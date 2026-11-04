// Zernio runs the comment-to-DM automations through its own Meta-approved app, so comments from
// anyone reach it (our own app only sees testers without App Review). AutoDM stays the dashboard:
// every saved automation is mirrored to POST/PATCH /v1/comment-automations.
// Docs: https://docs.zernio.com/comment-automations/create-comment-automation.mdx

const BASE = "https://zernio.com/api/v1";

export const zernioEnabled = () => !!process.env.ZERNIO_API_KEY?.trim();

async function z<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${process.env.ZERNIO_API_KEY?.trim()}`, "Content-Type": "application/json", ...init.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`[zernio] ${init.method ?? "GET"} ${path} → ${res.status}`, JSON.stringify(data));
    throw new Error(`Zernio ${res.status}: ${data.error?.message ?? data.message ?? data.error ?? "request failed"}`);
  }
  return data as T;
}

/** The AutoDM fields that map onto a Zernio automation. */
export type AutomationFields = {
  id: number;
  name: string;
  trigger_type: "comment" | "dm" | "story_reply";
  media_id: string | null;
  media_caption: string | null;
  match_mode: "exact" | "contains" | "any";
  initial_message: string;
  button_label: string;
  comment_replies: string;
  require_follow: number;
  content_message: string;
  content_url: string | null;
  link_button_label: string;
  not_following_message: string;
  is_active: number;
};

/** Postback payload on the opening DM's button; the tap comes back to /api/webhooks/zernio. */
export const GATE_PREFIX = "autodm:gate:";

/**
 * AutoDM's flow is: opening DM with a button → tap → (follow check) → content DM with a link button.
 * Gate on: Zernio's own gate trusts a cached "follower" and skips the tap, so instead Zernio sends
 * everyone the opening DM with a postback button and AutoDM re-checks the follow live on each tap.
 * Gate off: Zernio's tapToUnlock is exactly the flow (opening DM, content on tap, no check).
 */
// AutoDM writes {username} (rendered as @handle); Zernio's placeholder is {{username}}.
const tpl = (s: string) => s.replace(/(?<!\{)\{username\}(?!\})/g, "@{{username}}");

export function toZernio(a: AutomationFields, keywords: string[]) {
  const replies = a.comment_replies.split("\n").map((s) => tpl(s.trim())).filter(Boolean);
  const followGate = { message: tpl(a.initial_message).slice(0, 640), buttonLabel: a.button_label.slice(0, 20) };
  return {
    name: a.name,
    trigger: a.trigger_type === "story_reply" ? "story_reply" : "comment",
    ...(a.trigger_type === "comment" && a.media_id ? { platformPostId: a.media_id, postTitle: a.media_caption ?? undefined } : {}),
    keywords: a.match_mode === "any" ? [] : keywords, // empty = any comment
    matchMode: a.match_mode === "exact" ? "exact" : "contains",
    ...(replies.length ? { commentReply: replies[0], commentReplyVariations: replies.slice(1, 6) } : {}),
    ...(a.require_follow
      ? {
          dmMessage: tpl(a.initial_message).slice(0, 640),
          buttons: [{ type: "postback", title: a.button_label.slice(0, 20), payload: GATE_PREFIX + a.id }],
          audience: { followerStatus: "any", whenUnknown: "send" }, // explicit, so a PATCH clears an older gate
        }
      : {
          dmMessage: tpl(a.content_message).slice(0, a.content_url ? 640 : 1000),
          buttons: contentButtons(a),
          audience: { tapToUnlock: true },
          followGate,
        }),
    isActive: !!a.is_active,
  };
}

export const contentButtons = (a: Pick<AutomationFields, "content_url" | "link_button_label">) =>
  a.content_url ? [{ type: "url", title: a.link_button_label.slice(0, 20), url: a.content_url }] : [];

/** Live follow check (refresh=true skips Zernio's cache). null = Instagram wouldn't say. */
export async function followStatus(accountId: string, igsid: string): Promise<{ isFollower: boolean | null; reason?: string | null }> {
  const r = await z<{ isFollower: boolean | null; unavailableReason?: string | null }>(`/accounts/${accountId}/follow-status/${encodeURIComponent(igsid)}?refresh=true`);
  return { isFollower: r.isFollower, reason: r.unavailableReason };
}

export type DmButton = { type: string; title: string; url?: string; payload?: string };

export async function sendDm(conversationId: string, accountId: string, message: string, buttons: DmButton[] = []): Promise<string | null> {
  const r = await z<{ data?: { messageId?: string; id?: string } }>(`/inbox/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ accountId, message: message.slice(0, buttons.length ? 640 : 1000), ...(buttons.length ? { buttons } : {}) }),
  });
  return r.data?.messageId ?? r.data?.id ?? null;
}

type ZAccount = { _id: string; platform: string; profileId?: string | { _id: string } };

/** The one connected Instagram account in Zernio (this app manages a single account). */
async function instagramAccount(): Promise<{ accountId: string; profileId: string }> {
  const { accounts = [] } = await z<{ accounts?: ZAccount[] }>("/accounts?platform=instagram");
  const acc = accounts.find((a) => a.platform === "instagram");
  if (!acc) throw new Error("No Instagram account is connected in Zernio yet. Connect it at zernio.com first.");
  let profileId = typeof acc.profileId === "string" ? acc.profileId : acc.profileId?._id;
  if (!profileId) {
    const { profiles = [] } = await z<{ profiles?: { _id: string; isDefault?: boolean }[] }>("/profiles");
    profileId = (profiles.find((p) => p.isDefault) ?? profiles[0])?._id;
  }
  if (!profileId) throw new Error("No Zernio profile found");
  return { accountId: acc._id, profileId };
}

/** Create or update the mirrored automation; returns its Zernio id. */
export async function syncAutomation(a: AutomationFields, keywords: string[], zernioId: string | null): Promise<string> {
  if (a.trigger_type === "dm") throw new Error("DM-keyword automations aren't supported through Zernio yet; use a comment or story-reply trigger");
  const body = toZernio(a, keywords);
  if (zernioId) {
    await z(`/comment-automations/${zernioId}`, { method: "PATCH", body: JSON.stringify(body) });
    return zernioId;
  }
  const r = await z<{ automation: { id: string } }>("/comment-automations", { method: "POST", body: JSON.stringify({ ...body, ...(await instagramAccount()) }) });
  return r.automation.id;
}

export type ZernioLog = {
  id: string;
  commenterId?: string;
  commenterUsername?: string;
  commentText?: string;
  source?: string;
  status: string; // sent | failed | skipped | pending …
  error?: string | null;
  platformError?: string | null;
  audienceOutcome?: string | null; // passed | gate_passed | skipped …
  gateButtonStatus?: string | null;
  commenterIsFollower?: boolean | null;
  commentReplyStatus?: string | null;
  clickCount?: number;
  createdAt: string;
};

/** Latest trigger log rows for one automation (newest first, as Zernio returns them). */
export async function zernioLogs(zernioId: string): Promise<ZernioLog[]> {
  const r = await z<{ logs?: ZernioLog[] }>(`/comment-automations/${zernioId}/logs`);
  return r.logs ?? [];
}

export async function setZernioActive(zernioId: string, isActive: boolean) {
  await z(`/comment-automations/${zernioId}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
}

export async function deleteZernioAutomation(zernioId: string) {
  await z(`/comment-automations/${zernioId}`, { method: "DELETE" }).catch((e: Error) => {
    if (!e.message.startsWith("Zernio 404")) throw e; // already gone on Zernio's side is fine
  });
}
