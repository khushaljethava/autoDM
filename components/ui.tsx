import type { ReactNode } from "react";

export const DAY = 24 * 3600_000;

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.APP_TIMEZONE || "UTC" });
export const fmt = (ms?: number | null) => (ms ? dateFmt.format(ms) : "—");

export const input =
  "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/15 dark:focus:border-white/40";
export const btn = "inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition";
export const btnPrimary = `${btn} bg-foreground text-background hover:opacity-90`;
export const btnGhost = `${btn} border border-black/15 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10`;
export const btnDanger = `${btn} border border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400`;

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-black/10 p-5 dark:border-white/10 ${className}`}>
      {title && <h2 className="mb-4 text-sm font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

const tones = {
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  red: "bg-red-500/15 text-red-700 dark:text-red-300",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  gray: "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60",
};
export function Badge({ tone = "gray", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export const statusTone = (s: string): keyof typeof tones =>
  ["sent", "following", "completed", "connected"].includes(s) ? "green" : ["failed", "expired"].includes(s) ? "red" : ["pending", "not_following", "unknown", "processing"].includes(s) ? "amber" : "gray";

export function Flash({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mb-6 rounded-md border border-black/10 bg-black/5 px-4 py-3 text-sm dark:border-white/10 dark:bg-white/5">{msg}</p>;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-black/50 dark:text-white/50">{hint}</span>}
    </label>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-black/50 dark:text-white/50">
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-black/5 dark:divide-white/5">{children}</tbody>
      </table>
      {empty && <p className="px-3 py-6 text-center text-sm text-black/50 dark:text-white/50">Nothing yet.</p>}
    </div>
  );
}

export const td = "px-3 py-2 align-top";
