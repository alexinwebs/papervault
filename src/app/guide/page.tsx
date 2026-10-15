import Link from "next/link";
import type { Metadata } from "next";
import { PageHeading, Panel } from "@/components/ui";

export const metadata: Metadata = { title: "Start here", description: "Find the right past paper, share collections and help your batch contribute safely.", alternates: { canonical: "/guide" } };

export default function GuidePage() {
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
    <PageHeading eyebrow="A useful archive, together" title="Find papers. Help your batch." description="PaperVault organises past papers so your class can share one collection instead of repeatedly forwarding files. You do not need an account or an upload to read public papers." />
    <Panel className="bg-blue-light p-5"><h2 className="pv-section-title">Find the right paper</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm"><li>Choose your college, program, branch and semester.</li><li>Open the subject and check its printed code and curriculum against your syllabus.</li><li>Choose the exam type. Check the test number, academic session and set in the actual document—ST-1 and ST-2 are not interchangeable.</li><li>Preview or download the published paper. Share the collection link with your class.</li></ol>
      <Link href="/colleges" className="pv-btn-primary mt-4">Find your college</Link>
    </Panel>
    <Panel className="p-5"><h2 className="pv-section-title">Have a copy others need?</h2>
      <p className="mt-3 text-sm">Check Papers Wanted for a specific gap, or contribute from a subject page. The subject link carries known details into the upload form.</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm"><li>Use a clear, upright PDF or photo with its header and all pages visible.</li><li>Preview it and correct detected details. Automatic recognition can be incomplete or wrong; manual entry remains available.</li><li>Remove personal identifiers before uploading, and confirm you are allowed to share the paper.</li><li>Track review in My Library. An upload is not publicly available until a moderator publishes it; review time varies.</li></ol>
      <p className="mt-3 text-sm">Class representatives and seniors: maintain a collection link for your batch. You do not need to upload the same shared paper separately for every branch.</p>
      <div className="mt-4 flex flex-wrap gap-2"><Link href="/requests" className="pv-btn-primary">See papers wanted</Link><Link href="/upload" className="pv-btn-secondary">Contribute a paper</Link></div>
    </Panel>
    <Panel className="p-5" ><h2 id="review-labels" className="pv-section-title scroll-mt-24">What review labels mean</h2>
      <dl className="mt-3 space-y-3 text-sm"><div><dt className="font-bold">Unverified</dt><dd>No additional verification label has been assigned. Check the document.</dd></div><div><dt className="font-bold">Community verified</dt><dd>A community-review label, not institutional endorsement.</dd></div><div><dt className="font-bold">Verified</dt><dd>A moderator-assigned label. It does not guarantee authenticity or compatibility with your syllabus.</dd></div><div><dt className="font-bold">College verified</dt><dd>A college-level review label. Do not assume official institutional endorsement without supporting evidence.</dd></div><div><dt className="font-bold">Restricted</dt><dd>File access is limited. Current or uncertain exam material can be held back for review.</dd></div></dl>
      <p className="mt-4 text-sm">Labels are not predictions of exam questions or guarantees of academic results. Use past papers alongside your current syllabus and teaching materials.</p>
    </Panel>
    <Panel className="bg-yellow p-5"><h2 className="pv-section-title">Missing, wrong or unreadable?</h2><p className="mt-3 text-sm">On a subject page, choose an exam type and year to request a missing paper. Requests show demand; they do not guarantee someone can supply a copy. Check My Library for availability. Report incorrect metadata, unreadable files, personal information or copyright concerns through the paper’s Report action or Support.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/support" className="pv-link">Contact support</Link><Link href="/legal/academic-integrity" className="pv-link">Academic integrity</Link><Link href="/legal/takedown" className="pv-link">Takedown policy</Link></div></Panel>
  </div>;
}
