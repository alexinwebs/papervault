import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BadgeCheck } from "lucide-react";
import { BackBar, Chip, EmptyState, Panel, SectionHeader, StatsCard } from "@/components/ui";
import { PaperList } from "@/components/PaperRow";
import { contributorProfile } from "@/server/services/library";
import { formatDate } from "@/lib/utils";
import { getSessionUser } from "@/lib/auth";
import { ReportUserDialog } from "@/components/PaperActions";

export const metadata: Metadata = { title: "Contributor", robots: { index: false } };

export default async function ContributorPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [profile, viewer] = await Promise.all([contributorProfile(userId).catch(() => null), getSessionUser()]);
  if (!profile) notFound();

  const trust =
    profile.user.trustLevel === "TRUSTED_CONTRIBUTOR"
      ? "Trusted contributor"
      : profile.user.trustLevel === "VERIFIED_CONTRIBUTOR"
        ? "Verified contributor"
        : "Contributor";

  return (
    <div className="flex flex-col gap-5">
      <BackBar fallback="/" />
      <Panel className="bg-lavender px-5 py-5">
        <p className="pv-eyebrow">Contributor profile</p>
        <h1 className="pv-h2 mt-2">{profile.user.name}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Chip accent="mint">
            <BadgeCheck className="h-3 w-3" aria-hidden /> {trust}
          </Chip>
          {profile.user.role === "TEACHER" ? <Chip accent="mint">Verified Teacher</Chip> : null}
          {profile.user.college ? <Chip>{profile.user.college.shortName}</Chip> : null}
          <Chip>Joined {formatDate(profile.user.createdAt)}</Chip>
        </div>
        {viewer && viewer.id !== profile.user.id ? (
          <div className="mt-3">
            <ReportUserDialog userId={profile.user.id} name={profile.user.name} />
          </div>
        ) : null}
        <div className="mt-4 grid max-w-lg grid-cols-3 gap-3">
          <StatsCard value={String(profile.published)} label="Papers contributed" />
          <StatsCard value={String(profile.verified)} label="Verified papers" />
          <StatsCard value={String(profile.helpfulReports)} label="Helpful reports" />
        </div>
      </Panel>

      <section>
        <SectionHeader title="Contribution history" />
        {profile.history.length === 0 ? (
          <EmptyState title="No published papers yet." />
        ) : (
          <PaperList papers={profile.history} />
        )}
      </section>
    </div>
  );
}
