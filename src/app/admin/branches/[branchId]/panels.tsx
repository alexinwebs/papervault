"use client";

import { useState } from "react";
import { Panel } from "@/components/ui";
import { AdminForm, DeleteButton } from "../../forms";
import {
  applyCurriculumAction,
  importSubjectsAction,
  updateSubjectAction,
} from "@/server/actions/admin";

/** Applies the shared catalogue template for this program and branch. */
export function CurriculumPanel({
  branchId,
  collegeId,
  template,
  existing,
}: {
  branchId: string;
  collegeId: string;
  template: { key: string; subjects: number } | null;
  existing: number;
}) {
  return (
    <Panel className="px-4 py-4">
      <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.12em]">Catalogue template</h2>
      {template ? (
        <>
          <p className="mb-3 font-sans text-xs text-ink/70">
            The shared catalogue holds <strong>{template.subjects}</strong> semester-wise subjects
            for <code className="font-mono">{template.key}</code>. This branch currently has{" "}
            {existing}. Applying it fills in anything missing — nothing is deleted, and subject
            codes already here are left alone.
          </p>
          <AdminForm
            idPrefix="apply-curriculum"
            action={applyCurriculumAction}
            submitLabel="Apply catalogue"
            columns={1}
            hidden={{ branchId, collegeId }}
            fields={[
              {
                name: "overwriteNames",
                label: "Also rename existing subjects to match the catalogue",
                type: "checkbox",
              },
            ]}
          />
        </>
      ) : (
        <p className="font-sans text-xs text-ink/70">
          No catalogue entry exists for this program and branch combination. Use the paste importer
          below, or add subjects one at a time.
        </p>
      )}
    </Panel>
  );
}

const EXAMPLE = `5, KCS501, Database Management Systems
5 | KCS502 | Compiler Design
KCS503 Design and Analysis of Algorithms`;

/** Paste-to-import for a whole syllabus table. */
export function ImportPanel({
  branchId,
  collegeId,
  semesterCount,
}: {
  branchId: string;
  collegeId: string;
  semesterCount: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Panel className="px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em]">Paste a syllabus</h2>
        <button
          type="button"
          className="pv-btn-secondary px-3 py-1 text-xs"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Hide importer" : "Open importer"}
        </button>
      </div>
      {open ? (
        <div className="mt-3">
          <p className="mb-3 font-sans text-xs text-ink/70">
            One subject per line. Commas, tabs and pipes all work as separators, and the columns can
            be in any order — a bare number is read as the semester and a course-code pattern is
            read as the code. Lines that cannot be read are counted and skipped rather than
            guessed at. Existing codes are renamed, not duplicated.
          </p>
          <AdminForm
            idPrefix="import-subjects"
            action={importSubjectsAction}
            submitLabel="Import subjects"
            columns={1}
            hidden={{ branchId, collegeId }}
            fields={[
              {
                name: "rows",
                label: "Subjects",
                type: "textarea",
                required: true,
                placeholder: EXAMPLE,
                span: 2,
              },
              {
                name: "defaultSemester",
                label: "Semester for lines that do not say",
                type: "number",
                hint: `1 to ${semesterCount}.`,
              },
              {
                name: "replace",
                label: "Replace every existing subject in the semesters covered by this paste",
                type: "checkbox",
              },
            ]}
          />
        </div>
      ) : null}
    </Panel>
  );
}

/** One subject: read-only until the admin opens the inline editor. */
export function SubjectRow({
  subject,
  collegeId,
}: {
  subject: { id: string; name: string; code: string; slug: string; archived: boolean };
  collegeId: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="pv-panel-flat px-3 py-3">
        <AdminForm
          idPrefix={`edit-subject-${subject.id}`}
          action={updateSubjectAction}
          submitLabel="Save subject"
          resetOnSuccess={false}
          hidden={{ subjectId: subject.id, collegeId }}
          fields={[
            { name: "code", label: "Code", required: true, defaultValue: subject.code },
            { name: "name", label: "Name", required: true, defaultValue: subject.name },
            { name: "slug", label: "URL slug", defaultValue: subject.slug },
            {
              name: "archived",
              label: "Archived",
              type: "checkbox",
              defaultValue: subject.archived ? "true" : "",
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
      <span className="min-w-0 font-sans text-xs">
        <span className="font-mono">{subject.code}</span> — {subject.name}
        {subject.archived ? (
          <span className="ml-2 font-mono text-[10px] uppercase text-ink/55">archived</span>
        ) : null}
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
          entity="subject"
          id={subject.id}
          label={subject.name}
          collegeId={collegeId}
          compact
        />
      </span>
    </div>
  );
}
