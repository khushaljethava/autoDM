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

/**
 * AutoDM's flow is: opening DM with a button → tap → (follow check) → content DM with a link button.
 * Zernio's follow gate is exactly that: followGate.message + button first, real dmMessage on the tap.
 */
// AutoDM writes {username} (rendered as @handle); Zernio's placeholder is {{username}}.
const tpl = (s: string) => s.replace(/(?<!\{)\{username\}(?!\})/g, "@{{username}}");

export function toZernio(a: AutomationFields, keywords: string[]) {
  const replies = a.comment_replies.split("\n").map((s) => tpl(s.trim())).filter(Boolean);
  const followGate = { message: tpl(a.initial_message).slice(0, 640), buttonLabel: a.button_label.slice(0, 20), ...(a.require_follow ? { notFollowingMessage: tpl(a.not_following_message).slice(0, 1000) } : {}) };
  return {
    name: a.name,
    trigger: a.trigger_type === "story_reply" ? "story_reply" : "comment",
    ...(a.trigger_type === "comment" && a.media_id ? { platformPostId: a.media_id, postTitle: a.media_caption ?? undefined } : {}),
    keywords: a.match_mode === "any" ? [] : keywords, // empty = any comment
    matchMode: a.match_mode === "exact" ? "exact" : "contains",
    dmMessage: tpl(a.content_message).slice(0, a.content_url ? 640 : 1000),
    buttons: a.content_url ? [{ type: "url", title: a.link_button_label.slice(0, 20), url: a.content_url }] : [],
    ...(replies.length ? { commentReply: replies[0], commentReplyVariations: replies.slice(1, 6) } : {}),
    // Gate on: verify the follow on tap. Gate off: still send the opening DM first, content on tap.
    audience: a.require_follow ? { followerStatus: "follower", whenUnknown: "verify" } : { tapToUnlock: true },
    followGate,
    isActive: !!a.is_active,
  };
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

export async function setZernioActive(zernioId: string, isActive: boolean) {
  await z(`/comment-automations/${zernioId}`, { method: "PATCH", body: JSON.stringify({ isActive }) });
}

export async function deleteZernioAutomation(zernioId: string) {
  await z(`/comment-automations/${zernioId}`, { method: "DELETE" }).catch((e: Error) => {
    if (!e.message.startsWith("Zernio 404")) throw e; // already gone on Zernio's side is fine
  });
}
