import type { Metadata } from "next";
import Link from "next/link";
import { ContactClause } from "@/components/ContactClause";
import { Clause, LegalDoc } from "@/components/LegalDoc";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The rules for using PaperVault, contributing papers and moderating the archive.",
};

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Use"
      updated="1 January 2026"
      summary="PaperVault is a student-run archive of past question papers. By using it you agree to these terms."
    >
      <Clause heading="1. Who can use PaperVault">
        <p>
          Accounts are for students, alumni and staff of the colleges listed in the archive. You
          must give a real name and a working email address, and you are responsible for everything
          done through your account. Keep your password private and tell us if it is compromised.
        </p>
      </Clause>
      <Clause heading="2. What you may upload">
        <p>You may upload a question paper only if all of the following are true:</p>
        <ul className="list-disc pl-5">
          <li>The exam has already been held and the paper has been released to students.</li>
          <li>You are permitted to share it, and sharing it breaks no college rule or contract.</li>
          <li>It contains no personal information — no roll numbers, names, or marked answers.</li>
          <li>It is a genuine paper, not a reconstruction passed off as the original.</li>
        </ul>
        <p>
          Never upload a live, leaked or upcoming paper. Doing so is grounds for immediate and
          permanent removal from the platform, and we will cooperate with your college.
        </p>
      </Clause>
      <Clause heading="3. Rights in what you upload">
        <p>
          Question papers are usually the copyright of the college or university that set them.
          Uploading a paper does not transfer copyright to you or to PaperVault. You grant us a
          non-exclusive licence to store, display and distribute the file for the educational
          purpose of this archive, and you confirm you believe the upload is lawful.
        </p>
        <p>
          Rights holders can have material removed at any time — see the{" "}
          <Link href="/legal/takedown" className="pv-link">
            takedown policy
          </Link>
          .
        </p>
      </Clause>
      <Clause heading="4. Discussions">
        <p>
          Comments exist to help other students understand a paper. Be civil. Do not post personal
          attacks, spam, contact details, paid-service adverts, or solicitations to cheat. Authors
          can edit a comment for fifteen minutes and delete it at any time; moderators can remove
          any comment and must record a reason, which is shown in its place.
        </p>
      </Clause>
      <Clause heading="5. Moderation and enforcement">
        <p>
          Every upload is reviewed before publication. Moderators may approve, reject, restrict or
          unpublish material, and administrators may suspend accounts that break these terms.
          Moderation actions are recorded in an audit log. If your account is suspended you can
          reply to the notification email to appeal.
        </p>
      </Clause>
      <Clause heading="6. Availability and liability">
        <p>
          PaperVault is provided as-is, without warranty. We do not guarantee that a paper is
          complete, correct, or the version your college used. To the extent the law allows, we are
          not liable for losses arising from your use of the archive, including exam outcomes.
        </p>
      </Clause>
      <Clause heading="7. Changes">
        <p>
          We will update these terms as the platform grows and will change the date at the top when
          we do. Material changes will be announced in-app before they take effect.
        </p>
      </Clause>
      <ContactClause />
    </LegalDoc>
  );
}
