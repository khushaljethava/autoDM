// Public privacy policy for Meta's App settings → Basic → Privacy Policy URL (required to publish the app).
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy policy · AutoDM" };

const contact = process.env.CONTACT_EMAIL;
const h2 = "mt-8 text-base font-semibold text-zinc-100";

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-sm leading-relaxed text-zinc-300">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Privacy policy</h1>
      <p className="mt-2 text-zinc-500">Last updated: November 3, 2026</p>
      <p className="mt-4">
        AutoDM is a private tool operated by Solopreneurshub. It connects to one Instagram professional account through the
        Instagram API and automatically replies to comments and sends direct messages on that account’s behalf.
      </p>

      <h2 className={h2}>Information we collect</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li><strong className="text-zinc-100">Connected account:</strong> the Instagram user ID, username and an access token (stored encrypted) for the account that connected the app.</li>
        <li><strong className="text-zinc-100">People who interact with that account:</strong> the Instagram-scoped user ID and text of comments or messages that trigger an automation, whether the person follows the account when we check, and a log of the replies and messages we sent.</li>
      </ul>
      <p className="mt-2">We do not collect passwords, contact lists, payment details or data from accounts that never interacted with the connected account.</p>

      <h2 className={h2}>How we use it</h2>
      <p className="mt-2">Only to run the automations the account owner sets up: matching comments to keywords, replying, sending the requested direct messages, and showing the owner an activity log. We do not use it for advertising or profiling.</p>

      <h2 className={h2}>Sharing</h2>
      <p className="mt-2">We do not sell or share this data. It is sent only to Meta’s Instagram API to deliver replies and messages, and stored with our hosting and database providers (Vercel and Turso) to run the service.</p>

      <h2 className={h2}>Retention</h2>
      <p className="mt-2">Data is kept while the account stays connected and automations are in use. Disconnecting the account removes its access token. You can ask us to delete your data at any time.</p>

      <h2 className={h2}>Your choices</h2>
      <p className="mt-2">
        To delete your data, follow the steps on our <Link href="/data-deletion" className="font-medium text-accent hover:underline">data deletion page</Link>.
        You can revoke the app’s access in Instagram under Settings → Website permissions → Apps and websites.
      </p>

      <h2 className={h2}>Contact</h2>
      <p className="mt-2">
        {contact ? (
          <>Questions about this policy: <a href={`mailto:${contact}`} className="font-medium text-accent hover:underline">{contact}</a>.</>
        ) : (
          <>Questions about this policy: send a direct message to the Instagram account you interacted with.</>
        )}
      </p>
    </main>
  );
}
