"use client";

import Link from "next/link";
import { useState } from "react";
import { Chip, Panel } from "@/components/ui";
import { AdminForm, DeleteButton } from "../../forms";
import { updateExamTypeAction, updateProgramAction } from "@/server/actions/admin";

type BranchSummary = {
  id: string;
  code: string;
  name: string;
  archived: boolean;
  semesterCount: number;
  subjectCount: number;
};

type ProgramSummary = {
  id: string;
  name: string;
  slug: string;
  level: string;
  semesterCount: number;
  archived: boolean;
  branches: BranchSummary[];
};

/** One degree, with its branches linking through to the branch workspace. */
export function ProgramRow({
  program,
  collegeId,
}: {
  program: ProgramSummary;
  collegeId: string;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <Panel className="px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ink pb-2">
        <h3 className="flex flex-wrap items-center gap-2 font-display text-base">
          {program.name}
          <span className="font-sans text-[11px] text-ink/60">
            {program.level} · {program.semesterCount} semesters · {program.branches.length} branches
          </span>
          {program.archived ? <Chip accent="yellow">archived</Chip> : null}
        </h3>
        <span className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="pv-btn-secondary px-2 py-1 text-[11px]"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? "Cancel" : "Edit"}
          </button>
          <DeleteButton
            entity="program"
            id={program.id}
            label={program.name}
            collegeId={collegeId}
            compact
          />
        </span>
      </div>

      {editing ? (
        <div className="mt-3 border-b-2 border-ink/20 pb-4">
          <AdminForm
            idPrefix={`edit-program-${program.id}`}
            action={updateProgramAction}
            submitLabel="Save degree"
            resetOnSuccess={false}
            hidden={{ programId: program.id, collegeId }}
            fields={[
              { name: "name", label: "Name", required: true, defaultValue: program.name },
              { name: "slug", label: "URL slug", defaultValue: program.slug },
              {
                name: "level",
                label: "Level",
                type: "select",
                defaultValue: program.level,
                options: [
                  { value: "UG", label: "Undergraduate" },
                  { value: "PG", label: "Postgraduate" },
                ],
              },
              {
                name: "semesterCount",
                label: "Semesters",
                type: "number",
                required: true,
                defaultValue: program.semesterCount,
              },
              {
                name: "archived",
                label: "Archived (hidden from students)",
                type: "checkbox",
                defaultValue: program.archived ? "true" : "",
              },
            ]}
          />
        </div>
      ) : null}

      <ul className="mt-3 flex flex-col gap-2">
        {program.branches.map((branch) => (
          <li key={branch.id} className="pv-row flex-wrap justify-between gap-2">
            <Link
              href={`/admin/branches/${branch.id}`}
              prefetch={false}
              className="pv-link-title min-w-0 font-mono text-sm"
            >
              <span className="truncate">
                {branch.code} — {branch.name}
              </span>
            </Link>
            <span className="flex flex-wrap items-center gap-2 font-sans text-[11px] text-ink/60">
              {branch.semesterCount} sem · {branch.subjectCount} subjects
              {branch.archived ? " · archived" : ""}
              <Link
                href={`/admin/branches/${branch.id}`}
                prefetch={false}
                className="pv-btn-secondary px-2 py-1 text-[11px] no-underline"
              >
                Manage
              </Link>
            </span>
          </li>
        ))}
        {program.branches.length === 0 ? (
          <li className="font-sans text-xs text-ink/55">No branches yet.</li>
        ) : null}
      </ul>
    </Panel>
  );
}

/** One exam type, editable in place. */
export function ExamTypeRow({
  examType,
  collegeId,
}: {
  examType: { id: string; code: string; name: string; sortOrder: number };
  collegeId: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="pv-panel-flat px-3 py-3">
        <AdminForm
          idPrefix={`edit-examtype-${examType.id}`}
          action={updateExamTypeAction}
          submitLabel="Save exam type"
          resetOnSuccess={false}
          columns={1}
          hidden={{ examTypeId: examType.id, collegeId }}
          fields={[
            { name: "code", label: "Code", required: true, defaultValue: examType.code },
            { name: "name", label: "Display name", required: true, defaultValue: examType.name },
            {
              name: "sortOrder",
              label: "Sort order",
              type: "number",
              defaultValue: examType.sortOrder,
            },
          ]}
        />
        <button
          type="button"
          className="pv-link mt-2 font-mono text-[11px]"
          onClick={() => setEditing(false)}
        >
          Done editing
        </button>
      </div>
    );
  }

  return (
    <div className="pv-row flex-wrap justify-between gap-2">
      <span className="font-mono text-xs">
        {examType.code} · {examType.name}
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="pv-btn-secondary px-2 py-1 text-[11px]"
          onClick={() => setEditing(true)}
        >
          Edit
        </button>
        <DeleteButton
          entity="examType"
          id={examType.id}
          label={examType.name}
          collegeId={collegeId}
          compact
        />
      </span>
    </div>
  );
}
