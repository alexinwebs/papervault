import type { Metadata } from "next";
import Link from "next/link";
import { ContactClause } from "@/components/ContactClause";
import { Clause, LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What PaperVault collects, why it collects it, and the control you have over it.",
};

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="27 September 2026"
      summary="We collect the minimum needed to run a moderated archive, and we never sell it."
    >
      <Clause heading="What we collect">
        <ul className="list-disc pl-5">
          <li>
            <strong>Account data</strong> — your name, email address, college, and a hash of your
            password. We never store the password itself.
          </li>
          <li>
            <strong>Contributions</strong> — the papers you upload, their metadata, your comments,
            and the reports you file.
          </li>
          <li>
            <strong>Session data</strong> — one record per signed-in device with its browser
            description, approximate location from the request IP, and last-seen time, so you can
            spot and revoke a session you do not recognise.
          </li>
          <li>
            <strong>Audit records</strong> — moderation and administrative actions, kept so
            decisions can be explained and reversed.
          </li>
        </ul>
        <p>There is no third-party advertising or behavioural tracking on PaperVault.</p>
      </Clause>
      <Clause heading="Support tickets and teacher verification">
        <p>
          When you open a support ticket we keep what you write, any files you attach, and the replies. Files are stored privately and
          only you and platform admins can open them. Admins may add internal notes to a ticket that are not shown to you.
        </p>
        <p>
          If you apply to become a Verified Teacher we collect the details on the form and the documents you upload. Only platform
          admins can view them, each view is logged, and documents are deleted after the decision as described in the{" "}
          <Link href="/legal/teacher-verification" className="underline">Teacher Verification Policy</Link>.
        </p>
      </Clause>
      <Clause heading="Why we use it">
        <p>
          To authenticate you, to attribute and moderate contributions, to send the notifications
          you have opted into, to enforce rate limits and detect abuse, and to produce the
          aggregate statistics shown on the statistics page. Aggregates never identify you beyond
          the public contributor profile that already carries your name.
        </p>
      </Clause>
      <Clause heading="What is public">
        <p>
          Your display name, college and contribution counts appear on your contributor profile and
          next to papers and comments you post. Your email address, session list and notification
          preferences are never public.
        </p>
      </Clause>
      <Clause heading="Email">
        <p>
          We send account email — verification, password reset and security notices — regardless of
          preference, because they protect your account. Moderation decisions, comment replies and
          the weekly digest are optional and can be switched off in{" "}
          <Link href="/settings" className="pv-link">
            Settings
          </Link>
          .
        </p>
      </Clause>
      <Clause heading="Retention">
        <p>
          Account data is kept while your account exists. Verification and password-reset tokens are
          single-use and expire within hours. Removed comments keep a placeholder so threads stay
          readable, but the original text is no longer served. Deleted papers go to a recycle bin
          and are purged permanently after thirty days.
        </p>
      </Clause>
      <Clause heading="Your control">
        <p>
          From{" "}
          <Link href="/settings" className="pv-link">
            Settings
          </Link>{" "}
          you can correct your profile, change your password, revoke any session, adjust email
          preferences, download your data, and erase your account.
        </p>
        <ul className="list-disc pl-5">
          <li>
            <strong>Download your data</strong> gives you a JSON file containing your profile, your
            uploads, your comments, your bookmarks and pinned colleges, the reports and requests you filed, and your
            sign-in history. Password hashes, two-factor secrets and session tokens are excluded on
            purpose.
          </li>
          <li>
            <strong>Erase your account</strong> permanently overwrites your name, email address,
            password, two-factor setup, bookmarks, pinned colleges, reading history, reports and messages, withdraws
            the text of your comments, and signs out every device. It takes effect immediately and
            cannot be undone. You will be asked for your password and to type a confirmation word.
          </li>
        </ul>
        <p>
          Papers you contributed stay in the archive after erasure, under an anonymous author with
          no link back to you. They are shared study material that other students rely on, and
          removing them would damage the archive rather than protect you. If a specific paper must
          come down, use the{" "}
          <Link href="/legal/takedown" className="pv-link">
            takedown process
          </Link>
          .
        </p>
      </Clause>
      <Clause heading="Security">
        <p>
          Passwords are hashed with a slow, salted algorithm. Sessions are server-side records that
          can be revoked instantly. Uploads are virus-scanned and re-written through a PDF parser
          that strips embedded scripts. Files are served through an authorising route, never from a
          public bucket path.
        </p>
      </Clause>
      <ContactClause />
    </LegalDoc>
  );
}
