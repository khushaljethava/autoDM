import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { authorizeUrl } from "@/lib/instagram";

export async function GET() {
  await requireOwner();
  const state = randomBytes(16).toString("hex");
  (await cookies()).set("ig_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 600 });
  redirect(authorizeUrl(state));
}
