"use client";
// Live Instagram-style preview of the DM flow, read from the editor form as you type.
import { useEffect, useState } from "react";

type V = Record<string, string>;

export function DmPreview({ formId, username }: { formId: string; username: string }) {
  const [v, setV] = useState<V>({});

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const read = () => setV(Object.fromEntries([...new FormData(form).entries()].map(([k, x]) => [k, String(x)])));
    read();
    form.addEventListener("input", read);
    form.addEventListener("change", read);
    return () => {
      form.removeEventListener("input", read);
      form.removeEventListener("change", read);
    };
  }, [formId]);

  const fill = (s?: string) => (s ?? "").replaceAll("{username}", "@alex");
  const trigger = v.trigger_type ?? "comment";
  const keyword = (v.keywords ?? "").split(/[,\n]/)[0]?.trim() || "GUIDE";
  const gate = v.require_follow === "on";
  const opening = v.button_label || "Send me the link";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-semibold"><span className="size-2 rounded-full bg-accent" />Live DM preview</p>
        <span className="rounded border border-border bg-raised px-1.5 py-0.5 text-[10px] text-muted">Instagram Direct</span>
      </div>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid size-8 place-items-center rounded-full bg-[linear-gradient(135deg,#feda75,#d62976,#4f5bd5)] text-[11px] font-semibold uppercase text-white">{username.slice(0, 2)}</span>
        <div>
          <p className="text-sm font-medium">@{username}</p>
          <p className="text-[11px] text-muted">How @alex sees it</p>
        </div>
      </div>

      <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4 text-sm">
        <div className="rounded-lg border border-border bg-raised p-3 text-xs">
          <p className="font-medium text-accent">
            {trigger === "comment" ? `Commented “${keyword}” on your post` : trigger === "story_reply" ? `Replied “${keyword}” to your story` : `Sent you “${keyword}”`}
          </p>
          <p className="mt-0.5 text-muted">Automation triggered</p>
        </div>

        {trigger === "comment" && (
          <>
            <Them text={fill(v.initial_message)} buttons={[opening]} />
            <Me text={opening} />
          </>
        )}
        {gate && (
          <>
            <Them text={fill(v.not_following_message)} buttons={["Visit profile", "I've followed"]} note="If they don't follow yet" />
            <Me text="I've followed" />
          </>
        )}
        <Them text={fill(v.content_message)} buttons={v.content_url ? [`${v.link_button_label || "Open link"} ↗`] : []} note={gate ? "Once the follow is confirmed" : undefined} />
      </div>
    </div>
  );
}

function Them({ text, buttons, note }: { text: string; buttons: string[]; note?: string }) {
  return (
    <div className="max-w-[88%] space-y-1">
      {note && <p className="text-[10px] uppercase tracking-wider text-muted">{note}</p>}
      <div className="space-y-2 rounded-2xl rounded-bl-md border border-border bg-raised p-3">
        <p className="whitespace-pre-wrap break-words">{text || <span className="text-muted">Empty message</span>}</p>
        {buttons.map((b, i) => (
          <p key={b} className={`rounded-lg py-1.5 text-center text-xs font-medium ${i === 0 ? "bg-accent text-white" : "bg-zinc-800"}`}>{b}</p>
        ))}
      </div>
    </div>
  );
}

function Me({ text }: { text: string }) {
  return <p className="ml-auto w-fit max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3 py-2 text-white">{text}</p>;
}
