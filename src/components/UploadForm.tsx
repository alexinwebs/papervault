"use client";

import { useActionState, useMemo, useState } from "react";
import { Camera, FileUp, UploadCloud } from "lucide-react";
import { CameraCapture, type CapturedPage } from "./CameraCapture";
import { uploadPaperAction } from "@/server/actions/papers";
import { idle } from "@/server/actions/types";
import { FieldError, FormBanner, SubmitButton } from "./Form";
import { academicYears, formatBytes } from "@/lib/utils";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";

type Subject = { id: string; name: string; code: string };
type Semester = { id: string; number: number; subjects: Subject[] };
type Branch = { id: string; name: string; code: string; semesters: Semester[] };
type Program = { id: string; name: string; branches: Branch[] };
export type CollegeOption = {
  id: string;
  name: string;
  programs: Program[];
  examTypes: { id: string; code: string; name: string }[];
};

export function UploadForm({ colleges }: { colleges: CollegeOption[] }) {
  const [state, action] = useActionState(uploadPaperAction, idle);
  const [collegeId, setCollegeId] = useState(colleges[0]?.id ?? "");
  const [programId, setProgramId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [semesterId, setSemesterId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"file" | "camera">("file");
  const [pages, setPages] = useState<CapturedPage[]>([]);

  const college = useMemo(() => colleges.find((c) => c.id === collegeId), [colleges, collegeId]);
  const program = college?.programs.find((p) => p.id === programId);
  const branch = program?.branches.find((b) => b.id === branchId);
  const semester = branch?.semesters.find((s) => s.id === semesterId);

  const capturedBytes = useMemo(
    // base64 is ~4/3 of the binary size; close enough to warn before upload.
    () => Math.round(pages.reduce((sum, page) => sum + page.dataUrl.length * 0.75, 0)),
    [pages],
  );

  const fileError =
    mode === "file"
      ? file && file.size > MAX_UPLOAD_BYTES
        ? `File is ${formatBytes(file.size)}. Limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`
        : undefined
      : capturedBytes > MAX_UPLOAD_BYTES
        ? `Captured pages come to ${formatBytes(capturedBytes)}. Limit is ${formatBytes(MAX_UPLOAD_BYTES)}. Remove a page or two.`
        : undefined;

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormBanner state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="pv-label" htmlFor="collegeId">
            College
          </label>
          <select
            id="collegeId"
            name="collegeId"
            className="pv-input"
            value={collegeId}
            onChange={(e) => {
              setCollegeId(e.target.value);
              setProgramId("");
              setBranchId("");
              setSemesterId("");
            }}
            required
          >
            <option value="">Select a college</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <FieldError error={state.fieldErrors?.collegeId} />
        </div>

        <div>
          <label className="pv-label" htmlFor="programId">
            Program
          </label>
          <select
            id="programId"
            name="programId"
            className="pv-input"
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value);
              setBranchId("");
              setSemesterId("");
            }}
            disabled={!college}
            required
          >
            <option value="">Select a program</option>
            {college?.programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <FieldError error={state.fieldErrors?.programId} />
        </div>

        <div>
          <label className="pv-label" htmlFor="branchId">
            Branch
          </label>
          <select
            id="branchId"
            name="branchId"
            className="pv-input"
            value={branchId}
            onChange={(e) => {
              setBranchId(e.target.value);
              setSemesterId("");
            }}
            disabled={!program}
            required
          >
            <option value="">Select a branch</option>
            {program?.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <FieldError error={state.fieldErrors?.branchId} />
        </div>

        <div>
          <label className="pv-label" htmlFor="semesterId">
            Semester
          </label>
          <select
            id="semesterId"
            name="semesterId"
            className="pv-input"
            value={semesterId}
            onChange={(e) => setSemesterId(e.target.value)}
            disabled={!branch}
            required
          >
            <option value="">Select a semester</option>
            {branch?.semesters.map((s) => (
              <option key={s.id} value={s.id}>
                Semester {s.number}
              </option>
            ))}
          </select>
          <FieldError error={state.fieldErrors?.semesterId} />
        </div>

        <div>
          <label className="pv-label" htmlFor="subjectId">
            Subject
          </label>
          <select id="subjectId" name="subjectId" className="pv-input" disabled={!semester} required>
            <option value="">Select a subject</option>
            {semester?.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
          <FieldError error={state.fieldErrors?.subjectId} />
        </div>

        <div>
          <label className="pv-label" htmlFor="examTypeId">
            Exam type
          </label>
          <select id="examTypeId" name="examTypeId" className="pv-input" disabled={!college} required>
            <option value="">Select an exam type</option>
            {college?.examTypes.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
          <FieldError error={state.fieldErrors?.examTypeId} />
        </div>

        <div>
          <label className="pv-label" htmlFor="academicYear">
            Academic year
          </label>
          <select id="academicYear" name="academicYear" className="pv-input" required>
            {academicYears(8).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <FieldError error={state.fieldErrors?.academicYear} />
        </div>

        <div>
          <label className="pv-label" htmlFor="examClassification">
            Has this exam already been held?
          </label>
          <select id="examClassification" name="examClassification" className="pv-input" required defaultValue="">
            <option value="" disabled>
              Choose one
            </option>
            <option value="PAST">Yes — it&apos;s a past exam</option>
            <option value="RELEASED">Officially released by the college / university</option>
            <option value="UNKNOWN">Not sure</option>
            <option value="CURRENT">No — the exam is still running</option>
            <option value="UPCOMING">No — the exam hasn&apos;t happened yet</option>
          </select>
          <FieldError error={state.fieldErrors?.examClassification} />
        </div>

        <div>
          <label className="pv-label" htmlFor="sessionLabel">
            Exam session <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <input
            id="sessionLabel"
            name="sessionLabel"
            className="pv-input"
            placeholder="e.g. Odd 2025-26"
            maxLength={60}
          />
        </div>

        <div>
          <label className="pv-label" htmlFor="setLabel">
            Paper set
          </label>
          <input id="setLabel" name="setLabel" className="pv-input" defaultValue="Set A" maxLength={20} />
        </div>
      </div>

      <div>
        <span className="pv-label">
          Paper pages — up to {formatBytes(MAX_UPLOAD_BYTES)}
        </span>

        <div
          role="tablist"
          aria-label="How would you like to add the paper?"
          className="mb-3 flex flex-wrap gap-2"
        >
          {(
            [
              ["file", "Choose a file", FileUp],
              ["camera", "Take photos", Camera],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => setMode(value)}
              className={
                mode === value
                  ? "border-2 border-ink bg-navy px-3 py-2 font-mono text-xs text-cream shadow-hard-sm"
                  : "border-2 border-ink bg-paper px-3 py-2 font-mono text-xs"
              }
            >
              <Icon className="mr-1 inline h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {/* Captured pages ride along as JSON; the server turns them into a PDF. */}
        <input type="hidden" name="captureMode" value={mode} />
        {mode === "camera" ? (
          <input
            type="hidden"
            name="capturedPages"
            value={JSON.stringify(pages.map((page) => page.dataUrl))}
          />
        ) : null}

        {mode === "file" ? (
          <label
            htmlFor="file"
            className="flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed border-ink rounded-sm bg-paper px-4 py-8 text-center"
          >
            <UploadCloud className="h-6 w-6" aria-hidden />
            <span className="font-mono text-xs uppercase tracking-[0.1em]">
              {file ? file.name : "Choose a file or drop it here"}
            </span>
            <span className="text-[11px] text-ink/60">
              {file ? formatBytes(file.size) : "PDF, JPG or PNG"}
            </span>
            <input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required={mode === "file"}
            />
          </label>
        ) : (
          <div className="border-2 border-dashed border-ink rounded-sm bg-paper px-4 py-4">
            <CameraCapture pages={pages} onChange={setPages} />
            <p className="mt-3 font-sans text-[11px] text-ink/60">
              Photograph each page in order, in good light, with the whole sheet in frame. On a
              phone you can also use “Choose a file” to pick a photo you already took.
            </p>
          </div>
        )}
        <FieldError error={fileError ?? state.fieldErrors?.file} />
      </div>

      <div>
        <label className="pv-label" htmlFor="notes">
          Notes for moderators <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <textarea id="notes" name="notes" className="pv-input" rows={3} maxLength={500} />
      </div>

      <p className="font-sans text-[11px] leading-relaxed text-ink/60">
        Uploads are reviewed before publication. Do not upload current or upcoming exam material,
        or anything you are not permitted to share.
      </p>

      <SubmitButton
        pendingLabel={mode === "camera" ? "Building your PDF…" : "Uploading…"}
        className="self-start"
      >
        Submit paper
      </SubmitButton>
    </form>
  );
}
