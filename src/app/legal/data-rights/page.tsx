import type { Metadata } from "next";
import Link from "next/link";
import { Clause, LegalDoc } from "@/components/LegalDoc";
import { ContactClause } from "@/components/ContactClause";

export const metadata: Metadata = {
  title: "Data Rights",
  description: "How to access, correct, export or erase your PaperVault data.",
};

export default function DataRightsPage() {
  return (
    <LegalDoc
      title="Data Rights"
      updated="8 October 2026"
      summary="You can see, correct, download and erase the personal data PaperVault holds about you. Most of it you can do yourself from Settings."
    >
      <Clause heading="Download your data">
        <p>
          <Link href="/settings" className="underline">Settings</Link> has an export that includes your profile, uploads, comments,
          bookmarks, pinned colleges, support tickets and teacher verification history.
        </p>
      </Clause>
      <Clause heading="Correct your data">
        <p>You can change your name and email address in Settings. For anything else, open a ticket from <Link href="/support" className="underline">Support</Link>.</p>
      </Clause>
      <Clause heading="Erase your account">
        <p>
          Account erasure in Settings removes your identity: your name and email are replaced, sessions ended, and private items such
          as bookmarks, pins, tickets and teacher verification documents deleted. Published papers stay in the archive without your
          name, because other students rely on them.
        </p>
        <p>
          Some records are kept because we need them to run the service safely: the audit log of moderation and admin actions, and
          records of takedown notices. These keep the account reference only, not your name or email.
        </p>
      </Clause>
      <Clause heading="Withdraw consent and object">
        <p>
          You can withdraw a pending teacher verification at any time. You can turn off non-essential emails in Settings where
          offered. See the <Link href="/legal/privacy" className="underline">Privacy Policy</Link> for the full list of what we collect
          and why.
        </p>
      </Clause>
      <ContactClause />
    </LegalDoc>
  );
}
