import { createClient, type InValue } from "@libsql/client";

// Local dev: file:local.db. Production: Turso (libsql://...), never a file on Vercel.
export const db = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export async function all<T>(sql: string, args: InValue[] = []): Promise<T[]> {
  return (await db.execute({ sql, args })).rows as unknown as T[];
}

export async function one<T>(sql: string, args: InValue[] = []): Promise<T | undefined> {
  return (await all<T>(sql, args))[0];
}

export function run(sql: string, args: InValue[] = []) {
  return db.execute({ sql, args });
}
