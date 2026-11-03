import { one } from "@/lib/db";
import { listMedia, type Account, type Media } from "@/lib/instagram";

export async function loadMedia(): Promise<{ media: Media[]; username: string; error?: string }> {
  const acc = await one<Account>("SELECT * FROM instagram_accounts WHERE connection_status = 'connected' LIMIT 1");
  if (!acc) return { media: [], username: "you", error: "no Instagram account connected" };
  try {
    return { media: await listMedia(acc), username: acc.username };
  } catch (e) {
    return { media: [], username: acc.username, error: e instanceof Error ? e.message : "unknown error" };
  }
}
