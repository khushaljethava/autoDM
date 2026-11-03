import type { ReactNode } from "react";

export const DAY = 24 * 3600_000;

const dateFmt = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: process.env.APP_TIMEZONE || "UTC" });
export const fmt = (ms?: number | null) => (ms ? dateFmt.format(ms) : "—");

/** "2m ago" for recent rows, full date after a day. */
export function ago(ms?: number | null) {
  if (!ms) return "—";
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return fmt(ms);
}

/** Timestamp `ms` milliseconds ago. Server pages render per request, so reading the clock is intended. */
export const msAgo = (ms: number) => Date.now() - ms;

export const pct =(n: number, d: number) => (d ? `${((n / d) * 100).toFixed(1)}%` : "—");

export const input =
  "w-full rounded-lg border border-border bg-raised px-3 py-2 text-sm outline-none placeholder:text-muted/60 focus:border-accent/60 focus:ring-2 focus:ring-accent/20";
export const btn = "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition";
export const btnPrimary = `${btn} bg-accent text-white hover:brightness-110`;
export const btnGhost = `${btn} border border-border bg-raised hover:bg-white/5`;
export const btnDanger = `${btn} border border-red-500/30 text-red-400 hover:bg-red-500/10`;

export function Card({ title, subtitle, action, children, className = "" }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const tones = {
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  red: "border-red-500/30 bg-red-500/10 text-red-400",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  blue: "border-sky-500/30 bg-sky-500/10 text-sky-400",
  gray: "border-border bg-raised text-muted",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export const statusTone = (s: string): Tone =>
  ["following", "completed", "connected"].includes(s) ? "green"
  : s === "sent" ? "blue"
  : ["failed", "expired"].includes(s) ? "red"
  : ["pending", "not_following", "unknown", "processing"].includes(s) ? "amber"
  : "gray";

/** Content delivered reads as the success state; other sends are just "sent". */
export function MessageStatus({ type, status }: { type: string; status: string }) {
  if (status === "sent" && type === "content") return <Badge tone="green">Delivered</Badge>;
  if (status === "sent" && type === "not_following") return <Badge tone="amber">Waiting for follow</Badge>;
  return <Badge tone={statusTone(status)}>{status[0].toUpperCase() + status.slice(1)}</Badge>;
}

export const MESSAGE_LABEL: Record<string, string> = {
  initial: "Opening DM",
  comment_reply: "Public reply",
  content: "Content",
  not_following: "Not-following prompt",
  error: "Verification error",
};

export function Keyword({ children }: { children: ReactNode }) {
  return <span className="inline-block rounded border border-border bg-raised px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide">{children}</span>;
}

export function Flash({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm">{msg}</p>;
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: boolean }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-y border-border text-xs text-muted">
          <tr>{head.map((h) => <th key={h} className="whitespace-nowrap px-5 py-2.5 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-border">{children}</tbody>
      </table>
      {empty && <p className="px-5 py-10 text-center text-sm text-muted">Nothing yet.</p>}
    </div>
  );
}

export const td = "px-5 py-3 align-middle";

/** CSS-only switch; submits "on" like a checkbox. */
export function Toggle({ name, defaultChecked, label }: { name: string; defaultChecked?: boolean; label: string }) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} aria-label={label} className="peer sr-only" />
      <span className="h-5 w-9 rounded-full bg-zinc-700 transition after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition peer-checked:bg-accent peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/40" />
    </label>
  );
}

/** Small metric card used on list pages (Stitch "bento" summary). */
export function Metric({ label, value, note, tone }: { label: string; value: number; note?: string; tone?: Tone }) {
  const color = tone === "amber" ? "text-amber-400" : tone === "red" ? "text-red-400" : "";
  return (
    <section className="flex items-end justify-between gap-3 rounded-xl border border-border bg-card p-5">
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${value ? color : ""}`}>{value.toLocaleString()}</p>
      </div>
      {note && <span className={`rounded-md border px-2 py-0.5 text-xs ${tones[tone ?? "green"]}`}>{note}</span>}
    </section>
  );
}

export const countChip = "rounded-full border border-border bg-raised px-2 py-0.5 font-mono text-[11px] font-normal text-muted";
