import { redirect } from "next/navigation";
import { getOwner } from "@/lib/auth";
import { loginAction } from "@/app/actions";
import { btnPrimary, Field, input } from "@/components/ui";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getOwner()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form action={loginAction} className="w-full max-w-sm space-y-5 rounded-xl border border-black/10 p-8 dark:border-white/10">
        <div>
          <h1 className="text-lg font-semibold">AutoDM</h1>
          <p className="text-sm text-black/50 dark:text-white/50">Owner sign in</p>
        </div>
        {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">Invalid credentials, or too many attempts. Try again later.</p>}
        <Field label="Username">
          <input name="username" required autoComplete="username" className={input} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" required autoComplete="current-password" className={input} />
        </Field>
        <button className={`${btnPrimary} w-full`}>Sign in</button>
      </form>
    </main>
  );
}
