import Link from "next/link";
import { all, one } from "@/lib/db";
import { Badge, Card, DAY, fmt, statusTone, Table, td } from "@/components/ui";

const RANGES = { "24h": DAY, "7d": 7 * DAY, "30d": 30 * DAY, all: 0 } as const;
type Range = keyof typeof RANGES;

type Stats = { active: number; matched: number; initial_sent: number; verified: number; delivered: number; failed: number };

export default async function Overview({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const r = (await searchParams).range;
  const range: Range = r && r in RANGES ? (r as Range) : "7d";
  const since = RANGES[range] ? Date.now() - RANGES[range] : 0;

  const s = (await one<Stats>(
    `SELECT
       (SELECT COUNT(*) FROM automations WHERE is_active = 1) AS active,
       (SELECT COUNT(*) FROM dm_logs WHERE message_type = 'initial' AND created_at >= ?1) AS matched,
       (SELECT COUNT(*) FROM dm_logs WHERE message_type = 'initial' AND message_status = 'sent' AND created_at >= ?1) AS initial_sent,
       (SELECT COUNT(*) FROM verification_attempts WHERE status = 'following' AND created_at >= ?1) AS verified,
       (SELECT COUNT(*) FROM dm_logs WHERE message_type = 'content' AND message_status = 'sent' AND created_at >= ?1) AS delivered,
       (SELECT COUNT(*) FROM dm_logs WHERE message_status = 'failed' AND created_at >= ?1)
         + (SELECT COUNT(*) FROM webhook_events WHERE processing_status = 'failed' AND received_at >= ?1) AS failed`,
    [since],
  ))!;
  const acc = await one<{ username: string; connection_status: string }>("SELECT username, connection_status FROM instagram_accounts WHERE connection_status != 'disconnected' LIMIT 1");
  const recent = await all<{ created_at: number; name: string; message_type: string; message_status: string; matched_keyword: string | null; error_message: string | null }>(
    "SELECT l.created_at, a.name, l.message_type, l.message_status, l.matched_keyword, l.error_message FROM dm_logs l JOIN automations a ON a.id = l.automation_id ORDER BY l.id DESC LIMIT 10",
  );

  const tiles: [string, number][] = [
    ["Active automations", s.active],
    ["Matching comments", s.matched],
    ["Opening DMs sent", s.initial_sent],
    ["Verified followers", s.verified],
    ["Content delivered", s.delivered],
    ["Failures", s.failed],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-semibold">Overview</h1>
        <div className="flex rounded-md border border-black/10 p-0.5 text-sm dark:border-white/10">
          {(Object.keys(RANGES) as Range[]).map((k) => (
            <Link key={k} href={`/?range=${k}`} className={`rounded px-3 py-1 ${k === range ? "bg-foreground text-background" : ""}`}>
              {k === "all" ? "All time" : k === "24h" ? "Today" : `Last ${k.replace("d", " days")}`}
            </Link>
          ))}
        </div>
      </div>

      {!acc ? (
        <Card><p className="text-sm">No Instagram account connected. <Link href="/settings" className="underline">Connect one in Settings</Link>.</p></Card>
      ) : (
        <p className="text-sm text-black/60 dark:text-white/60">
          Connected as <strong>@{acc.username}</strong> <Badge tone={statusTone(acc.connection_status)}>{acc.connection_status}</Badge>
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {tiles.map(([label, n]) => (
          <Card key={label}>
            <p className="text-xs text-black/50 dark:text-white/50">{label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${label === "Failures" && n ? "text-red-600 dark:text-red-400" : ""}`}>{n}</p>
          </Card>
        ))}
      </div>

      <Card title="Recent activity">
        <Table head={["Time", "Automation", "Message", "Keyword", "Status"]} empty={!recent.length}>
          {recent.map((l, i) => (
            <tr key={i}>
              <td className={`${td} whitespace-nowrap`}>{fmt(l.created_at)}</td>
              <td className={td}>{l.name}</td>
              <td className={td}>{l.message_type.replace("_", " ")}</td>
              <td className={td}>{l.matched_keyword ?? "—"}</td>
              <td className={td}><Badge tone={statusTone(l.message_status)}>{l.message_status}</Badge>{l.error_message && <span className="ml-2 text-xs text-red-600 dark:text-red-400">{l.error_message}</span>}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
