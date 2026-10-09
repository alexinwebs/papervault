import type { Metadata } from "next";
import Link from "next/link";
import { Clause, LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Community Guidelines",
  description: "How to take part in PaperVault: uploads, comments and conduct.",
};

export default function GuidelinesPage() {
  return (
    <LegalDoc
      title="Community Guidelines"
      updated="8 October 2026"
      summary="PaperVault works because students share past papers carefully and talk to each other with respect. These rules apply to every upload, comment, report and ticket."
    >
      <Clause heading="Upload only what you may share">
        <ul className="list-disc pl-5">
          <li>Past question papers from exams that have already been held, or papers your college or university has released.</li>
          <li>No current, upcoming or leaked exam material — see the <Link href="/legal/academic-integrity" className="underline">Academic Integrity Policy</Link>.</li>
          <li>No marked answer scripts, roll numbers, signatures or anyone&rsquo;s personal details.</li>
          <li>Tell us the right college, subject, exam and year. Wrong metadata makes the archive worse for everyone.</li>
        </ul>
      </Clause>
      <Clause heading="Comment like a classmate">
        <ul className="list-disc pl-5">
          <li>Doubts, corrections and hints are welcome. Spam, advertising and link-dropping are not.</li>
          <li>No harassment, threats, hate or targeted abuse, and no sharing other people&rsquo;s private information.</li>
          <li>Don&rsquo;t impersonate a teacher, moderator or another student. The Verified Teacher badge is only granted after review.</li>
        </ul>
      </Clause>
      <Clause heading="Reporting">
        <p>
          Use <strong>Report</strong> on a paper, comment or member profile. Reports are reviewed by people; one report never bans
          anyone automatically. Don&rsquo;t file false or retaliatory reports. See <Link href="/legal/report-content" className="underline">Report Content</Link>.
        </p>
      </Clause>
      <Clause heading="What happens if rules are broken">
        <p>Depending on how serious and how repeated the problem is, a moderator or admin may:</p>
        <ul className="list-disc pl-5">
          <li>remove the content;</li>
          <li><strong>warn</strong> the account;</li>
          <li><strong>restrict</strong> it (read-only: no uploads, comments or tickets);</li>
          <li><strong>suspend</strong> it for a period; or</li>
          <li><strong>ban</strong> it.</li>
        </ul>
        <p>
          You&rsquo;ll be told what action was taken and why. If you think we got it wrong, open a ticket from{" "}
          <Link href="/support" className="underline">Support</Link> with the category &ldquo;Account&rdquo;.
        </p>
      </Clause>
    </LegalDoc>
  );
}
