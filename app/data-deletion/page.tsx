// Public page for Meta's "User data deletion" setting (App settings → Basic → Data deletion instructions URL).
// ponytail: instructions only; deletion is done by hand. Add Meta's signed deletion callback if request volume grows.
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Data deletion · AutoDM" };

const contact = process.env.CONTACT_EMAIL;

export default function DataDeletionPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-sm leading-relaxed text-zinc-300">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-100">User data deletion</h1>
      <p className="mt-2 text-zinc-500">AutoDM is a private tool that replies to Instagram comments and sends direct messages on behalf of one Instagram business account.</p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100">What we store about you</h2>
      <p className="mt-2">If you commented on a post or messaged the account, we may store:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>your Instagram-scoped user ID and the comment or message that triggered an automation;</li>
        <li>a log of the replies and messages we sent you, with their delivery status;</li>
        <li>whether you followed the account when we checked.</li>
      </ul>
      <p className="mt-2">We never store your password, and we never sell or share this data.</p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100">How to request deletion</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>
          {contact ? (
            <>Email <a href={`mailto:${contact}?subject=Data%20deletion%20request`} className="font-medium text-accent hover:underline">{contact}</a></>
          ) : (
            <>Send a direct message to the Instagram account you interacted with</>
          )}{" "}
          with the subject <strong className="text-zinc-100">“Data deletion request”</strong>.
        </li>
        <li>Include your Instagram username so we can find your records.</li>
        <li>We delete all of your data within 30 days and confirm by replying to you.</li>
      </ol>

      <h2 className="mt-8 text-base font-semibold text-zinc-100">Removing app access</h2>
      <p className="mt-2">
        If you connected an Instagram account to this app, you can revoke its access at any time in Instagram:
        Settings → Website permissions → Apps and websites → Remove. Revoking access stops all automations for that account.
      </p>
    </main>
  );
}
