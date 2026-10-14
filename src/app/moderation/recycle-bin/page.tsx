import { SuccessPopup } from "@/components/SuccessPopup";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackBar, EmptyState, PageHeading, Panel } from "@/components/ui";
import { Forbidden } from "@/components/Forbidden";
import { getSessionUser } from "@/lib/auth";
import { canModerate } from "@/server/authz";
import { deletedPapers, RETENTION_DAYS } from "@/server/services/recycle-bin";
import { formatDate } from "@/lib/utils";
import { PurgeForm, RestoreForm } from "./forms";

export const metadata: Metadata = { title: "Recycle bin", robots: { index: false } };

const FLASH: Record<string, string> = {
  deleted: "Paper moved to the recycle bin.",
  restored: "Paper restored — it is back in the review queue.",
  purged: "Paper deleted for good.",
};

function daysLeft(deletedAt: Date) {
  const elapsed = (Date.now() - deletedAt.getTime()) / (24 * 60 * 60_000);
  return Math.max(0, Math.ceil(RETENTION_DAYS - elapsed));
}

export default async function RecycleBinPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/moderation/recycle-bin");
  if (!canModerate(user.role)) return <Forbidden area="Moderation" />;

  const { done } = await searchParams;
  const scope = user.role === "PLATFORM_ADMIN" ? null : user.collegeId;
  const papers = await deletedPapers(scope);

  return (
    <div className="flex flex-col gap-5">
      <BackBar fallback="/moderation" />
      <PageHeading
        eyebrow="Moderation"
        title="Recycle bin"
        description={`Removed papers stay here for ${RETENTION_DAYS} days so a mistake can be undone. After that a nightly job deletes them and their files permanently.`}
      />

      {done && FLASH[done] ? (
        <SuccessPopup message={`${FLASH[done]}`} />
      ) : null}

      {papers.length === 0 ? (
        <EmptyState title="The bin is empty" body="Nothing has been removed recently." />
      ) : (
        <ul className="flex flex-col gap-2">
          {papers.map((paper) => (
            <li key={paper.id}>
              <Panel className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <h2 className="pv-section-title truncate">{paper.title}</h2>
                  <p className="font-mono text-[11px] text-ink/60">
                    Uploaded by {paper.uploadedBy?.name ?? "an unknown contributor"} · removed by{" "}
                    {paper.deletedBy?.name ?? "a moderator"} on{" "}
                    {paper.deletedAt ? formatDate(paper.deletedAt) : "—"} ·{" "}
                    {paper.deletedAt ? `${daysLeft(paper.deletedAt)} days left` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RestoreForm paperId={paper.id} />
                  {user.role === "PLATFORM_ADMIN" ? <PurgeForm paperId={paper.id} /> : null}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
