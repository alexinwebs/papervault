import type { Metadata } from "next";
import Link from "next/link";
import { Clause, LegalDoc } from "@/components/LegalDoc";
import { documentRetentionDays, reapplyCooldownDays } from "@/server/services/teacher-verification";

export const metadata: Metadata = {
  title: "Teacher Verification Policy",
  description: "How PaperVault verifies teachers and handles their documents.",
};

export default function TeacherVerificationPolicyPage() {
  return (
    <LegalDoc
      title="Teacher Verification Policy"
      updated="8 October 2026"
      summary="The Verified Teacher badge tells students that a person really teaches where they say they do. It is granted only after a platform admin reviews proof."
    >
      <Clause heading="What we ask for">
        <p>
          Your name, institution, department, designation and subjects, plus up to three documents that show your teaching affiliation
          — for example a staff ID card or an appointment letter. PDF, JPG or PNG only.
        </p>
        <p>
          Please cover or blur anything we don&rsquo;t need, such as Aadhaar numbers, home addresses, salary details or bank
          information. Don&rsquo;t upload government ID unless we specifically ask.
        </p>
      </Clause>
      <Clause heading="Who sees your documents">
        <p>
          Documents are kept in private storage, are never public, and can only be opened by a platform admin. Every time an admin
          opens one, it is recorded in our audit log. Files are scanned for malware before they are stored.
        </p>
      </Clause>
      <Clause heading="How long we keep them">
        <p>
          After a decision (approval, rejection, withdrawal or revocation) documents are securely deleted after {documentRetentionDays()}{" "}
          days, or sooner if an admin deletes them. We keep a record that a decision was made, by whom and when, because that is part of
          our audit trail.
        </p>
      </Clause>
      <Clause heading="Decisions">
        <ul className="list-disc pl-5">
          <li>We may ask for more information before deciding.</li>
          <li>If we reject a request we tell you why. You can apply again after {reapplyCooldownDays()} days.</li>
          <li>
            We may revoke verification if it was obtained with false information or you no longer teach at the institution. Your
            account goes back to a student account.
          </li>
          <li>You can have only one open request at a time.</li>
        </ul>
      </Clause>
      <Clause heading="What the badge means">
        <p>
          It means we reviewed evidence of a teaching affiliation. It does not mean PaperVault or the institution endorses your
          comments, and it gives no moderation powers.
        </p>
      </Clause>
      <p>
        Apply from <Link href="/teacher-verification" className="underline">Teacher verification</Link>. To ask for your data or its
        deletion see <Link href="/legal/data-rights" className="underline">Data Rights</Link>.
      </p>
    </LegalDoc>
  );
}
