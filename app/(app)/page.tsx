// Ported from the first Stitch screen "Overview" (project 17393825602441053444).
import Link from "next/link";
import { all, one } from "@/lib/db";
import { ago, Badge, Card, DAY, Keyword, MESSAGE_LABEL, MessageStatus, msAgo, PageHeader, pct, statusTone, Table, td } from "@/components/ui";

const RANGES = { "24h": ["Today", DAY], "7d": ["Last 7 days", 7 * DAY], "30d": ["Last 30 days", 30 * DAY], all: ["All time", 0] } as const;
type Range = keyof typeof RANGES;

type Stats = { active: number; posts: number; matched: number; dm_sent: number; tapped: number; following: number; delivered: number; sends: number; failed_sends: number; failed: number };

export default async function Overview({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const r = (await searchParams).range;
  const range: Range = r && r in RANGES ? (r as Range) : "7d";
  const since = RANGES[range][1] ? msAgo(RANGES[range][1]) : 0;

  // "Requested" = people who asked for the content (a follow check or a delivery happened for them).
  const s = (await one<Stats>(
    `SELECT
       (SELECT COUNT(*) FROM automations WHERE is_active = 1) AS active,
       (SELECT COUNT(DISTINCT COALESCE(media_id, 'any')) FROM automations WHERE is_active = 1 AND trigger_type = 'comment') AS posts,
       (SELECT COUNT(*) FROM dm_logs WHERE message_type = 'initial' AND created_at >= ?1) AS matched,
       (SELECT COUNT(*) FROM dm_logs WHERE message_type = 'initial' AND message_status = 'sent' AND created_at >= ?1) AS dm_sent,
       (SELECT COUNT(*) FROM (
          SELECT automation_id, instagram_user_id FROM verification_attempts WHERE created_at >= ?1
          UNION SELECT automation_id, instagram_user_id FROM dm_logs WHERE message_type = 'content' AND created_at >= ?1)) AS tapped,
       (SELECT COUNT(DISTINCT automation_id || ':' || instagram_user_id) FROM verification_attempts WHERE status = 'following' AND created_at >= ?1) AS following,
       (SELECT COUNT(*) FROM dm_logs WHERE message_type = 'content' AND message_status = 'sent' AND created_at >= ?1) AS delivered,
       (SELECT COUNT(*) FROM dm_logs WHERE created_at >= ?1) AS sends,
       (SELECT COUNT(*) FROM dm_logs WHERE message_status = 'failed' AND created_at >= ?1) AS failed_sends,
       (SELECT COUNT(*) FROM dm_logs WHERE message_status = 'failed' AND created_at >= ?1)
         + (SELECT COUNT(*) FROM webhook_events WHERE processing_status = 'failed' AND received_at >= ?1) AS failed`,
    [since],
  ))!;
  const acc = await one<{ connection_status: string }>("SELECT connection_status FROM instagram_accounts WHERE connection_status != 'disconnected' LIMIT 1");
  const recent = await all<{ created_at: number; name: string; message_type: string; message_status: string; matched_keyword: string | null; error_message: string | null }>(
    "SELECT l.created_at, a.name, l.message_type, l.message_status, l.matched_keyword, l.error_message FROM dm_logs l JOIN automations a ON a.id = l.automation_id ORDER BY l.id DESC LIMIT 8",
  );

  const tiles: { label: string; value: number; note: string; danger?: boolean }[] = [
    { label: "Active automations", value: s.active, note: `Across ${s.posts} post target${s.posts === 1 ? "" : "s"}` },
    { label: "Matching comments", value: s.matched, note: "Comments that hit a keyword" },
    { label: "Opening DMs sent", value: s.dm_sent, note: `${pct(s.dm_sent, s.matched)} delivery rate` },
    { label: "Verified followers", value: s.following, note: `${pct(s.following, s.tapped)} pass the follow check` },
    { label: "Content delivered", value: s.delivered, note: `${pct(s.delivered, s.tapped)} of requests fulfilled` },
    { label: "Failures", value: s.failed, note: `${pct(s.failed_sends, s.sends)} of sends failed`, danger: true },
  ];

  const funnel: [string, number][] = [
    ["Comments", s.matched],
    ["DM sent", s.dm_sent],
    ["Requested", s.tapped],
    ["Follower check", s.following],
    ["Delivered", s.delivered],
  ];

  return (
    <>
      <PageHeader title="Overview" subtitle="Comment-to-DM automation performance">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-border bg-card p-1 text-sm">
            {(Object.keys(RANGES) as Range[]).map((k) => (
              <Link key={k} href={`/?range=${k}`} className={`rounded-md px-3 py-1.5 ${k === range ? "bg-raised text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}>
                {RANGES[k][0]}
              </Link>
            ))}
          </div>
          {acc && <Badge tone={statusTone(acc.connection_status)}>{acc.connection_status === "connected" ? "Live" : "Paused"}</Badge>}
        </div>
      </PageHeader>

      {!acc && (
        <Card>
          <p className="text-sm">No Instagram account connected yet. <Link href="/settings" className="font-medium text-accent hover:underline">Connect one in Settings →</Link></p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        {tiles.map((t) => (
          <section key={t.label} className="rounded-xl border border-border bg-card p-5">
            <p className={`text-sm ${t.danger ? "text-red-400" : "text-muted"}`}>{t.label}</p>
            <p className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${t.danger && t.value ? "text-red-400" : ""}`}>{t.value.toLocaleString()}</p>
            <p className={`mt-2 text-xs ${t.danger ? "text-red-400/80" : "text-muted"}`}>{t.note}</p>
          </section>
        ))}
      </div>

      <Card
        title="Comment-to-delivery funnel"
        subtitle="From keyword comment to follower-gated delivery"
        action={<p className="text-xs text-muted">Overall conversion <span className="font-semibold text-foreground">{pct(s.delivered, s.matched)}</span></p>}
      >
        <ol className="grid gap-3 sm:grid-cols-5">
          {funnel.map(([label, n], i) => {
            const prev = i ? funnel[i - 1][1] : n;
            const goal = i === funnel.length - 1;
            return (
              <li key={label} className={`rounded-lg border p-4 ${goal ? "border-accent/40 bg-accent/5" : "border-border bg-raised"}`}>
                <p className={`text-[11px] font-semibold uppercase tracking-wider ${goal ? "text-accent" : "text-muted"}`}>{goal ? "Goal" : `Step ${i + 1}`}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{n.toLocaleString()}</p>
                <p className="text-sm text-muted">{label}</p>
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-border">
                  <div className={`h-full rounded-full ${goal ? "bg-accent" : "bg-foreground/60"}`} style={{ width: `${s.matched ? Math.min(100, (n / s.matched) * 100) : 0}%` }} />
                </div>
                {i > 0 && <p className="mt-2 text-xs text-muted">{pct(n, prev)} of previous step</p>}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card title="Recent activity" action={<Link href="/logs" className="text-xs font-medium text-accent hover:underline">View all logs →</Link>}>
        <Table head={["Time", "Automation", "Keyword", "Message", "Status"]} empty={!recent.length}>
          {recent.map((l, i) => (
            <tr key={i} className={l.message_status === "failed" ? "bg-red-500/[0.04]" : ""}>
              <td className={`${td} whitespace-nowrap text-muted`}>{ago(l.created_at)}</td>
              <td className={td}><span className="mr-2 inline-block size-1.5 rounded-full bg-accent align-middle" />{l.name}</td>
              <td className={td}>{l.matched_keyword && l.matched_keyword !== "*" ? <Keyword>{l.matched_keyword}</Keyword> : <span className="text-muted">—</span>}</td>
              <td className={td}>{MESSAGE_LABEL[l.message_type] ?? l.message_type}</td>
              <td className={td}>
                <div className="flex items-center gap-2">
                  <MessageStatus type={l.message_type} status={l.message_status} />
                  {l.error_message && <span className="truncate text-xs text-red-400" title={l.error_message}>{l.error_message.slice(0, 60)}</span>}
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </>
  );
}
