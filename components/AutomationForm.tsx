// Ported from Stitch screen "AutoDM Editor" (projects/17393825602441053444/screens/f1bf6a6561bf44ddbfdb7c2e26f03a18).
import Link from "next/link";
import type { ReactNode } from "react";
import { saveAutomation } from "@/app/actions";
import type { Automation } from "@/lib/engine";
import type { Media } from "@/lib/instagram";
import { DmPreview } from "@/components/DmPreview";
import { Icon } from "@/components/Icon";
import { btnGhost, btnPrimary, Field, Flash, input, Toggle } from "@/components/ui";
import { TEMPLATES, type Template } from "@/lib/templates";

const DEFAULTS = {
  initial_message: "Thanks for commenting, {username}! Tap below and I'll send it over 👇",
  button_label: "Send me the link",
  content_message: "Here you go! 🎉",
  link_button_label: "Open link",
  not_following_message: "Looks like you're not following yet 💛 Tap View profile, hit Follow, then come back and tap I've followed to get it.",
  verification_error_message: "I couldn't check that just now. Give it a minute and tap I've followed again.",
};

const TRIGGERS = [
  ["comment", "message", "Comment on post", "Someone comments a keyword on your post or Reel."],
  ["dm", "send", "Direct message", "Someone sends you a keyword in DMs."],
  ["story_reply", "story", "Story reply", "Someone replies to your story with a keyword."],
] as const;

const MODES = [
  ["exact", "Exact", "The whole message is the keyword"],
  ["contains", "Contains", "Keyword appears as a word"],
  ["any", "Any message", "Every message triggers"],
] as const;

function Section({ title, desc, action, children }: { title: string; desc?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className={`flex items-start justify-between gap-4 ${children ? "mb-4" : ""}`}>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const choice = "block h-full cursor-pointer rounded-xl border border-border bg-raised p-4 transition hover:border-white/15 has-checked:border-accent has-checked:bg-accent/10";

export function AutomationForm({ a, t, media, mediaError, msg, username }: { a?: Automation; t?: Template; media: Media[]; mediaError?: string; msg?: string; username: string }) {
  const v = (k: keyof typeof DEFAULTS) => a?.[k] ?? t?.[k] ?? DEFAULTS[k];
  const trigger = a?.trigger_type ?? "comment";
  const selectedMedia = a?.media_id ?? "any";

  return (
    // key: picking a template remounts the form so its default values apply
    <form key={t?.key ?? "blank"} id="automation-form" action={saveAutomation} className="space-y-6">
      {a && <input type="hidden" name="id" value={a.id} />}

      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="text-xs text-muted"><Link href="/automations" className="hover:text-foreground">Automations</Link> / {a ? "Edit" : "New"}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{a ? `Edit “${a.name}”` : "Configure automation flow"}</h1>
          <p className="mt-1 text-sm text-muted">Set the trigger, the keywords, and the DMs people get.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/automations" className={btnGhost}>Discard</Link>
          <button className={btnPrimary}>Save automation</button>
        </div>
      </div>

      <Flash msg={msg} />

      {!a && (
        <Section title="Start from a template" desc="Fills in the keywords, replies and every DM. Edit anything before saving.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {TEMPLATES.map((x) => (
              <Link key={x.key} href={`/automations/new?template=${x.key}`} aria-current={t?.key === x.key ? "true" : undefined}
                className={`block rounded-xl border p-4 transition hover:border-white/15 ${t?.key === x.key ? "border-accent bg-accent/10" : "border-border bg-raised"}`}>
                <span className="text-xl" aria-hidden>{x.emoji}</span>
                <span className="mt-2 block text-sm font-medium">{x.title}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted">{x.blurb}</span>
                <span className="mt-2 block font-mono text-[11px] text-muted">{x.keywords}</span>
              </Link>
            ))}
            {t && (
              <Link href="/automations/new" className="flex items-center justify-center rounded-xl border border-dashed border-border p-4 text-sm text-muted hover:text-foreground">
                Start blank instead
              </Link>
            )}
          </div>
        </Section>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-6">
          <Section title="Name & status" desc="A name you'll recognise in the list. Paused automations ignore all events." action={<Toggle name="is_active" defaultChecked={a ? !!a.is_active : true} label="Active" />}>
            <Field label="Automation name">
              <input name="name" required maxLength={80} defaultValue={a?.name ?? t?.name} placeholder="Free guide – summer Reel" className={input} />
            </Field>
          </Section>

          <Section title="Trigger type" desc="How people start the automation.">
            <div className="grid gap-3 sm:grid-cols-3">
              {TRIGGERS.map(([value, icon, title, desc]) => (
                <label key={value} className={`group ${choice}`}>
                  <input type="radio" name="trigger_type" value={value} defaultChecked={trigger === value} className="sr-only" />
                  <span className="flex items-start justify-between">
                    <span className="grid size-9 place-items-center rounded-lg border border-border bg-card text-muted group-has-checked:border-accent/40 group-has-checked:text-accent"><Icon name={icon} /></span>
                    <Icon name="check" className="size-4 text-accent opacity-0 group-has-checked:opacity-100" />
                  </span>
                  <span className="mt-3 block text-sm font-medium">{title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted">{desc}</span>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Trigger keywords" desc="Case-insensitive. Separate with commas.">
            <div className="space-y-4">
              <input name="keywords" defaultValue={a?.keywords?.split("\n").join(", ") ?? t?.keywords} placeholder="GUIDE, EBOOK, PDF" className={`${input} font-mono uppercase placeholder:normal-case`} />
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Matching mode</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {MODES.map(([value, title, desc]) => (
                    <label key={value} className={`${choice} p-3`}>
                      <input type="radio" name="match_mode" value={value} defaultChecked={(a?.match_mode ?? t?.match_mode ?? "exact") === value} className="sr-only" />
                      <span className="block text-sm font-medium">{title}</span>
                      <span className="block text-xs text-muted">{desc}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </Section>

          <Section title="Post or Reel" desc="Comment triggers only. Pick one post, or every post.">
            {mediaError && <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">Couldn&apos;t load your posts: {mediaError}</p>}
            <div className="grid max-h-[30rem] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
              <label className={`group ${choice} flex aspect-square flex-col items-center justify-center gap-2 text-center`}>
                <input type="radio" name="media_id" value="any" defaultChecked={selectedMedia === "any"} className="sr-only" />
                <Icon name="grid" className="size-5 text-muted group-has-checked:text-accent" />
                <span className="text-sm font-medium">Any post</span>
              </label>
              {a?.media_id && !media.some((m) => m.id === a.media_id) && (
                <label className={`${choice} flex aspect-square items-center justify-center text-center text-xs`}>
                  <input type="radio" name="media_id" value={a.media_id} defaultChecked className="sr-only" />
                  {a.media_caption?.slice(0, 80) || `Post ${a.media_id}`}
                </label>
              )}
              {media.map((m) => (
                <label key={m.id} className="group relative block aspect-square cursor-pointer overflow-hidden rounded-xl border border-border has-checked:border-accent has-checked:ring-2 has-checked:ring-accent/40">
                  <input type="radio" name="media_id" value={m.id} defaultChecked={selectedMedia === m.id} className="sr-only" />
                  {/* eslint-disable-next-line @next/next/no-img-element -- Instagram CDN URLs expire; next/image would cache them */}
                  <img src={m.thumbnail_url ?? m.media_url} alt={m.caption?.slice(0, 80) ?? ""} className="size-full object-cover transition group-hover:scale-105" loading="lazy" />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-6 text-[11px]">
                    <span className="block font-medium">{m.media_product_type === "REELS" ? "Reel" : m.media_type === "CAROUSEL_ALBUM" ? "Carousel" : "Post"}</span>
                    <span className="block truncate text-white/70">{m.caption || "No caption"}</span>
                  </span>
                  <span className="absolute right-2 top-2 grid size-5 place-items-center rounded-full bg-accent text-white opacity-0 group-has-checked:opacity-100"><Icon name="check" className="size-3.5" /></span>
                </label>
              ))}
            </div>
          </Section>

          <Section title="Opening DM" desc="Comment triggers only. Sent as a private reply with a button that starts the follow check.">
            <div className="space-y-4">
              <Field label="Message" hint="Use {username} to greet them by handle.">
                <textarea name="initial_message" rows={3} maxLength={640} defaultValue={v("initial_message")} className={input} />
              </Field>
              <Field label="Button label" hint="Max 20 characters.">
                <input name="button_label" maxLength={20} defaultValue={v("button_label")} className={input} />
              </Field>
              <Field label="Public comment replies (optional)" hint="One per line; a random one is posted under the comment.">
                <textarea name="comment_replies" rows={3} defaultValue={a?.comment_replies ?? t?.comment_replies} placeholder={"Sent! Check your DMs 📬\nJust DMed you {username} ✨"} className={input} />
              </Field>
            </div>
          </Section>

          <Section title="Content delivery" desc="What they get once unlocked.">
            <div className="space-y-4">
              <Field label="Content message">
                <textarea name="content_message" rows={3} required maxLength={640} defaultValue={v("content_message")} className={input} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
                <Field label="Link button label">
                  <input name="link_button_label" maxLength={20} defaultValue={v("link_button_label")} className={input} />
                </Field>
                <Field label="Protected link (optional)" hint="http(s) only. Sent as a button, with a plain-text fallback.">
                  <input name="content_url" type="url" pattern="https?://.+" defaultValue={a?.content_url ?? ""} placeholder="https://example.com/guide" className={input} />
                </Field>
              </div>
            </div>
          </Section>

          <Section
            title="Follow-gate safeguard"
            desc="Only deliver to followers, checked with Instagram's is_user_follow_business. If Instagram can't answer, content is held back."
            action={<Toggle name="require_follow" defaultChecked={a ? !!a.require_follow : true} label="Only deliver to followers" />}
          >
            <div className="space-y-4">
              <Field label="If not following" hint="Sent with “View profile” (opens your profile) and “I've followed” (checks again) buttons.">
                <textarea name="not_following_message" rows={2} maxLength={640} defaultValue={v("not_following_message")} className={input} />
              </Field>
              <Field label="If the check fails" hint="When Instagram won't answer. Sent with the same two buttons.">
                <textarea name="verification_error_message" rows={2} maxLength={640} defaultValue={v("verification_error_message")} className={input} />
              </Field>
            </div>
          </Section>

          <div className="flex gap-2">
            <button className={btnPrimary}>Save automation</button>
            <Link href="/automations" className={btnGhost}>Cancel</Link>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <DmPreview formId="automation-form" username={username} />
        </aside>
      </div>
    </form>
  );
}
