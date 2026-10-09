import Link from "next/link";
import type { Metadata } from "next";
import { PageHeading, Panel } from "@/components/ui";
import { UploadForm, type CollegeOption } from "@/components/UploadForm";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Upload a paper", robots: { index: false } };

export default async function UploadPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeading eyebrow="Contribute" title="Sign in to upload" />
        <Panel className="px-5 py-6">
          <p className="text-sm">
            Uploads are tied to a contributor account so moderators can verify them.
          </p>
          <Link href="/login?next=/upload" className="pv-btn-primary mt-4">
            Sign in
          </Link>
        </Panel>
      </div>
    );
  }

  const colleges = await prisma.college.findMany({
    orderBy: [{ featured: "desc" }, { name: "asc" }],
    include: {
      examTypes: { orderBy: { sortOrder: "asc" }, select: { id: true, code: true, name: true } },
      programs: {
        where: { archived: false },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          branches: {
            where: { archived: false },
            orderBy: { name: "asc" },
            select: {
              id: true,
              name: true,
              code: true,
              semesters: {
                orderBy: { number: "asc" },
                select: {
                  id: true,
                  number: true,
                  subjects: {
                    where: { archived: false },
                    orderBy: { name: "asc" },
                    select: { id: true, name: true, code: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeading
        eyebrow="Contribute"
        title="Upload a paper"
        description="Add a past or released question paper. Moderators review every submission before it is published."
      />
      <Panel className="px-5 py-5">
        <UploadForm colleges={colleges as CollegeOption[]} />
      </Panel>
    </div>
  );
}
