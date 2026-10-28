import type { ReactNode } from "react";
import pkg from "@/package.json";
import { one, run } from "@/lib/db";
import type { Account } from "@/lib/instagram";
import { changePasswordAction, disconnectInstagram, logoutAction, resubscribeWebhooks } from "@/app/actions";
import { Badge, btnDanger, btnGhost, btnPrimary, Card, Field, Flash, fmt, input, statusTone } from "@/components/ui";

const Row = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm">
    <dt className="text-black/50 dark:text-white/50">{k}</dt>
    <dd className="text-right">{children}</dd>
  </div>
);

export default async function Settings({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams;
  const acc = await one<Account>("SELECT * FROM instagram_accounts WHERE connection_status != 'disconnected' LIMIT 1");
  const lastHook = await one<{ at: number | null }>("SELECT MAX(received_at) AS at FROM webhook_events");
  const dbOk = await run("SELECT 1").then(() => true, () => false);
  let webhookUrl = "set META_REDIRECT_URI";
  try {
    webhookUrl = `${new URL(process.env.META_REDIRECT_URI ?? "").origin}/api/webhooks/instagram`;
  } catch {}
  const paused = !!acc?.paused_until && acc.paused_until > Date.now();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <Flash msg={msg} />

      <Card title="Instagram account">
        {acc ? (
          <dl className="mb-4 divide-y divide-black/5 dark:divide-white/5">
            <Row k="Username">@{acc.username}</Row>
            <Row k="Account ID"><code className="text-xs">{acc.instagram_user_id}</code></Row>
            <Row k="Status">
              <Badge tone={statusTone(acc.connection_status)}>{acc.connection_status}</Badge>
              {paused && <> <Badge tone="red">sending paused until {fmt(acc.paused_until)}</Badge></>}
            </Row>
            <Row k="Token expires">{fmt(acc.token_expires_at)} <span className="text-xs text-black/50 dark:text-white/50">(auto-refreshed)</span></Row>
            <Row k="Last successful send">{fmt(acc.last_api_success_at)}</Row>
          </dl>
        ) : (
          <p className="mb-4 text-sm">No account connected.</p>
        )}
        <div className="flex flex-wrap gap-2">
          <a href="/api/instagram/connect" className={btnPrimary}>{acc ? "Reconnect" : "Connect Instagram"}</a>
          {acc && (
            <>
              <form action={resubscribeWebhooks}><button className={btnGhost}>Resubscribe webhooks</button></form>
              <form action={disconnectInstagram}><button className={btnDanger}>Disconnect</button></form>
            </>
          )}
        </div>
      </Card>

      <Card title="Webhook">
        <dl className="divide-y divide-black/5 dark:divide-white/5">
          <Row k="Callback URL"><code className="break-all text-xs">{webhookUrl}</code></Row>
          <Row k="Verify token">{process.env.META_WEBHOOK_VERIFY_TOKEN ? "configured" : <Badge tone="red">missing</Badge>}</Row>
          <Row k="App secret">{process.env.META_APP_SECRET ? "configured" : <Badge tone="red">missing</Badge>}</Row>
          <Row k="Last event received">{fmt(lastHook?.at)}</Row>
        </dl>
      </Card>

      <Card title="Change password">
        <form action={changePasswordAction} className="space-y-4">
          <Field label="Current password"><input name="current" type="password" required autoComplete="current-password" className={input} /></Field>
          <Field label="New password" hint="At least 12 characters. Signs out other sessions.">
            <input name="next" type="password" required minLength={12} autoComplete="new-password" className={input} />
          </Field>
          <button className={btnPrimary}>Change password</button>
        </form>
      </Card>

      <Card title="Application">
        <dl className="mb-4 divide-y divide-black/5 dark:divide-white/5">
          <Row k="Database">{dbOk ? <Badge tone="green">healthy</Badge> : <Badge tone="red">unreachable</Badge>}</Row>
          <Row k="Version">{pkg.version}</Row>
        </dl>
        <form action={logoutAction}><button className={btnGhost}>Log out</button></form>
      </Card>
    </div>
  );
}
