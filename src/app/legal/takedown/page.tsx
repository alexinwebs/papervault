import type { Metadata } from "next";
import { Clause, LegalDoc } from "@/components/LegalDoc";
import { TakedownForm } from "./form";

export const metadata: Metadata = {
  title: "Takedown Policy",
  description: "How rights holders and individuals can have material removed from PaperVault.",
};

export default function TakedownPage() {
  return (
    <LegalDoc
      title="Takedown Policy"
      updated="1 January 2026"
      summary="Tell us what is wrong and we will act. You do not need an account to file a notice."
    >
      <Clause heading="What we remove">
        <ul className="list-disc pl-5">
          <li>Material posted without the rights holder&rsquo;s permission.</li>
          <li>Live, leaked or upcoming exam papers — these are removed immediately on report.</li>
          <li>Anything containing personal information, such as a roll number or a marked script.</li>
          <li>Papers a college asks us not to distribute, whether or not copyright applies.</li>
        </ul>
      </Clause>
      <Clause heading="How it works">
        <ol className="list-decimal pl-5">
          <li>You file the notice below and receive a reference number by email.</li>
          <li>
            A moderator reviews it, normally within two working days. Clearly impermissible
            material is unpublished first and reviewed afterwards.
          </li>
          <li>
            We email you the outcome. If we remove a paper, the uploader is told what was removed
            and why, but never who filed the notice.
          </li>
        </ol>
        <p>
          Signed-in students should use the <strong>Report</strong> button on a paper or comment
          instead — it reaches the same queue with the context already attached.
        </p>
      </Clause>
      <Clause heading="Counter-notice">
        <p>
          If your upload was removed and you believe that was a mistake, reply to the removal email
          within fourteen days explaining why. A different moderator will review the decision.
        </p>
      </Clause>
      <Clause heading="File a notice">
        <TakedownForm />
      </Clause>
    </LegalDoc>
  );
}
