// Ported from Stitch screen "AutoDM Settings" (projects/17393825602441053444/screens/fe5cea2179114531b3a2258df90654f0).
import type { ReactNode } from "react";
import pkg from "@/package.json";
import { one, run } from "@/lib/db";
import { SCOPES, WEBHOOK_FIELDS, type Account } from "@/lib/instagram";
import { changePasswordAction, disconnectInstagram, logoutAction, resubscribeWebhooks } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { ago, Badge, btnDanger, btnGhost, btnPrimary, fmt, input, msAgo, PageHeader, statusTone } from "@/components/ui";

function Panel({ icon, title, aside, footer, children, className = "" }: { icon: Parameters<typeof Icon>[0]["name"]; title: string; aside?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col justify-between gap-5 rounded-xl border border-border bg-card p-5 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"><Icon name={icon} className="size-4 text-pink-400" />{title}</h2>
          {aside}
        </div>
        {children}
      </div>
      {footer && <div className="flex flex-wrap items-center gap-2.5 border-t border-border pt-3">{footer}</div>}
    </section>
  );
}

const Row = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="flex items-start justify-between gap-4 py-2.5 text-xs">
    <dt className="text-muted">{k}</dt>
    <dd className="text-right">{children}</dd>
  </div>
);
const Chip = ({ children, dot }: { children: ReactNode; dot?: boolean }) => (
  <span className="inline-flex items-center gap-1 rounded border border-border bg-raised px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
    {dot && <span className="size-1.5 rounded-full bg-emerald-500" />}
    {children}
  </span>
);
const Configured = ({ ok }: { ok: boolean }) =>
  ok ? <span className="inline-flex items-center gap-1 font-medium text-emerald-400"><Icon name="check" className="size-3.5" />configured</span> : <Badge tone="red">missing</Badge>;

const RAILS = [
  ["180 DMs/hour cap", "Keeps you under Meta's ~200/hour messaging limit, leaving room for your own DMs."],
  ["24h pause on Meta policy block", "If Instagram returns a spam/policy block (error 368), all sends stop for 24 hours."],
  ["Fail-closed follower check", "If follower status can't be confirmed, the content is held back and the person can retry."],
  ["Duplicate-proof sends", "Webhook redeliveries are deduplicated, and each person gets the content once per automation."],
];

export default async function Settings({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const acc = await one<Account>("SELECT * FROM instagram_accounts WHERE connection_status != 'disconnected' LIMIT 1");
  const lastHook = await one<{ at: number | null }>("SELECT MAX(received_at) AS at FROM webhook_events");
  const dbOk = await run("SELECT 1").then(() => true, () => false);
  let webhookUrl = "Set META_REDIRECT_URI to see it";
  try {
    webhookUrl = `${new URL(process.env.META_REDIRECT_URI ?? "").origin}/api/webhooks/instagram`;
  } catch {}
  const paused = !!acc?.paused_until && acc.paused_until > msAgo(0);
  const hookReady = !!process.env.META_WEBHOOK_VERIFY_TOKEN && !!process.env.META_APP_SECRET;

  return (
    <>
      {msg && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-xs font-medium text-emerald-300">
          <Icon name="check" className="size-4 text-emerald-400" />
          {msg}
        </div>
      )}

      <PageHeader title="Settings" subtitle="Your connected Instagram account, webhook endpoint, password and safety rails." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          icon="user"
          title="Instagram account"
          aside={acc ? <Badge tone={statusTone(acc.connection_status)}>{acc.connection_status === "connected" ? "Connected" : "Needs reconnect"}</Badge> : <Badge>Not connected</Badge>}
          footer={
            <>
              <a href="/api/instagram/connect" className={`${btnPrimary} py-1.5 text-xs`}>{acc ? "Reconnect" : "Connect Instagram"}</a>
              {acc && (
                <>
                  <form action={resubscribeWebhooks}><button className={`${btnGhost} py-1.5 text-xs`}>Resubscribe webhooks</button></form>
                  <form action={disconnectInstagram} className="ml-auto"><button className={`${btnDanger} py-1.5 text-xs`}>Disconnect</button></form>
                </>
              )}
            </>
          }
        >
          {acc ? (
            <>
              <div className="flex items-center gap-3.5 rounded-lg border border-border bg-raised p-3">
                <div className="grid size-10 place-items-center rounded-full border border-zinc-700 bg-zinc-800 font-mono text-sm font-semibold uppercase text-pink-400">{acc.username.slice(0, 2)}</div>
                <div>
                  <p className="text-sm font-semibold">@{acc.username}</p>
                  <p className="font-mono text-[11px] text-muted">ID <span className="text-zinc-300">{acc.instagram_user_id}</span></p>
                </div>
              </div>
              <dl className="divide-y divide-border">
                <Row k="Token validity">
                  <span className="font-medium">Expires {fmt(acc.token_expires_at)}</span>
                  <span className="block text-[10px] text-zinc-500">auto-refreshed by the daily job</span>
                </Row>
                <Row k="Last successful send"><span className="font-mono text-[11px]">{ago(acc.last_api_success_at)}</span></Row>
                {paused && <Row k="Sending"><Badge tone="red">paused until {fmt(acc.paused_until)}</Badge></Row>}
                <Row k="Permissions"><span className="flex max-w-[260px] flex-wrap justify-end gap-1">{SCOPES.split(",").map((s) => <Chip key={s}>{s}</Chip>)}</span></Row>
              </dl>
            </>
          ) : (
            <p className="text-sm text-muted">Connect your Instagram professional account to start automating DMs.</p>
          )}
        </Panel>

        <Panel icon="cable" title="Webhook" aside={<Badge tone={hookReady ? "green" : "red"}>{hookReady ? "Listening" : "Not configured"}</Badge>}>
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Callback URL</p>
            <p className="select-all truncate rounded-lg border border-border bg-raised p-2 font-mono text-xs">{webhookUrl}</p>
          </div>
          <dl className="divide-y divide-border">
            <Row k="Verify token"><Configured ok={!!process.env.META_WEBHOOK_VERIFY_TOKEN} /></Row>
            <Row k="App secret"><Configured ok={!!process.env.META_APP_SECRET} /></Row>
            <Row k="Last event received"><span className="font-mono text-[11px]">{ago(lastHook?.at)}</span></Row>
            <Row k="Subscribed fields"><span className="flex max-w-[280px] flex-wrap justify-end gap-1.5">{WEBHOOK_FIELDS.split(",").map((f) => <Chip key={f} dot={!!acc}>{f}</Chip>)}</span></Row>
          </dl>
        </Panel>

        <Panel icon="lock" title="Change password" aside={<span className="text-[11px] text-zinc-500">Security</span>}>
          <form action={changePasswordAction} className="space-y-3">
            <label className="block space-y-1 text-xs font-medium text-zinc-300">
              Current password
              <input name="current" type="password" required autoComplete="current-password" className={input} />
            </label>
            <label className="block space-y-1 text-xs font-medium text-zinc-300">
              New password
              <input name="next" type="password" required minLength={12} autoComplete="new-password" className={input} />
              <span className="block text-[10px] font-normal text-zinc-500">Min 12 characters. Signs out all other sessions.</span>
            </label>
            <label className="block space-y-1 text-xs font-medium text-zinc-300">
              Confirm new password
              <input name="confirm" type="password" required minLength={12} autoComplete="new-password" className={input} />
            </label>
            <div className="border-t border-border pt-3">
              <button className={`${btnPrimary} py-1.5 text-xs`}>Change password</button>
            </div>
          </form>
        </Panel>

        <Panel
          icon="box"
          title="Application"
          aside={<Chip>v{pkg.version}</Chip>}
          footer={
            <>
              <span className="text-[11px] text-zinc-500">Environment: {process.env.VERCEL_ENV ?? process.env.NODE_ENV}</span>
              <form action={logoutAction} className="ml-auto"><button className={`${btnGhost} py-1.5 text-xs`}>Log out</button></form>
            </>
          }
        >
          <dl className="divide-y divide-border">
            <Row k="Database">{dbOk ? <span className="inline-flex items-center gap-1 font-medium text-emerald-400"><Icon name="check" className="size-3.5" />Healthy</span> : <Badge tone="red">Unreachable</Badge>}</Row>
            <Row k="Daily maintenance"><span className="text-[11px] text-muted">Token refresh, failed-event retries, cleanup at <span className="font-mono text-zinc-300">03:00 UTC</span></span></Row>
          </dl>
        </Panel>
      </div>

      <section className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider"><Icon name="shield" className="size-4 text-pink-400" />Safety rails &amp; Meta compliance</h2>
          <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-400"><span className="size-1.5 rounded-full bg-emerald-500" />Always on</span>
        </div>
        <p className="max-w-3xl text-xs text-muted">Built-in safeguards that keep your account inside Instagram&apos;s limits and spam policies.</p>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {RAILS.map(([title, desc]) => (
            <div key={title} className="space-y-1 rounded-lg border border-border bg-raised p-3.5">
              <p className="flex items-center gap-2 text-xs font-semibold"><Icon name="check" className="size-4 text-emerald-400" />{title}</p>
              <p className="text-[11px] leading-relaxed text-muted">{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
