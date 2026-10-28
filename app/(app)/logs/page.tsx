import { all } from "@/lib/db";
import { Badge, Card, fmt, statusTone, Table, td } from "@/components/ui";

const mono = "font-mono text-xs";

export default async function Logs() {
  const [dms, checks, failed] = await Promise.all([
    all<{ created_at: number; name: string; comment_id: string | null; media_id: string | null; instagram_user_id: string; matched_keyword: string | null; message_type: string; message_status: string; error_message: string | null }>(
      `SELECT l.created_at, a.name, l.comment_id, a.media_id, l.instagram_user_id, l.matched_keyword, l.message_type, l.message_status, l.error_message
       FROM dm_logs l JOIN automations a ON a.id = l.automation_id ORDER BY l.id DESC LIMIT 200`,
    ),
    all<{ created_at: number; name: string; instagram_user_id: string; status: string; api_error_code: string | null }>(
      "SELECT v.created_at, a.name, v.instagram_user_id, v.status, v.api_error_code FROM verification_attempts v JOIN automations a ON a.id = v.automation_id ORDER BY v.id DESC LIMIT 100",
    ),
    all<{ received_at: number; event_key: string; event_type: string; attempts: number; error: string | null }>(
      "SELECT received_at, event_key, event_type, attempts, error FROM webhook_events WHERE processing_status = 'failed' ORDER BY id DESC LIMIT 50",
    ),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Activity logs</h1>

      <Card title="Messages">
        <Table head={["Time", "Automation", "Comment", "Post", "User", "Keyword", "Type", "Status", "Error"]} empty={!dms.length}>
          {dms.map((l, i) => (
            <tr key={i}>
              <td className={`${td} whitespace-nowrap`}>{fmt(l.created_at)}</td>
              <td className={td}>{l.name}</td>
              <td className={`${td} ${mono}`}>{l.comment_id ?? "—"}</td>
              <td className={`${td} ${mono}`}>{l.media_id ?? "any"}</td>
              <td className={`${td} ${mono}`}>{l.instagram_user_id}</td>
              <td className={td}>{l.matched_keyword ?? "—"}</td>
              <td className={`${td} whitespace-nowrap`}>{l.message_type.replace("_", " ")}</td>
              <td className={td}><Badge tone={statusTone(l.message_status)}>{l.message_status}</Badge></td>
              <td className={`${td} text-xs text-red-600 dark:text-red-400`}>{l.error_message}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Follower checks">
        <Table head={["Time", "Automation", "User", "Result", "API error"]} empty={!checks.length}>
          {checks.map((c, i) => (
            <tr key={i}>
              <td className={`${td} whitespace-nowrap`}>{fmt(c.created_at)}</td>
              <td className={td}>{c.name}</td>
              <td className={`${td} ${mono}`}>{c.instagram_user_id}</td>
              <td className={td}><Badge tone={statusTone(c.status)}>{c.status.replace("_", " ")}</Badge></td>
              <td className={`${td} text-xs text-red-600 dark:text-red-400`}>{c.api_error_code}</td>
            </tr>
          ))}
        </Table>
      </Card>

      <Card title="Failed webhook events">
        <p className="mb-3 text-xs text-black/50 dark:text-white/50">Retried by the daily job up to 3 times, within 6 days of receipt.</p>
        <Table head={["Received", "Event", "Type", "Attempts", "Error"]} empty={!failed.length}>
          {failed.map((e, i) => (
            <tr key={i}>
              <td className={`${td} whitespace-nowrap`}>{fmt(e.received_at)}</td>
              <td className={`${td} ${mono}`}>{e.event_key}</td>
              <td className={td}>{e.event_type}</td>
              <td className={`${td} tabular-nums`}>{e.attempts}</td>
              <td className={`${td} text-xs text-red-600 dark:text-red-400`}>{e.error}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
