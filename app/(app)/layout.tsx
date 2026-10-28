import Link from "next/link";
import type { ReactNode } from "react";
import { requireOwner } from "@/lib/auth";
import { one } from "@/lib/db";
import { logoutAction } from "@/app/actions";

const nav = [
  ["/", "Overview"],
  ["/automations", "Automations"],
  ["/logs", "Activity logs"],
  ["/settings", "Settings"],
] as const;

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireOwner();
  const acc = await one<{ username: string; connection_status: string }>("SELECT username, connection_status FROM instagram_accounts WHERE connection_status != 'disconnected' LIMIT 1");
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="border-b border-black/10 p-4 md:w-56 md:border-b-0 md:border-r dark:border-white/10">
        <div className="mb-6 px-2">
          <p className="font-semibold">AutoDM</p>
          <p className="truncate text-xs text-black/50 dark:text-white/50">{acc ? `@${acc.username}` : "No account connected"}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-md px-2 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/10">
              {label}
            </Link>
          ))}
          <form action={logoutAction}>
            <button className="w-full whitespace-nowrap rounded-md px-2 py-1.5 text-left text-sm text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10">Log out</button>
          </form>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-6 md:p-10">
        {acc?.connection_status === "expired" && (
          <p className="mb-6 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            Instagram access expired; automations are paused. <a href="/api/instagram/connect" className="underline">Reconnect</a>
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
