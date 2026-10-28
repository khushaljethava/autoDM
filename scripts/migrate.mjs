// Applies migrations/*.sql in order, then creates the owner once from OWNER_USERNAME + OWNER_PASSWORD_HASH.
// Run: npm run db:migrate   (reads .env.local; point DATABASE_URL at Turso for production)
import { readdirSync, readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const db = createClient({ url: process.env.DATABASE_URL ?? "file:local.db", authToken: process.env.DATABASE_AUTH_TOKEN });

await db.execute("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)");
const done = new Set((await db.execute("SELECT name FROM _migrations")).rows.map((r) => r.name));
for (const file of readdirSync("migrations").filter((f) => f.endsWith(".sql")).sort()) {
  if (done.has(file)) continue;
  await db.executeMultiple(readFileSync(`migrations/${file}`, "utf8"));
  await db.execute({ sql: "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)", args: [file, Date.now()] });
  console.log("applied", file);
}

const { OWNER_USERNAME: username, OWNER_PASSWORD_HASH: hash } = process.env;
if (username && hash) {
  if (!hash.startsWith("$argon2id$")) throw new Error("OWNER_PASSWORD_HASH must be an argon2id hash (npm run hash-password)");
  // id is pinned to 1 by a CHECK constraint, so this can never create a second owner.
  const r = await db.execute({
    sql: "INSERT INTO owner_users (id, username, password_hash, created_at, updated_at) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING",
    args: [username, hash, Date.now(), Date.now()],
  });
  console.log(r.rowsAffected ? `owner "${username}" created; now remove OWNER_USERNAME/OWNER_PASSWORD_HASH from your env` : "owner already exists; OWNER_* ignored (remove them)");
} else {
  const n = (await db.execute("SELECT COUNT(*) AS n FROM owner_users")).rows[0].n;
  if (!n) console.log("no owner yet: set OWNER_USERNAME and OWNER_PASSWORD_HASH and rerun");
}
console.log("done");
