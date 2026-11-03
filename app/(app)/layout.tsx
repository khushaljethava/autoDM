import Link from "next/link";
import type { ReactNode } from "react";
import { requireOwner } from "@/lib/auth";
import { one } from "@/lib/db";
import { logoutAction } from "@/app/actions";
import { NavLink } from "@/components/NavLink";
import { Icon } from "@/components/Icon";
import { btnPrimary } from "@/components/ui";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await requireOwner();
  const acc = await one<{ username: string; connection_status: string }>("SELECT username, connection_status FROM instagram_accounts WHERE connection_status != 'disconnected' LIMIT 1");
  const active = await one<{ n: number }>("SELECT COUNT(*) AS n FROM automations WHERE is_active = 1");
  const connected = acc?.connection_status === "connected";

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="flex flex-col gap-6 border-b border-border bg-card p-4 md:sticky md:top-0 md:h-screen md:w-64 md:border-b-0 md:border-r">
        <Link href="/" className="flex items-center gap-3 px-1">
          <span className="grid size-9 place-items-center rounded-lg bg-[linear-gradient(135deg,#feda75,#fa7e1e_25%,#d62976_50%,#962fbf_75%,#4f5bd5)] text-white">
            <Icon name="send" />
          </span>
          <span>
            <span className="block font-semibold leading-tight">AutoDM</span>
            <span className="block text-xs text-muted">Instagram automation</span>
          </span>
        </Link>

        <Link href="/settings" className="flex items-center gap-3 rounded-xl border border-border bg-raised p-3 hover:border-white/15">
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full border border-border bg-card text-xs font-semibold uppercase">
            {acc ? acc.username.slice(0, 2) : "?"}
            <span className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-raised ${connected ? "bg-emerald-500" : acc ? "bg-red-500" : "bg-zinc-500"}`} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{acc ? `@${acc.username}` : "No account"}</span>
            <span className={`block text-xs ${connected ? "text-emerald-400" : acc ? "text-red-400" : "text-muted"}`}>
              {connected ? "Connected" : acc ? "Needs reconnect" : "Connect Instagram"}
            </span>
          </span>
        </Link>

        <nav className="flex gap-1 overflow-x-auto md:flex-col">
          <NavLink href="/"><Icon name="grid" /> Overview</NavLink>
          <NavLink href="/automations">
            <Icon name="zap" /> Automations
            {!!active?.n && <span className="ml-auto rounded-md border border-border bg-raised px-1.5 text-xs text-muted">{active.n}</span>}
          </NavLink>
          <NavLink href="/logs"><Icon name="list" /> Activity logs</NavLink>
          <NavLink href="/settings"><Icon name="settings" /> Settings</NavLink>
        </nav>

        <div className="mt-auto hidden space-y-2 border-t border-border pt-4 md:block">
          <Link href="/automations/new" className={`${btnPrimary} w-full`}><Icon name="plus" /> New automation</Link>
          <form action={logoutAction}>
            <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-foreground"><Icon name="logout" /> Log out</button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 flex-1 space-y-6 p-6 md:p-10">
        {acc?.connection_status === "expired" && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            Instagram access expired, so automations are paused. <a href="/api/instagram/connect" className="font-medium underline">Reconnect</a>
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
