import Link from "next/link";
import { all } from "@/lib/db";
import { deleteAutomation, toggleAutomation } from "@/app/actions";
import { Badge, btnDanger, btnGhost, btnPrimary, Card, fmt, Table, td } from "@/components/ui";

type Row = {
  id: number;
  name: string;
  trigger_type: string;
  media_id: string | null;
  media_caption: string | null;
  match_mode: string;
  is_active: number;
  keywords: string | null;
  matched: number;
  delivered: number;
  last_run: number | null;
};

const target = (r: Row) =>
  r.trigger_type === "dm" ? "DM keyword" : r.trigger_type === "story_reply" ? "Story reply" : r.media_id ? r.media_caption?.slice(0, 60) || `Post ${r.media_id}` : "Any post";

export default async function Automations() {
  const rows = await all<Row>(`
    SELECT a.id, a.name, a.trigger_type, a.media_id, a.media_caption, a.match_mode, a.is_active,
      (SELECT group_concat(keyword, ', ') FROM automation_keywords k WHERE k.automation_id = a.id) AS keywords,
      (SELECT COUNT(DISTINCT COALESCE(l.comment_id, l.instagram_user_id)) FROM dm_logs l WHERE l.automation_id = a.id) AS matched,
      (SELECT COUNT(*) FROM dm_logs l WHERE l.automation_id = a.id AND l.message_type = 'content' AND l.message_status = 'sent') AS delivered,
      (SELECT MAX(created_at) FROM dm_logs l WHERE l.automation_id = a.id) AS last_run
    FROM automations a ORDER BY a.id DESC`);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Automations</h1>
        <Link href="/automations/new" className={btnPrimary}>New automation</Link>
      </div>
      <Card>
        <Table head={["Name", "Target", "Keywords", "Status", "Matched", "Delivered", "Last run", ""]} empty={!rows.length}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={`${td} font-medium`}><Link href={`/automations/${r.id}`} className="hover:underline">{r.name}</Link></td>
              <td className={`${td} max-w-48 truncate`}>{target(r)}</td>
              <td className={td}>{r.match_mode === "any" ? <em>any message</em> : r.keywords}<span className="ml-1 text-xs text-black/40 dark:text-white/40">({r.match_mode})</span></td>
              <td className={td}><Badge tone={r.is_active ? "green" : "gray"}>{r.is_active ? "Active" : "Paused"}</Badge></td>
              <td className={`${td} tabular-nums`}>{r.matched}</td>
              <td className={`${td} tabular-nums`}>{r.delivered}</td>
              <td className={`${td} whitespace-nowrap`}>{fmt(r.last_run)}</td>
              <td className={td}>
                <div className="flex items-start justify-end gap-2">
                  <Link href={`/automations/${r.id}`} className={btnGhost}>Edit</Link>
                  <form action={toggleAutomation}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className={btnGhost}>{r.is_active ? "Pause" : "Resume"}</button>
                  </form>
                  <details className="relative">
                    <summary className={`${btnDanger} cursor-pointer list-none`}>Delete</summary>
                    <form action={deleteAutomation} className="absolute right-0 z-10 mt-1 w-56 rounded-md border border-black/10 bg-background p-3 text-xs shadow-lg dark:border-white/10">
                      <input type="hidden" name="id" value={r.id} />
                      <p className="mb-2">Deletes the automation and its logs.</p>
                      <button className={`${btnDanger} w-full`}>Confirm delete</button>
                    </form>
                  </details>
                </div>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
