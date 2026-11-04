// Helpers for POST /api/automations/webhook.
import type { Media } from "./instagram.ts";

/** Shortcode from an Instagram post/Reel link (…/p/ABC/, …/reel/ABC/, …/reels/ABC/, …/tv/ABC/). */
export function shortcode(ref: string): string | null {
  return ref.match(/instagram\.com\/(?:[^/?#]+\/)?(?:p|reels?|tv)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

/**
 * Resolve "post" to a media id: a numeric media id, or a post/Reel link matched against the account's
 * media. A numeric id not in the recent list is still accepted (older posts aren't listed).
 */
export function resolvePost(ref: string, media: Pick<Media, "id" | "permalink" | "caption">[]): { id: string; caption: string | null } | null {
  const r = ref.trim();
  const byId = media.find((m) => m.id === r);
  if (byId) return { id: byId.id, caption: byId.caption ?? null };
  if (/^\d+$/.test(r)) return { id: r, caption: null };
  const code = shortcode(r) ?? (/^[A-Za-z0-9_-]{5,}$/.test(r) ? r : null); // a link, or a bare shortcode
  if (!code) return null;
  const byLink = media.find((m) => shortcode(m.permalink) === code);
  return byLink ? { id: byLink.id, caption: byLink.caption ?? null } : null;
}
