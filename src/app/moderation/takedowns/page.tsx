import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackBar, EmptyState, PageHeading, Panel } from "@/components/ui";
import { StatusChip } from "@/components/VerificationBadge";
import { ResolveTakedownForm } from "@/components/ModerationActions";
import { Forbidden } from "@/components/Forbidden";
import { getSessionUser } from "@/lib/auth";
import { canModerate } from "@/server/authz";
import { openTakedowns, recentActionedTakedowns } from "@/server/services/takedowns";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Takedown notices", robots: { index: false } };

const ROLE_LABEL: Record<string, string> = {
  RIGHTS_HOLDER: "Rights holder",
  AUTHORISED_AGENT: "Authorised agent",
  SUBJECT_OF_DATA: "Personal information",
};

export default async function TakedownQueuePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/moderation/takedowns");
  if (!canModerate(user.role)) return <Forbidden area="Moderation" />;

  const [requests, actioned] = await Promise.all([openTakedowns(user), recentActionedTakedowns(user)]);

  return (
    <div className="flex flex-col gap-5">
      <BackBar fallback="/moderation" />
      <PageHeading
        eyebrow="Moderation"
        title="Takedown notices"
        description="Notices filed by rights holders and individuals through the public form. Act on them first, then record what you did — the claimant is emailed automatically."
      />

      {requests.length === 0 ? (
        <EmptyState
          title="Nothing outstanding"
          body="Every takedown notice has been reviewed."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Panel className="flex flex-col gap-3 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="pv-eyebrow">
                      Ref {request.id.slice(-8).toUpperCase()} · {formatDate(request.createdAt)}
                    </p>
                    <h2 className="pv-section-title mt-1">
                      {request.claimantName}
                      {request.claimantOrg ? ` · ${request.claimantOrg}` : ""}
                    </h2>
                    <p className="font-mono text-xs text-ink/70">{request.claimantEmail}</p>
                  </div>
                  <span className="pv-chip bg-pink">
                    {ROLE_LABEL[request.claimantRole] ?? request.claimantRole}
                  </span>
                </div>

                <p className="whitespace-pre-wrap font-sans text-sm text-ink/85">{request.reason}</p>

                <div className="flex flex-wrap items-center gap-2 border-t-2 border-ink/20 pt-3 font-mono text-xs">
                  <span className="text-ink/60">Target</span>
                  {request.paper ? (
                    <>
                      <Link
                        href={`/moderation/${request.paper.id}`}
                        prefetch={false}
                        className="pv-link"
                      >
                        {request.paper.title}
                      </Link>
                      <StatusChip status={request.paper.status} />
                    </>
                  ) : (
                    <span className="break-all text-ink/70">
                      {request.paperUrl} (no matching paper)
                    </span>
                  )}
                </div>

                {request.status !== "OPEN" ? (
                  <p className="font-mono text-[11px] text-ink/70">
                    Status: {request.status.replace(/_/g, " ").toLowerCase()}
                    {request.reviewRequest ? ` — review request: ${request.reviewRequest}` : ""}
                  </p>
                ) : null}
                <ResolveTakedownForm id={request.id} status={request.status} />
              </Panel>
            </li>
          ))}
        </ul>
      )}

      {actioned.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="pv-section-title">Actioned in the last 90 days</h2>
          <p className="font-sans text-xs text-ink/70">
            If the uploader contests a removal (for example through a support ticket), record it as a review request, then restore
            or close.
          </p>
          <ul className="flex flex-col gap-2">
            {actioned.map((request) => (
              <li key={request.id}>
                <Panel className="flex flex-col gap-2 px-4 py-3">
                  <p className="font-mono text-xs">
                    Ref {request.id.slice(-8).toUpperCase()} · {request.claimantName} ·{" "}
                    {request.paper ? request.paper.title : request.paperUrl}
                  </p>
                  {request.resolution ? <p className="font-sans text-xs text-ink/70">{request.resolution}</p> : null}
                  <ResolveTakedownForm id={request.id} status={request.status} />
                </Panel>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
