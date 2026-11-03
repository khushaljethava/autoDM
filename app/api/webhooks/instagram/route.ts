import type { NextRequest } from "next/server";
import { ingest, type WebhookBody } from "@/lib/engine";
import { verifySignature } from "@/lib/match";

export const maxDuration = 60;

// Meta's subscription handshake. Separate from owner auth: Meta is an external caller.
export function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;
  const ok = p.get("hub.mode") === "subscribe" && !!expected && p.get("hub.verify_token") === expected;
  return ok ? new Response(p.get("hub.challenge") ?? "") : new Response("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const raw = Buffer.from(await req.arrayBuffer());
  // Instagram-Login apps can sign with the Instagram app secret or the Facebook app secret.
  const secrets = [process.env.META_APP_SECRET, process.env.META_FB_APP_SECRET].map((s) => s?.trim()).filter((s): s is string => !!s);
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), secrets)) return new Response("Invalid signature", { status: 401 });

  let body: WebhookBody;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  await ingest(body); // throws only if the DB is down → 500 → Meta redelivers
  return new Response("EVENT_RECEIVED");
}
