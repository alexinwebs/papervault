import type { Metadata } from "next";
import Link from "next/link";
import { Clause, LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Report Content",
  description: "How to report a paper, comment or member on PaperVault.",
};

export default function ReportContentPage() {
  return (
    <LegalDoc
      title="Report Content"
      updated="8 October 2026"
      summary="Something wrong? Tell us. Every report is read by a person."
    >
      <Clause heading="Papers">
        <p>
          Open the paper and use <strong>Report</strong>. Reasons include copyright or rights issues, current or upcoming exam
          material, wrong details, duplicates, confidential material and personal information. Current-exam reports take the paper
          offline immediately while we look.
        </p>
      </Clause>
      <Clause heading="Comments">
        <p>Use <strong>Report</strong> under the comment: spam, harassment, abuse, inappropriate content, hate, misleading information or repeated violations.</p>
      </Clause>
      <Clause heading="Members">
        <p>Open the member&rsquo;s profile and use <strong>Report member</strong>, for example for impersonation or harassment.</p>
      </Clause>
      <Clause heading="Copyright and other legal notices">
        <p>
          Rights holders, colleges and examiners can use the <Link href="/legal/takedown" className="underline">takedown form</Link> without
          an account.
        </p>
      </Clause>
      <Clause heading="What happens next">
        <p>
          A moderator or admin reviews the report and the evidence. One report never bans anyone automatically. If you want to follow
          up, open a ticket from <Link href="/support" className="underline">Support</Link>.
        </p>
      </Clause>
    </LegalDoc>
  );
}
