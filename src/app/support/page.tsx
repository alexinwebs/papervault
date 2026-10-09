import Link from "next/link";
import type { Metadata } from "next";
import { BackBar, PageHeading, Panel } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TICKET_ATTACHMENT_MAX_BYTES, TICKET_CATEGORIES, type TicketCategory } from "@/lib/constants";
import { NewTicketForm } from "./forms";

export const metadata: Metadata = { title: "Support", robots: { index: false } };

type Search = { category?: string; paperId?: string; commentId?: string; userId?: string };

export default async function SupportPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <BackBar fallback="/" />
        <PageHeading eyebrow="Help" title="Support" description="Sign in to open a support ticket and follow it up." />
        <Link href="/login?next=/support" className="pv-btn-primary self-start">
          Sign in
        </Link>
        <p className="font-sans text-xs text-ink/70">
          Copyright owners without an account can use the{" "}
          <Link href="/legal/takedown" className="pv-link">takedown form</Link>. General contact details are on the{" "}
          <Link href="/legal/contact" className="pv-link">contact page</Link>.
        </p>
      </div>
    );
  }

  const category = (TICKET_CATEGORIES as readonly string[]).includes(params.category ?? "")
    ? (params.category as TicketCategory)
    : "";
  const [colleges, paper, member, comment] = await Promise.all([
    prisma.college.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    params.paperId ? prisma.paper.findUnique({ where: { id: params.paperId }, select: { id: true, title: true } }) : null,
    params.userId ? prisma.user.findUnique({ where: { id: params.userId }, select: { id: true, name: true } }) : null,
    params.commentId ? prisma.comment.findUnique({ where: { id: params.commentId }, select: { id: true, paperId: true } }) : null,
  ]);
  const relatedLabel = paper ? `paper “${paper.title}”` : member ? `member ${member.name}` : comment ? "a comment" : "";
  const subject =
    category === "REPORT_PAPER" && paper
      ? `Report: ${paper.title}`.slice(0, 140)
      : category === "REPORT_USER" && member
        ? `Report member: ${member.name}`.slice(0, 140)
        : category === "REPORT_COMMENT" && comment
          ? "Report a comment"
          : "";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <BackBar fallback="/" />
      <PageHeading
        eyebrow="Help"
        title="Open a support ticket"
        description="Ask for a new college or subject, report a problem, or get help with your account. Every ticket gets a number and you can follow it in My tickets."
        aside={
          <Link href="/my-tickets" className="pv-btn-secondary px-3 py-1.5 text-xs" prefetch={false}>
            My tickets
          </Link>
        }
      />
      <Panel className="px-4 py-4">
        <NewTicketForm
          colleges={colleges}
          maxBytes={TICKET_ATTACHMENT_MAX_BYTES}
          defaults={{
            category,
            subject,
            relatedPaperId: paper?.id ?? "",
            relatedCommentId: comment?.id ?? "",
            relatedUserId: member && member.id !== user.id ? member.id : "",
            relatedLabel,
          }}
        />
      </Panel>
      <p className="font-sans text-xs text-ink/60">
        Copyright notices are handled through the <Link href="/legal/takedown" className="pv-link">takedown process</Link>. See also the{" "}
        <Link href="/legal/guidelines" className="pv-link">community guidelines</Link>.
      </p>
    </div>
  );
}
