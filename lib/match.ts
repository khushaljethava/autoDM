// Pure helpers (no app imports) so `node --test` can run them directly.
import { createHmac, timingSafeEqual } from "node:crypto";

export type MatchMode = "exact" | "contains" | "any";

const EDGE_PUNCT = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Returns the keyword that matched, "*" for mode "any", or null. Case-insensitive. */
export function matchKeyword(text: string, keywords: string[], mode: MatchMode): string | null {
  const t = text.trim().toLowerCase();
  if (!t) return null;
  if (mode === "any") return "*";
  for (const raw of keywords) {
    const k = raw.trim().toLowerCase();
    if (!k) continue;
    const hit =
      mode === "exact"
        ? t.replace(EDGE_PUNCT, "") === k // "Guide!" and "guide 🙏" still count as exact
        : new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(k)}(?![\\p{L}\\p{N}])`, "u").test(t); // whole word
    if (hit) return raw.trim();
  }
  return null;
}

export function parseKeywords(input: string): string[] {
  return [...new Set(input.split(/[,\n]/).map((k) => k.trim()).filter(Boolean))];
}

/** `{username}` → `@handle`; dropped cleanly when the handle is unknown (DM events don't carry it). */
export function render(text: string, username?: string | null): string {
  return username
    ? text.replaceAll("{username}", `@${username.replace(/^@/, "")}`)
    : text.replace(/ ?\{username\}/g, "").trim();
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Meta signs the raw body with HMAC-SHA256 (`X-Hub-Signature-256: sha256=<hex>`). */
export function verifySignature(raw: Buffer | string, header: string | null, secrets: string[]): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const got = Buffer.from(header.slice(7), "hex");
  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret).update(raw).digest();
    return expected.length === got.length && timingSafeEqual(expected, got);
  });
}
