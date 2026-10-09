import type { Metadata } from "next";
import Link from "next/link";
import { Clause, LegalDoc } from "@/components/LegalDoc";
import { ContactClause } from "@/components/ContactClause";

export const metadata: Metadata = {
  title: "Contact",
  description: "How to reach the PaperVault team.",
};

export default function ContactPage() {
  return (
    <LegalDoc
      title="Contact"
      updated="8 October 2026"
      summary="The fastest way to reach us depends on what you need."
    >
      <Clause heading="Members">
        <p>
          Signed in? Open a ticket from <Link href="/support" className="underline">Support</Link> — it gets a reference number and you
          can follow the conversation under <Link href="/my-tickets" className="underline">My tickets</Link>. Use it to request a new
          college or subject, report a problem or ask about your account.
        </p>
      </Clause>
      <Clause heading="Copyright, colleges and examiners">
        <p>
          Use the <Link href="/legal/takedown" className="underline">takedown form</Link>. No account is needed and you&rsquo;ll get a
          reference by email.
        </p>
      </Clause>
      <ContactClause />
    </LegalDoc>
  );
}
