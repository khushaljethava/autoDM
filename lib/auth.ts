import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { verify } from "@node-rs/argon2";
import { one, run } from "./db";
import { sha256 } from "./crypto";

const COOKIE = "sid";
const TTL_MS = 7 * 24 * 3600_000;
const FAIL_WINDOW_MS = 15 * 60_000;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_GLOBAL = 30; // ponytail: IP rotation still hits this; Argon2 makes guessing slow anyway

export type Owner = { id: number; username: string };

export async function getOwner(): Promise<Owner | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const owner = await one<Owner>(
    "SELECT o.id, o.username FROM sessions s JOIN owner_users o ON o.id = s.owner_id WHERE s.id = ? AND s.expires_at > ?",
    [sha256(token), Date.now()],
  );
  return owner ?? null;
}

/** Call at the top of every protected page and server action. */
export async function requireOwner(): Promise<Owner> {
  const owner = await getOwner();
  if (!owner) redirect("/login");
  return owner;
}

export async function createSession(ownerId: number) {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  await run("INSERT INTO sessions (id, owner_id, expires_at, created_at) VALUES (?, ?, ?, ?)", [sha256(token), ownerId, now + TTL_MS, now]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await run("DELETE FROM sessions WHERE id = ?", [sha256(token)]);
  jar.delete(COOKIE);
}

/** Returns false for bad credentials and for rate-limited attempts alike (generic failure). */
export async function login(username: string, password: string): Promise<boolean> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "local";
  const since = Date.now() - FAIL_WINDOW_MS;
  const counts = await one<{ ip_fails: number | null; all_fails: number }>(
    "SELECT SUM(ip = ?) AS ip_fails, COUNT(*) AS all_fails FROM login_failures WHERE at > ?",
    [ip, since],
  );
  if ((counts?.ip_fails ?? 0) >= MAX_FAILS_PER_IP || (counts?.all_fails ?? 0) >= MAX_FAILS_GLOBAL) return false;

  const owner = await one<{ id: number; password_hash: string }>("SELECT id, password_hash FROM owner_users WHERE username = ?", [username]);
  const ok = owner ? await verify(owner.password_hash, password).catch(() => false) : false;
  if (!owner || !ok) {
    await run("INSERT INTO login_failures (ip, at) VALUES (?, ?)", [ip, Date.now()]);
    return false;
  }
  await createSession(owner.id);
  return true;
}
