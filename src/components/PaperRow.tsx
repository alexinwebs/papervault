import Link from "next/link";
import { FileText } from "lucide-react";
import { ExamTypeChip } from "./ExamTypeChip";
import { Chip } from "./ui";
import { VerificationBadge } from "./VerificationBadge";
import { paperContext } from "@/lib/links";
import { formatDate } from "@/lib/utils";


type Paper = Parameters<typeof paperContext>[0] & {
  id: string;
  title: string;
  verification: string;
  restricted: boolean;
  status: string;
  createdAt: Date;
  publishedAt: Date | null;
};

export function PaperRow({ paper, showCollege = true }: { paper: Paper; showCollege?: boolean }) {
  const ctx = paperContext(paper);
  return (
    <li className="pv-row paper-row gap-3">
      <span className="paper-row-icon border-2 border-ink rounded-sm bg-cream p-2" aria-hidden>
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="paper-row-title truncate font-mono text-sm font-bold">{paper.title}</p>
        <p className="mt-[2px] text-[11px] text-ink/70">
          {showCollege ? `${ctx.college.shortName} · ` : ""}
          {ctx.program.name} {ctx.branch.code} · Semester {ctx.semesterNumber} · {ctx.subject.code}
          {ctx.sessionLabel ? ` · ${ctx.sessionLabel}` : ""}
          {ctx.setLabel !== "Set A" ? ` · ${ctx.setLabel}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ExamTypeChip code={ctx.examType.code} />
        <Chip>{ctx.academicYear}</Chip>
        <VerificationBadge verification={paper.verification} restricted={paper.restricted} />
      </div>
      <div className="flex items-center gap-3">
        <span className="paper-row-date font-sans text-[11px] text-ink/50">
          {formatDate(paper.publishedAt ?? paper.createdAt)}
        </span>
        <Link href={`/papers/${paper.id}`} prefetch={false} className="pv-btn-secondary">
          View →
        </Link>
      </div>
    </li>
  );
}

export function PaperList({
  papers,
  showCollege = true,
}: {
  papers: Paper[];
  showCollege?: boolean;
}) {
  return (
    <ul className="paper-list flex flex-col gap-2">
      {papers.map((paper) => (
        <PaperRow key={paper.id} paper={paper} showCollege={showCollege} />
      ))}
    </ul>
  );
}
