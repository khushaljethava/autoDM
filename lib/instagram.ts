// Instagram API with Instagram Login: every call goes to graph.instagram.com, never graph.facebook.com.
import { decrypt } from "./crypto";

export const GRAPH = "https://graph.instagram.com/v23.0";
export const SCOPES = "instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments";
export const WEBHOOK_FIELDS = "comments,messages,messaging_postbacks";

export class MetaError extends Error {
  constructor(message: string, public code?: number) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const data = await res.json().catch(() => ({}));
  // Graph API errors: { error: { message, code } }. api.instagram.com OAuth errors: { error_message, code }.
  if (!res.ok || data.error) throw new MetaError(data.error?.message ?? data.error_message ?? `HTTP ${res.status}`, data.error?.code ?? data.code);
  return data as T;
}

const q = encodeURIComponent;
const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export type Account = {
  id: number;
  instagram_user_id: string;
  username: string;
  access_token_encrypted: string;
  token_expires_at: number | null;
  connection_status: "connected" | "expired" | "disconnected";
  paused_until: number | null;
  last_api_success_at: number | null;
};
const token = (a: Account) => q(decrypt(a.access_token_encrypted));

export type Recipient = { id: string } | { comment_id: string }; // comment_id = private reply
export type Button = { type: "postback"; title: string; payload: string } | { type: "web_url"; title: string; url: string };
export type Message = { text: string } | ReturnType<typeof buttonMessage>;

/** Button template: text up to 640 chars, up to 3 buttons, titles up to 20 chars. */
export function buttonMessage(text: string, buttons: Button[]) {
  return {
    attachment: {
      type: "template",
      payload: { template_type: "button", text: text.slice(0, 640), buttons: buttons.map((b) => ({ ...b, title: b.title.slice(0, 20) })) },
    },
  };
}

export async function sendMessage(a: Account, recipient: Recipient, message: Message): Promise<string | null> {
  const r = await call<{ message_id?: string }>(`${GRAPH}/${a.instagram_user_id}/messages?access_token=${token(a)}`, json({ recipient, message }));
  return r.message_id ?? null;
}

export async function replyToComment(a: Account, commentId: string, text: string): Promise<string | null> {
  const r = await call<{ id?: string }>(`${GRAPH}/${commentId}/replies?access_token=${token(a)}`, json({ message: text }));
  return r.id ?? null;
}

/**
 * Follower check via the User Profile API. Works only for someone who has messaged the
 * account (a button tap counts). `follows: null` means Meta didn't answer: never a pass.
 */
export async function followsAccount(a: Account, igsid: string): Promise<{ follows: boolean | null; error?: string }> {
  try {
    const r = await call<{ is_user_follow_business?: boolean }>(`${GRAPH}/${igsid}?fields=is_user_follow_business&access_token=${token(a)}`);
    return typeof r.is_user_follow_business === "boolean" ? { follows: r.is_user_follow_business } : { follows: null };
  } catch (e) {
    return { follows: null, error: e instanceof MetaError ? `${e.code ?? "?"}: ${e.message}`.slice(0, 300) : "network error" };
  }
}

export type Media = {
  id: string;
  caption?: string;
  media_type: string;
  media_product_type?: string;
  thumbnail_url?: string;
  media_url?: string;
  permalink: string;
  timestamp: string;
};

export async function listMedia(a: Account): Promise<Media[]> {
  const fields = "id,caption,media_type,media_product_type,thumbnail_url,media_url,permalink,timestamp";
  return (await call<{ data: Media[] }>(`${GRAPH}/${a.instagram_user_id}/media?fields=${fields}&limit=50&access_token=${token(a)}`)).data;
}

// ── OAuth ────────────────────────────────────────────────────────────────────

const env = (k: string) => {
  const v = process.env[k]?.trim(); // pasted dashboard values often carry a trailing newline
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};

export function authorizeUrl(state: string) {
  const p = new URLSearchParams({ client_id: env("META_APP_ID"), redirect_uri: env("META_REDIRECT_URI"), response_type: "code", scope: SCOPES, state, force_reauth: "true" }); // always show IG login so the owner picks the right account
  return `https://www.instagram.com/oauth/authorize?${p}`;
}

/** code → short-lived token → long-lived (~60 day) token. */
export async function exchangeCode(code: string): Promise<{ token: string; expiresAt: number }> {
  const form = new FormData();
  form.append("client_id", env("META_APP_ID"));
  form.append("client_secret", env("META_APP_SECRET"));
  form.append("grant_type", "authorization_code");
  form.append("redirect_uri", env("META_REDIRECT_URI"));
  form.append("code", code);
  const short = await call<{ access_token?: string; data?: { access_token: string }[] }>("https://api.instagram.com/oauth/access_token", { method: "POST", body: form });
  const shortToken = short.data?.[0]?.access_token ?? short.access_token;
  if (!shortToken) throw new MetaError("No access token in OAuth response");
  const long = await call<{ access_token: string; expires_in: number }>(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${q(env("META_APP_SECRET"))}&access_token=${q(shortToken)}`,
  );
  return { token: long.access_token, expiresAt: Date.now() + long.expires_in * 1000 };
}

export async function refreshToken(current: string): Promise<{ token: string; expiresAt: number }> {
  const r = await call<{ access_token: string; expires_in: number }>(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${q(current)}`);
  return { token: r.access_token, expiresAt: Date.now() + r.expires_in * 1000 };
}

/** user_id here is the professional account id that webhooks report as entry.id. */
export function getMe(rawToken: string) {
  return call<{ user_id: string; username: string }>(`${GRAPH}/me?fields=user_id,username&access_token=${q(rawToken)}`);
}

/** Per-account subscription; without it Meta sends no events even if the app webhook is set. */
export async function subscribeWebhooks(igUserId: string, rawToken: string) {
  await call(`${GRAPH}/${igUserId}/subscribed_apps`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ subscribed_fields: WEBHOOK_FIELDS, access_token: rawToken }).toString(),
  });
}
