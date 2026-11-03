// Public terms of service for Meta's App settings → Basic → Terms of Service URL.
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of service · AutoDM" };

const contact = process.env.CONTACT_EMAIL;
const h2 = "mt-8 text-base font-semibold text-zinc-100";

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-sm leading-relaxed text-zinc-300">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Terms of service</h1>
      <p className="mt-2 text-zinc-500">Last updated: November 3, 2026</p>
      <p className="mt-4">
        These terms cover AutoDM, a private tool operated by Solopreneurshub that automatically replies to Instagram comments and
        sends direct messages for one connected Instagram professional account. By interacting with that account’s automations or
        connecting an account to AutoDM, you agree to these terms.
      </p>

      <h2 className={h2}>The service</h2>
      <p className="mt-2">
        When you comment a keyword on a post, AutoDM may reply to your comment and send you a direct message with the content you
        asked for. It may check whether you follow the account before sharing that content. AutoDM is not affiliated with, endorsed
        by or sponsored by Meta or Instagram.
      </p>

      <h2 className={h2}>Acceptable use</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Use the service only as allowed by Instagram’s Terms of Use and Meta’s Platform Terms.</li>
        <li>Do not try to abuse, overload, reverse engineer or gain unauthorized access to the service.</li>
        <li>Do not use the automations to send spam or unlawful content.</li>
      </ul>

      <h2 className={h2}>Availability</h2>
      <p className="mt-2">
        The service is provided “as is”, without warranties of any kind. Replies and messages depend on Instagram’s API and may be
        delayed, limited or unavailable. We may change, pause or stop the service at any time.
      </p>

      <h2 className={h2}>Liability</h2>
      <p className="mt-2">To the extent permitted by law, we are not liable for any indirect or consequential loss arising from use of the service.</p>

      <h2 className={h2}>Privacy</h2>
      <p className="mt-2">
        How we handle your data is described in our <Link href="/privacy" className="font-medium text-accent hover:underline">privacy policy</Link>.
        To have your data deleted, see the <Link href="/data-deletion" className="font-medium text-accent hover:underline">data deletion page</Link>.
      </p>

      <h2 className={h2}>Changes and contact</h2>
      <p className="mt-2">
        We may update these terms; the date above shows the latest version.{" "}
        {contact ? (
          <>Questions: <a href={`mailto:${contact}`} className="font-medium text-accent hover:underline">{contact}</a>.</>
        ) : (
          <>Questions: send a direct message to the Instagram account you interacted with.</>
        )}
      </p>
    </main>
  );
}
