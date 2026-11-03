// Ported from Stitch screen "AutoDM Automations" (projects/17393825602441053444/screens/7391e4fe7753446382c66be205d967bd).
import Link from "next/link";
import { all } from "@/lib/db";
import { deleteAutomation, toggleAutomation } from "@/app/actions";
import { Icon } from "@/components/Icon";
import { ago, Badge, btnDanger, btnPrimary, Keyword, Metric, PageHeader, pct } from "@/components/ui";

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

const TRIGGER = { comment: "Comment on post", dm: "DM keyword", story_reply: "Story reply" } as Record<string, string>;
const MODE = { exact: "Exact", contains: "Contains", any: "Any message" } as Record<string, string>;

function target(r: Row) {
  if (r.trigger_type !== "comment") return <span className="italic text-muted">{r.trigger_type === "dm" ? "Your DMs" : "Your stories"}</span>;
  if (!r.media_id) return <span className="italic text-muted">Any post</span>;
  return <span className="block max-w-[180px] truncate" title={r.media_caption ?? ""}>{r.media_caption || `Post ${r.media_id}`}</span>;
}

const iconBtn = "grid size-8 place-items-center rounded-md text-muted transition hover:bg-white/5 hover:text-foreground";
const th = "px-4 py-3 text-[11px] font-semibold uppercase tracking-wider";

export default async function Automations() {
  const rows = await all<Row>(`
    SELECT a.id, a.name, a.trigger_type, a.media_id, a.media_caption, a.match_mode, a.is_active,
      (SELECT group_concat(keyword, char(10)) FROM automation_keywords k WHERE k.automation_id = a.id) AS keywords,
      (SELECT COUNT(DISTINCT COALESCE(l.comment_id, l.instagram_user_id)) FROM dm_logs l WHERE l.automation_id = a.id) AS matched,
      (SELECT COUNT(*) FROM dm_logs l WHERE l.automation_id = a.id AND l.message_type = 'content' AND l.message_status = 'sent') AS delivered,
      (SELECT MAX(created_at) FROM dm_logs l WHERE l.automation_id = a.id) AS last_run
    FROM automations a ORDER BY a.is_active DESC, a.id DESC`);

  const active = rows.filter((r) => r.is_active).length;
  const matched = rows.reduce((n, r) => n + r.matched, 0);
  const delivered = rows.reduce((n, r) => n + r.delivered, 0);

  return (
    <>
      <PageHeader title="Automations" subtitle="Keyword triggers that DM people and gate your content behind a follow.">
        <Link href="/automations/new" className={btnPrimary}><Icon name="plus" /> New automation</Link>
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Metric label="Active rules" value={active} note={rows.length - active ? `${rows.length - active} paused` : undefined} tone="gray" />
        <Metric label="Total matched" value={matched} />
        <Metric label="Content delivered" value={delivered} note={matched ? `${pct(delivered, matched)} rate` : undefined} />
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="grid size-12 place-items-center rounded-xl border border-border bg-raised text-accent"><Icon name="zap" className="size-5" /></span>
            <p className="font-medium">No automations yet</p>
            <p className="max-w-sm text-sm text-muted">Create one to start DMing people who comment a keyword on your posts.</p>
            <Link href="/automations/new" className={btnPrimary}><Icon name="plus" /> New automation</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-background/40 text-muted">
                <tr>
                  <th className={th}>Name &amp; trigger</th>
                  <th className={th}>Target</th>
                  <th className={th}>Keywords</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Matched</th>
                  <th className={`${th} text-right`}>Delivered</th>
                  <th className={th}>Last run</th>
                  <th className={`${th} text-right`}>Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3.5">
                      <Link href={`/automations/${r.id}`} className="text-sm font-medium hover:text-accent">{r.name}</Link>
                      <p className="mt-0.5 text-[11px] text-muted">{TRIGGER[r.trigger_type]}</p>
                    </td>
                    <td className="px-4 py-3.5">{target(r)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {r.match_mode !== "any" && (r.keywords ?? "").split("\n").filter(Boolean).map((k) => <Keyword key={k}>{k}</Keyword>)}
                        <span className="text-[10px] text-muted">({MODE[r.match_mode]})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5"><Badge tone={r.is_active ? "green" : "gray"}>{r.is_active ? "Active" : "Paused"}</Badge></td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums">{r.matched.toLocaleString()}</td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums">{r.delivered.toLocaleString()}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-muted">{ago(r.last_run)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/automations/${r.id}`} className={iconBtn} title="Edit" aria-label={`Edit ${r.name}`}><Icon name="edit" /></Link>
                        <form action={toggleAutomation}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className={`${iconBtn} ${r.is_active ? "" : "hover:text-emerald-400"}`} title={r.is_active ? "Pause" : "Resume"} aria-label={`${r.is_active ? "Pause" : "Resume"} ${r.name}`}>
                            <Icon name={r.is_active ? "pause" : "play"} />
                          </button>
                        </form>
                        <details className="relative">
                          <summary className={`${iconBtn} cursor-pointer list-none text-red-400 hover:bg-red-500/10 hover:text-red-400`} title="Delete" aria-label={`Delete ${r.name}`}><Icon name="trash" /></summary>
                          <form action={deleteAutomation} className="absolute right-0 z-10 mt-1 w-60 space-y-2 rounded-lg border border-border bg-raised p-3 text-xs shadow-xl">
                            <input type="hidden" name="id" value={r.id} />
                            <p>Delete <strong>{r.name}</strong> and its logs?</p>
                            <button className={`${btnDanger} w-full py-1.5 text-xs`}>Confirm delete</button>
                          </form>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > 0 && <p className="border-t border-border bg-background/20 px-4 py-3 text-xs text-muted">{rows.length} automation{rows.length === 1 ? "" : "s"}</p>}
      </section>
    </>
  );
}
