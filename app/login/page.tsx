// Ported from Stitch screen "AutoDM Owner Sign In" (projects/17393825602441053444/screens/4ff09eab1c8141d9ac0e8743b0e35969).
import { redirect } from "next/navigation";
import pkg from "@/package.json";
import { getOwner } from "@/lib/auth";
import { run } from "@/lib/db";
import { loginAction } from "@/app/actions";
import { Icon } from "@/components/Icon";

const field =
  "w-full rounded-lg border border-zinc-800 bg-zinc-950/80 px-3.5 py-2.5 pr-10 text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600 focus:border-accent focus:ring-1 focus:ring-accent";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getOwner()) redirect("/");
  const { error } = await searchParams;
  const healthy = await run("SELECT 1").then(() => true, () => false);

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div className="size-[580px] rounded-full bg-pink-600/10 blur-[130px]" />
        <div className="absolute size-[320px] rounded-full bg-purple-600/10 blur-[90px]" />
      </div>
      <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:24px_24px] opacity-25" />

      <div className="w-full max-w-[400px] rounded-2xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-md">
        <header className="flex flex-col items-center text-center">
          <div className="mb-4 grid size-12 place-items-center rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white shadow-lg shadow-pink-500/20">
            <Icon name="send" className="size-6 -rotate-12" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">AutoDM</h1>
            <span className="rounded border border-zinc-700/60 bg-zinc-800/90 px-1.5 py-0.5 text-[10px] font-medium uppercase leading-none tracking-wide text-zinc-400">Internal</span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">Owner sign in</p>
        </header>

        {error && (
          <div role="alert" className="mt-6 flex items-start gap-2.5 rounded-lg border border-red-800/60 bg-red-950/40 p-3 text-xs leading-relaxed text-red-300">
            <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-red-400" />
            Invalid credentials, or too many attempts. Try again later.
          </div>
        )}

        <form action={loginAction} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="username" className="block text-xs font-medium text-zinc-300">Username</label>
            <div className="relative">
              <input id="username" name="username" required autoComplete="username" className={field} />
              <Icon name="user" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-medium text-zinc-300">Password</label>
            <div className="relative">
              <input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••••••" className={`${field} font-mono`} />
              <Icon name="lock" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
            </div>
          </div>
          <div className="pt-2">
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-pink-600/25 transition-all hover:bg-[#d02560] active:scale-[0.99]">
              Sign in <Icon name="arrow" />
            </button>
          </div>
        </form>

        <footer className="mt-7 border-t border-zinc-800/70 pt-5 text-center text-xs tracking-wide text-zinc-500">Private instance · no public sign-ups</footer>
      </div>

      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-zinc-800/80 bg-zinc-900/60 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur-sm">
        <span className="relative flex size-2">
          {healthy && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
          <span className={`relative inline-flex size-2 rounded-full ${healthy ? "bg-emerald-500" : "bg-red-500"}`} />
        </span>
        <span className="font-mono text-[11px] tracking-tight">{healthy ? "Instance healthy" : "Database unreachable"} · v{pkg.version}</span>
      </div>
    </main>
  );
}
