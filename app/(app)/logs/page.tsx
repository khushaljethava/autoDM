// Ported from Stitch screen "AutoDM Activity Logs" (projects/17393825602441053444/screens/45811f2c7ffa4016a74310ce3f1825d7).
import Link from "next/link";
import { all, one } from "@/lib/db";
import { retryFailedEvents } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { Badge, btnGhost, countChip, fmt, Keyword, MESSAGE_LABEL, MessageStatus, Metric, msAgo, PageHeader, pct, statusTone } from "@/components/ui";

const FILTERS = {
  all: ["All activity", ""],
  delivered: ["Delivered", "AND l.message_type = 'content' AND l.message_status = 'sent'"],
  pending: ["Pending", "AND (l.message_status = 'pending' OR (l.message_type = 'not_following' AND l.message_status = 'sent'))"],
  failed: ["Failed", "AND l.message_status = 'failed'"],
} as const;
type Filter = keyof typeof FILTERS;

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeStyle: "medium", timeZone: process.env.APP_TIMEZONE || "UTC" });
const time = (ms: number) => (Date.now() - ms < 86_400_000 ? timeFmt.format(ms) : fmt(ms));

const th = "px-5 py-3 text-xs font-medium";
const tdc = "px-5 py-3.5 align-middle";
const mono = "font-mono text-xs text-muted";

export default async function Logs({ searchParams }: { searchParams: Promise<{ status?: string; msg?: string }> }) {
  const sp = await searchParams;
  const filter: Filter = sp.status && sp.status in FILTERS ? (sp.status as Filter) : "all";

  const [dms, checks, failed, totals] = await Promise.all([
    all<{ created_at: number; name: string; comment_id: string | null; instagram_user_id: string; matched_keyword: string | null; message_type: string; message_status: string; error_message: string | null }>(
      `SELECT l.created_at, a.name, l.comment_id, l.instagram_user_id, l.matched_keyword, l.message_type, l.message_status, l.error_message
       FROM dm_logs l JOIN automations a ON a.id = l.automation_id WHERE 1 = 1 ${FILTERS[filter][1]} ORDER BY l.id DESC LIMIT 200`,
    ),
    all<{ created_at: number; name: string; instagram_user_id: string; status: string; api_error_code: string | null }>(
      "SELECT v.created_at, a.name, v.instagram_user_id, v.status, v.api_error_code FROM verification_attempts v JOIN automations a ON a.id = v.automation_id ORDER BY v.id DESC LIMIT 50",
    ),
    all<{ received_at: number; event_key: string; event_type: string; attempts: number; error: string | null }>(
      "SELECT received_at, event_key, event_type, attempts, error FROM webhook_events WHERE processing_status = 'failed' ORDER BY id DESC LIMIT 50",
    ),
    one<{ sent: number; delivered: number; waiting: number; failed_events: number; retryable: number }>(
      `SELECT
         (SELECT COUNT(*) FROM dm_logs) AS sent,
         (SELECT COUNT(*) FROM dm_logs WHERE message_type = 'content' AND message_status = 'sent') AS delivered,
         (SELECT COUNT(DISTINCT l.automation_id || ':' || l.instagram_user_id) FROM dm_logs l WHERE l.message_type = 'not_following' AND l.message_status = 'sent'
            AND NOT EXISTS (SELECT 1 FROM dm_logs c WHERE c.automation_id = l.automation_id AND c.instagram_user_id = l.instagram_user_id AND c.message_type = 'content' AND c.message_status = 'sent')) AS waiting,
         (SELECT COUNT(*) FROM webhook_events WHERE processing_status = 'failed') AS failed_events,
         (SELECT COUNT(*) FROM webhook_events WHERE processing_status = 'failed' AND attempts < 3 AND received_at > ?) AS retryable`,
      [msAgo(6 * 86_400_000)],
    ),
  ]);
  const t = totals!;

  return (
    <>
      <PageHeader title="Activity logs" subtitle="Every message, follower check and failed webhook." />
      {sp.msg && <p className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 text-sm">{sp.msg}</p>}

      <nav className="inline-flex rounded-lg border border-border bg-card p-1 text-sm" aria-label="Filter messages">
        {(Object.keys(FILTERS) as Filter[]).map((k) => (
          <Link key={k} href={k === "all" ? "/logs" : `/logs?status=${k}`} aria-current={k === filter ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 ${k === filter ? "bg-raised text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>
            {FILTERS[k][0]}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Metric label="Messages logged" value={t.sent} />
        <Metric label="Delivered" value={t.delivered} note={t.sent ? pct(t.delivered, t.sent) : undefined} />
        <Metric label="Awaiting follow" value={t.waiting} note={t.waiting ? "Not following yet" : undefined} tone="amber" />
        <Metric label="Failed webhooks" value={t.failed_events} note={t.failed_events ? "Needs attention" : undefined} tone="red" />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <h2 className="flex items-center gap-2 px-5 py-4 text-sm font-semibold">Messages <span className={countChip}>{dms.length}{dms.length === 200 ? "+" : ""}</span></h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-y border-border text-muted">
              <tr>{["Time", "Automation", "Comment ID", "User ID", "Keyword", "Message", "Status", "Error / detail"].map((h) => <th key={h} className={`${th} whitespace-nowrap`}>{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dms.map((l, i) => (
                <tr key={i} className={l.message_status === "failed" ? "bg-red-500/[0.04]" : ""}>
                  <td className={`${tdc} whitespace-nowrap tabular-nums`} title={fmt(l.created_at)}>{time(l.created_at)}</td>
                  <td className={tdc}><span className="mr-2 inline-block size-1.5 rounded-full bg-accent align-middle" />{l.name}</td>
                  <td className={`${tdc} ${mono}`}>{l.comment_id ?? "—"}</td>
                  <td className={`${tdc} ${mono}`}>{l.instagram_user_id}</td>
                  <td className={tdc}>{l.matched_keyword && l.matched_keyword !== "*" ? <Keyword>{l.matched_keyword}</Keyword> : <span className="text-muted">—</span>}</td>
                  <td className={`${tdc} whitespace-nowrap`}>{MESSAGE_LABEL[l.message_type] ?? l.message_type}</td>
                  <td className={tdc}><MessageStatus type={l.message_type} status={l.message_status} /></td>
                  <td className={`${tdc} max-w-xs text-xs ${l.error_message ? "text-red-400" : l.message_type === "not_following" ? "text-amber-400" : "text-muted"}`}>
                    {l.error_message ?? (l.message_type === "not_following" ? "Waiting for them to follow" : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!dms.length && <p className="px-5 py-10 text-center text-sm text-muted">No messages{filter !== "all" ? ` with status “${FILTERS[filter][0]}”` : ""} yet.</p>}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <h2 className="flex items-center gap-2 px-5 py-4 text-sm font-semibold">Follower checks <span className={countChip}>{checks.length}</span></h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-border text-muted"><tr>{["Time", "Automation", "User ID", "Result", "API error"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {checks.map((c, i) => (
                  <tr key={i}>
                    <td className={`${tdc} whitespace-nowrap tabular-nums`} title={fmt(c.created_at)}>{time(c.created_at)}</td>
                    <td className={tdc}>{c.name}</td>
                    <td className={`${tdc} ${mono}`}>{c.instagram_user_id}</td>
                    <td className={tdc}><Badge tone={statusTone(c.status)}>{c.status === "not_following" ? "Not following" : c.status[0].toUpperCase() + c.status.slice(1)}</Badge></td>
                    <td className={`${tdc} max-w-[200px] truncate text-xs text-red-400`} title={c.api_error_code ?? ""}>{c.api_error_code ?? <span className="text-muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!checks.length && <p className="px-5 py-10 text-center text-sm text-muted">No follower checks yet.</p>}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              Failed webhook events <span className={`${countChip} ${failed.length ? "border-red-500/30 bg-red-500/10 text-red-400" : ""}`}>{failed.length} failed</span>
            </h2>
            <form action={retryFailedEvents}>
              <button disabled={!t.retryable} className={`${btnGhost} py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40`}><Icon name="refresh" className="size-3.5" /> Retry now ({t.retryable})</button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-y border-border text-muted"><tr>{["Received", "Event key", "Type", "Attempts", "Error"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {failed.map((e, i) => (
                  <tr key={i}>
                    <td className={`${tdc} whitespace-nowrap tabular-nums`} title={fmt(e.received_at)}>{time(e.received_at)}</td>
                    <td className={`${tdc} ${mono}`}>{e.event_key}</td>
                    <td className={tdc}>{e.event_type}</td>
                    <td className={`${tdc} tabular-nums`}>{e.attempts}/3</td>
                    <td className={`${tdc} max-w-[220px] truncate text-xs text-red-400`} title={e.error ?? ""}>{e.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!failed.length && <p className="px-5 py-10 text-center text-sm text-muted">No failed events. The daily job retries failures up to 3 times within 6 days.</p>}
          </div>
        </section>
      </div>
    </>
  );
}
