import { run } from "@/lib/db";

export async function GET() {
  const db = await run("SELECT 1").then(() => true, () => false);
  return Response.json({ ok: db, db }, { status: db ? 200 : 503 });
}
