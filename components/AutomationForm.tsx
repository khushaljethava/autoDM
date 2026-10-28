import Link from "next/link";
import { saveAutomation } from "@/app/actions";
import type { Automation } from "@/lib/engine";
import type { Media } from "@/lib/instagram";
import { btnGhost, btnPrimary, Card, Field, Flash, input } from "@/components/ui";

const DEFAULTS = {
  initial_message: "Thanks for commenting, {username}! Tap below and I'll send it over 👇",
  button_label: "Send me the link",
  content_message: "Here you go! 🎉",
  link_button_label: "Open link",
  not_following_message: "This one's for followers 💛 Follow the account, then tap “I've followed” and I'll check again.",
  verification_error_message: "I couldn't check that just now. Give it a minute and tap “Try again”.",
};

export function AutomationForm({ a, media, mediaError, msg }: { a?: Automation; media: Media[]; mediaError?: string; msg?: string }) {
  const v = (k: keyof typeof DEFAULTS) => a?.[k] ?? DEFAULTS[k];
  const trigger = a?.trigger_type ?? "comment";
  const selectedMedia = a?.media_id ?? "any";
  const radio = "peer sr-only";
  const choice = "block cursor-pointer rounded-lg border border-black/10 p-3 text-sm peer-checked:border-foreground peer-checked:ring-1 peer-checked:ring-foreground dark:border-white/10";

  return (
    <form action={saveAutomation} className="max-w-3xl space-y-6">
      <Flash msg={msg} />
      {a && <input type="hidden" name="id" value={a.id} />}

      <Card title="Basics">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Name">
            <input name="name" required maxLength={80} defaultValue={a?.name} placeholder="Free guide" className={input} />
          </Field>
          <label className="flex items-center gap-2 pb-2 text-sm">
            <input type="checkbox" name="is_active" defaultChecked={a ? !!a.is_active : true} /> Active
          </label>
        </div>
      </Card>

      <Card title="Trigger">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["comment", "Comment on a post", "Someone comments a keyword on a post or Reel"],
            ["dm", "DM keyword", "Someone sends you a keyword in DMs"],
            ["story_reply", "Story reply", "Someone replies to your story with a keyword"],
          ].map(([value, title, desc]) => (
            <label key={value}>
              <input type="radio" name="trigger_type" value={value} defaultChecked={trigger === value} className={radio} />
              <span className={choice}>
                <span className="block font-medium">{title}</span>
                <span className="text-xs text-black/50 dark:text-white/50">{desc}</span>
              </span>
            </label>
          ))}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-[1fr_14rem]">
          <Field label="Keywords" hint="Comma separated. Case-insensitive. Ignored when matching any message.">
            <input name="keywords" defaultValue={a?.keywords?.split("\n").join(", ")} placeholder="GUIDE, EBOOK, PDF" className={input} />
          </Field>
          <Field label="Match mode">
            <select name="match_mode" defaultValue={a?.match_mode ?? "exact"} className={input}>
              <option value="exact">Exact: the whole message is the keyword</option>
              <option value="contains">Contains: keyword appears as a word</option>
              <option value="any">Any message triggers</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card title={<>Post or Reel <span className="font-normal text-black/50 dark:text-white/50">(comment triggers only)</span></>}>
        {mediaError && <p className="mb-3 text-sm text-red-600 dark:text-red-400">Couldn&apos;t load posts: {mediaError}</p>}
        <div className="grid max-h-[28rem] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
          <label>
            <input type="radio" name="media_id" value="any" defaultChecked={selectedMedia === "any"} className={radio} />
            <span className={`${choice} flex aspect-square items-center justify-center text-center font-medium`}>Any post</span>
          </label>
          {a?.media_id && !media.some((m) => m.id === a.media_id) && (
            <label>
              <input type="radio" name="media_id" value={a.media_id} defaultChecked className={radio} />
              <span className={`${choice} flex aspect-square items-center justify-center text-center text-xs`}>{a.media_caption?.slice(0, 80) || `Post ${a.media_id}`}</span>
            </label>
          )}
          {media.map((m) => (
            <label key={m.id}>
              <input type="radio" name="media_id" value={m.id} defaultChecked={selectedMedia === m.id} className={radio} />
              <span className={`${choice} overflow-hidden p-0`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- Instagram CDN URLs expire; next/image would cache them */}
                <img src={m.thumbnail_url ?? m.media_url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
                <span className="block truncate px-2 py-1.5 text-xs">
                  <span className="text-black/50 dark:text-white/50">{m.media_product_type === "REELS" ? "Reel" : m.media_type.toLowerCase()} · </span>
                  {m.caption || "No caption"}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Card>

      <Card title="Opening DM (comment triggers)">
        <div className="space-y-4">
          <Field label="Message" hint="Sent as a private reply to the comment. Use {username} to greet them.">
            <textarea name="initial_message" rows={3} maxLength={640} defaultValue={v("initial_message")} className={input} />
          </Field>
          <Field label="Button label" hint="Max 20 characters. Tapping it starts the follow check.">
            <input name="button_label" maxLength={20} defaultValue={v("button_label")} className={input} />
          </Field>
          <Field label="Public comment replies (optional)" hint="One per line; a random one is posted under the comment.">
            <textarea name="comment_replies" rows={3} defaultValue={a?.comment_replies} placeholder={"Sent! Check your DMs 📬\nJust DMed you {username} ✨"} className={input} />
          </Field>
        </div>
      </Card>

      <Card title="Content">
        <div className="space-y-4">
          <Field label="Content message">
            <textarea name="content_message" rows={3} required maxLength={640} defaultValue={v("content_message")} className={input} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <Field label="Protected link (optional)" hint="http(s) only. Sent as a tappable button, with a plain-text fallback.">
              <input name="content_url" type="url" pattern="https?://.+" defaultValue={a?.content_url ?? ""} placeholder="https://example.com/guide" className={input} />
            </Field>
            <Field label="Link button label">
              <input name="link_button_label" maxLength={20} defaultValue={v("link_button_label")} className={input} />
            </Field>
          </div>
        </div>
      </Card>

      <Card title="Follow gate">
        <div className="space-y-4">
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="require_follow" defaultChecked={a ? !!a.require_follow : true} className="mt-1" />
            <span>
              Only deliver to followers
              <span className="block text-xs text-black/50 dark:text-white/50">
                Checked with Instagram&apos;s <code>is_user_follow_business</code>. If Instagram can&apos;t answer, the content is held back and the error message is sent instead.
              </span>
            </span>
          </label>
          <Field label="Not-following message" hint="Sent with “Visit profile” and “I've followed” buttons.">
            <textarea name="not_following_message" rows={2} maxLength={640} defaultValue={v("not_following_message")} className={input} />
          </Field>
          <Field label="Verification-error message" hint="Sent with a “Try again” button.">
            <textarea name="verification_error_message" rows={2} maxLength={640} defaultValue={v("verification_error_message")} className={input} />
          </Field>
        </div>
      </Card>

      <div className="flex gap-3">
        <button className={btnPrimary}>Save automation</button>
        <Link href="/automations" className={btnGhost}>Cancel</Link>
      </div>
    </form>
  );
}
