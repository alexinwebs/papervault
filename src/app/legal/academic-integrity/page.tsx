import type { Metadata } from "next";
import Link from "next/link";
import { Clause, LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Academic Integrity Policy",
  description: "What may and may not be shared on PaperVault, and how exam material is classified.",
};

export default function AcademicIntegrityPage() {
  return (
    <LegalDoc
      title="Academic Integrity Policy"
      updated="8 October 2026"
      summary="PaperVault is a revision archive of past papers. It is not a place to obtain or spread exam material that is still confidential."
    >
      <Clause heading="Prohibited material">
        <ul className="list-disc pl-5">
          <li>Question papers for an exam that is still running or has not yet taken place.</li>
          <li>Leaked, stolen or otherwise confidential examination material.</li>
          <li>Answer keys or solutions where the institution prohibits sharing them.</li>
          <li>Anything intended to help someone cheat.</li>
        </ul>
      </Clause>
      <Clause heading="How uploads are classified">
        <p>Every upload carries one of these classifications:</p>
        <ul className="list-disc pl-5">
          <li><strong>Past</strong> — the exam has already been held.</li>
          <li><strong>Released</strong> — the college or university has officially released the paper.</li>
          <li><strong>Current</strong> or <strong>Upcoming</strong> — refused at upload.</li>
          <li><strong>Unknown</strong> — held back from the public until a moderator confirms it.</li>
        </ul>
        <p>
          Only past or released papers are ever published, and only after a moderator has reviewed them. Papers from the current
          exam cycle are held automatically.
        </p>
      </Clause>
      <Clause heading="Emergency restriction">
        <p>
          If a paper is reported as current or upcoming exam material it is taken out of search and downloads straight away while
          it is reviewed. The record of what happened is kept in our audit log.
        </p>
      </Clause>
      <Clause heading="Colleges and examiners">
        <p>
          If you are responsible for an examination and believe material on PaperVault should not be available, use the{" "}
          <Link href="/legal/takedown" className="underline">takedown process</Link>. You don&rsquo;t need an account.
        </p>
      </Clause>
      <Clause heading="Consequences">
        <p>
          Uploading prohibited material leads to its removal and may lead to the account being restricted, suspended or banned, as set
          out in the <Link href="/legal/guidelines" className="underline">Community Guidelines</Link>.
        </p>
      </Clause>
    </LegalDoc>
  );
}
