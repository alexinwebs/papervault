"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Camera, FileUp, UploadCloud, Eye, LoaderCircle } from "lucide-react";
import { SuggestionInput } from "./SuggestionInput";
import { CameraCapture, type CapturedPage } from "./CameraCapture";
import { textKey, type CatalogueDraft, type DetectionResult } from "@/lib/paper-detection";
import { branchCodeFromName } from "@/lib/upload-details";
const UploadPreview = dynamic(() => import("./UploadPreview").then((m) => m.UploadPreview), { ssr: false });
import { uploadPaperAction } from "@/server/actions/papers";
import { idle } from "@/server/actions/types";
import { FieldError, FormBanner, SubmitButton } from "./Form";
import { academicYears, formatBytes } from "@/lib/utils";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";

type Subject = { id: string; name: string; code: string };
type Semester = { id: string; number: number; subjects: Subject[] };
type Branch = { id: string; name: string; code: string; semesters: Semester[] };
type Program = { id: string; name: string; branches: Branch[] };

/** Same normalisation as the server's subjectKey(): case and punctuation don't matter. */
const subjectKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");
export type CollegeOption = {
  id: string;
  name: string;
  shortName?: string;
  programs: Program[];
  examTypes: { id: string; code: string; name: string }[];
};

/** Starting values when the form is opened from a subject page or search. */
export type UploadPrefill = {
  collegeId: string;
  programId: string;
  branchId: string;
  semesterId: string;
  subjectId: string;
  examTypeId?: string;
  academicYear?: number;
  summary: string;
};

export function UploadForm({ colleges, prefill }: { colleges: CollegeOption[]; prefill?: UploadPrefill }) {
  const [state, action, statePending] = useActionState(uploadPaperAction, idle);
  const [collegeId, setCollegeId] = useState(prefill?.collegeId ?? "");
  const [programId, setProgramId] = useState(prefill?.programId ?? "");
  const [branchId, setBranchId] = useState(prefill?.branchId ?? "");
  const [semesterId, setSemesterId] = useState(prefill?.semesterId ?? "");
  const [subjectId, setSubjectId] = useState(prefill?.subjectId ?? "");
  const [alsoIds, setAlsoIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"file" | "camera">("file");
  const [pages, setPages] = useState<CapturedPage[]>([]);

  const edited = useRef(new Set<string>());
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => { setPreviewOpen(false); }, [file, mode]);
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectionError, setDetectionError] = useState("");
  const [automatic, setAutomatic] = useState(false);
  const [entryMode, setEntryMode] = useState<"detect" | "manual" | "existing">(prefill ? "existing" : "detect");
  const [confirmed, setConfirmed] = useState(false);
  const [draft, setDraft] = useState<CatalogueDraft>({ collegeName: "", programName: "", branchName: "", branchCode: "", semesterNumber: 0, subjectName: "", subjectCode: "", examCode: "" });
  const [examId, setExamId] = useState(prefill?.examTypeId ?? "");
  const [sessionLabel, setSessionLabel] = useState("");
  const [detectionAttempt, setDetectionAttempt] = useState(0);
  const [year, setYear] = useState(prefill?.academicYear ?? academicYears(8)[0]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    if (entryMode !== "detect") { setDetecting(false); return; }
    if (mode === "file" ? !file || file.size > MAX_UPLOAD_BYTES : !pages.length) {
      setDetecting(false); setDetection(null); setDetectionError(""); return;
    }
    setDetecting(true); setDetection(null); setDetectionError(""); setConfirmed(false);
    if (!detectionAttempt) setDraft((previous) => {
      const clean = { collegeName: "", programName: "", branchName: "", branchCode: "", semesterNumber: 0, subjectName: "", subjectCode: "", examCode: "" } as CatalogueDraft;
      for (const key of edited.current) if (key in previous) Object.assign(clean, { [key]: previous[key as keyof CatalogueDraft] });
      return clean;
    });
    if (!edited.current.has("existing")) { setCollegeId(""); setProgramId(""); setBranchId(""); setSemesterId(""); setSubjectId(""); if (!edited.current.has("examCode")) setExamId(""); setAutomatic(true); }
    if (!detectionAttempt && !edited.current.has("sessionLabel")) setSessionLabel("");
    const timer = setTimeout(async () => {
      try {
        const data = new FormData();
        data.set("captureMode", mode);
        if (mode === "file" && file) data.set("file", file);
        else data.set("capturedPages", JSON.stringify(pages.slice(0, 2).map((p) => p.dataUrl)));
        const response = await fetch("/api/papers/detect", { method: "POST", body: data, credentials: "same-origin", signal: controller.signal });
        const result = await response.json();
        if (cancelled) return;
        const found = result.data?.detection as DetectionResult | undefined;
        if (!result.ok || !found) { setDetectionError(result.message ?? "Could not read this paper. Enter the details manually."); return; }
        setDetection(found); setConfirmed(false);
        setDraft((previous) => {
          const merged = { ...previous };
          for (const key of ["collegeName", "programName", "branchName", "branchCode", "semesterNumber", "subjectName", "subjectCode", "examCode", "university"] as const) {
            if (!edited.current.has(key) && found.fields[key] !== undefined) Object.assign(merged, { [key]: found.fields[key] });
          }
          return merged;
        });
        if (found.fields.academicYear && !edited.current.has("academicYear")) setYear(found.fields.academicYear);
        if (found.fields.sessionLabel && !edited.current.has("sessionLabel")) setSessionLabel(found.fields.sessionLabel);
        if (found.match && !edited.current.size) {
          const m = found.match;
          setCollegeId(m.collegeId); setProgramId(m.programId); setBranchId(m.branchId);
          setSemesterId(m.semesterId); setSubjectId(m.subjectId); setAlsoIds([]);
          setExamId(m.examTypeId ?? ""); setAutomatic(Boolean(found.fields.examCode && !m.examTypeId));
        } else if (!edited.current.has("existing") && (found.fields.collegeName || found.fields.subjectName || found.fields.subjectCode || found.fields.semesterNumber || found.fields.programName)) {
          setAutomatic(true); setAlsoIds([]);
        }
      } catch { if (!cancelled) setDetectionError("Could not read this paper. You can enter the details manually."); }
      finally { if (!cancelled) setDetecting(false); }
    }, 350);
    return () => { cancelled = true; controller.abort(); clearTimeout(timer); };
  }, [file, mode, pages, entryMode, detectionAttempt]);

  const automaticCollege = colleges.find((c) => textKey(c.name) === textKey(draft.collegeName));
  const automaticProgram = automaticCollege?.programs.find((p) => textKey(p.name) === textKey(draft.programName));
  const college = useMemo(() => colleges.find((c) => c.id === collegeId), [colleges, collegeId]);
  const program = college?.programs.find((p) => p.id === programId);
  const branch = program?.branches.find((b) => b.id === branchId);
  const semester = branch?.semesters.find((s) => s.id === semesterId);
  const subject = semester?.subjects.find((s) => s.id === subjectId);

  // The same subject in the program's other branches: matching code, or the
  // same name. A DBMS paper for CSE is usually the one IT and IoT sat too.
  const siblings = useMemo(() => {
    if (!program || !branch || !subject) return [];
    const code = subject.code.trim().toLowerCase();
    const key = subjectKey(subject.name);
    return program.branches
      .filter((b) => b.id !== branch.id)
      .flatMap((b) =>
        b.semesters.flatMap((sem) =>
          sem.subjects
            .filter((x) => (code && x.code.trim().toLowerCase() === code) || subjectKey(x.name) === key)
            .map((x) => ({ ...x, branch: b, semesterNumber: sem.number })),
        ),
      );
  }, [program, branch, subject]);

  // A prefilled year older than the default window still gets an option.
  const years = useMemo(() => {
    const list = academicYears(8);
    const wanted = year;
    if (wanted && wanted >= 1990 && wanted <= list[0] && !list.includes(wanted)) list.push(wanted);
    return list;
  }, [year]);

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
    <form action={action} onSubmit={(event) => {
      // Dispatch manually so React does not automatically clear the form on a handled error.
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      startTransition(() => action(data));
    }} onChangeCapture={(event) => {
      const input = event.target as unknown as HTMLInputElement;
      if (input.name === "catalogueConfirmed" || input.name === "alsoSubjectIds") return;
      if (input.id === "file") { if (!edited.current.has("existing")) edited.current.clear(); return; }
      if (input.id.startsWith("detected-")) {
        const key = input.id.slice(9); edited.current.add(key);
        if (key === "branchName") edited.current.add("branchCode");
      } else if (["collegeId", "programId", "branchId", "semesterId", "subjectId", "examTypeId"].includes(input.id)) {
        if (input.id === "examTypeId" && automatic) edited.current.add("examCode");
        else edited.current.add("existing");
      } else if (input.id) edited.current.add(input.id);
      if (input.id.startsWith("detected-") || ["collegeId", "programId", "branchId", "semesterId", "subjectId", "examTypeId"].includes(input.id)) setConfirmed(false);
    }} className="upload-form flex min-w-0 flex-col gap-5">
      <FormBanner pending={statePending} loadingMessage={mode === "camera" ? "Building and uploading your PDF…" : "Uploading and checking your paper…"} state={state} />
      {prefill && !state.ok ? (
        <p role="status" className="pv-panel-flat bg-mint px-3 py-2 font-sans text-xs" data-testid="upload-prefill">
          <strong className="font-mono uppercase tracking-[0.08em]">Filled in for you:</strong> {prefill.summary}.
          Check every field and change anything that doesn&apos;t match your paper before submitting.
        </p>
      ) : null}
      {state.ok && typeof state.data?.paperId === "string" ? (
        <Link
          href={`/papers/${state.data.paperId}`}
          className="pv-link self-start font-mono text-xs"
          data-testid="uploaded-paper-link"
        >
          View your upload →
        </Link>
      ) : null}

      <div className="flex flex-wrap items-center gap-2" aria-label="Paper details mode">
        {([ ["detect", "Auto-detect"], ["manual", "Enter manually"] ] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={entryMode === value} className={entryMode === value ? "pv-btn-primary min-h-11" : "pv-btn min-h-11"} onClick={() => {
            setEntryMode(value); setDetectionAttempt(0); setConfirmed(false);
            if (value === "manual") {
              if (!automatic && subject && branch && program && college) setDraft({ collegeName: college.name, programName: program.name, branchName: branch.name, branchCode: branch.code, semesterNumber: semester!.number, subjectName: subject.name, subjectCode: subject.code, examCode: college.examTypes.find((e) => e.id === examId)?.code ?? "" });
              setAutomatic(true);
            }
          }}>{label}</button>
        ))}
        <button type="button" className="pv-link min-h-11 px-2 font-sans text-sm" aria-pressed={entryMode === "existing"} onClick={() => { setEntryMode("existing"); setAutomatic(false); }}>Choose existing groups</button>
      </div>
      <p className="font-sans text-sm text-ink/70">{entryMode === "manual" ? "Type the paper details below. Missing colleges, branches and subjects are created when you submit." : entryMode === "existing" ? "Choose the college and subject already in the archive." : "Add your paper. We’ll fill what we can; you can edit the rest."}</p>
      {entryMode === "detect" ? <p className="rounded-sm border-l-4 border-ink bg-blue-soft/40 px-3 py-2 font-sans text-sm text-ink/80" data-testid="clear-scan-tip">Upload a clear PDF or a well-lit, straight photo for more accurate detection. Keep the header visible and check the detected details before submitting.</p> : null}
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(280px,0.42fr)_minmax(0,1fr)]" data-testid="upload-layout">
      <section className="min-w-0 rounded-sm border-2 border-ink bg-blue-soft/30 p-4 sm:p-5" data-testid="upload-file-panel">
        <h2 className="mb-4 font-mono text-base font-bold">1. Add your paper</h2>
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
              onClick={() => { setMode(value); setDetectionAttempt(0); }}
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
            <span className={`max-w-full font-mono text-sm uppercase tracking-[0.08em] ${file ? "break-all" : "break-words"}`}>
              {file ? file.name : "Choose a PDF or image"}
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
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setDetectionAttempt(0); }}
              required={mode === "file"}
            />
          </label>
        ) : (
          <div className="border-2 border-dashed border-ink rounded-sm bg-paper px-4 py-4">
            <CameraCapture pages={pages} onChange={(next) => { setPages(next); setDetectionAttempt(0); }} />
            <p className="mt-3 font-sans text-[11px] text-ink/60">
              Photograph each page in order, in good light, with the whole sheet in frame. On a
              phone you can also use “Choose a file” to pick a photo you already took.
            </p>
          </div>
        )}
        <FieldError error={fileError ?? state.fieldErrors?.file} />
        {mode === "file" && file && !fileError ? <button type="button" className="pv-btn-secondary mt-4 w-full" onClick={() => setPreviewOpen(true)}><Eye className="h-4 w-4" aria-hidden />Preview paper</button> : null}
        {detecting ? <p role="status" className="mt-4 flex items-start gap-2 font-sans text-sm" data-testid="detection-progress"><LoaderCircle className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />Detecting paper details… You can keep editing or use manual entry.</p> : <p className="mt-4 font-sans text-sm text-ink/70">Read the paper before submitting. All details can be corrected.</p>}
      {entryMode === "detect" && (detection || detectionError) ? <section className="pv-panel-flat bg-blue-light px-4 py-3" aria-label="Detected paper details" data-testid="paper-detection">
        <strong className="font-mono text-sm">{detection?.method === "ocr" ? "Read from your scan" : detection?.method === "text" ? "Read from your PDF" : "Enter paper details"}</strong>
        <p className="mt-1 font-sans text-sm">{detection?.match ? "Matched an existing college and subject. Review the selected details below." : "Check the details below and fill any empty fields. Missing groups are created on submission."}</p>
        {detection?.uncertainFields?.length ? <p className="mt-2 font-sans text-sm font-semibold">Please confirm: {detection.uncertainFields.map((key) => ({ collegeName: "college", subjectName: "subject", subjectCode: "subject code", semesterNumber: "semester", programName: "programme", academicYear: "year", examCode: "exam type" }[key] ?? key)).join(", ")}. Use Preview paper to check.</p> : null}
        {detectionError ? <p className="mt-2 font-sans text-sm" role="alert">{detectionError} Use Enter manually above.</p> : null}
        {!detecting && (file || pages.length) ? <button type="button" className="pv-link mt-2 font-sans text-sm" onClick={()=>setDetectionAttempt(n=>n+1)}>Retry detection</button> : null}
        {detection?.warnings.length ? <details className="mt-2 font-sans text-sm"><summary className="cursor-pointer underline">Reader notes — review suggestions</summary>{detection.warnings.map((warning) => <p key={warning} className="mt-2">{warning}</p>)}</details> : null}
      </section> : null}
      </section>
      <div className="flex min-w-0 flex-col gap-4" data-testid="upload-details-panel">


      {automatic ? <fieldset className="pv-panel-flat p-4" data-testid="automatic-catalogue">
        <legend className="px-1 font-mono text-sm">2. Paper details</legend>
        <input type="hidden" name="autoCatalogue" value={JSON.stringify(draft)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="pv-label" htmlFor="detected-collegeName">College</label><SuggestionInput id="detected-collegeName" label="College" value={draft.collegeName} options={colleges.map(c=>({value:c.name,keywords:c.shortName}))} required maxLength={180} placeholder="Choose or type a college" onValueChange={(value) => { edited.current.add("collegeName"); setConfirmed(false); setDraft((d) => ({ ...d, collegeName: value })); }} /></div>
          <div><label className="pv-label" htmlFor="detected-programName">Program</label><select id="detected-programName" className="pv-input" required value={draft.programName} onChange={(e) => setDraft((d) => ({ ...d, programName: e.target.value }))}><option value="">Select a program</option>{["B.Tech", "M.Tech", "BCA", "MCA", "BBA", "MBA"].map((p) => <option key={p}>{p}</option>)}</select></div>
          <div><label className="pv-label" htmlFor="detected-branchName">Branch</label><SuggestionInput id="detected-branchName" label="Branch" value={draft.branchName} options={(automaticProgram?.branches ?? []).map(b=>({value:b.name,keywords:b.code,description:b.code}))} required maxLength={120} placeholder="Choose or type a branch, e.g. CSE" onValueChange={(value) => { edited.current.add("branchName"); edited.current.add("branchCode"); setConfirmed(false); const known = automaticProgram?.branches.find((b) => textKey(b.name) === textKey(value) || textKey(b.code) === textKey(value)); setDraft((d) => ({ ...d, branchName: known?.name ?? value, branchCode: known?.code ?? branchCodeFromName(value) })); }} /><p className="mt-1 font-sans text-xs text-ink/70">{detection?.fields.branchCodes?.length ? "Shared paper? Choose the primary branch." : "Choose an existing branch or type a new one."}</p></div>
          <div><label className="pv-label" htmlFor="detected-semesterNumber">Semester</label><select id="detected-semesterNumber" className="pv-input" required value={draft.semesterNumber || ""} onChange={(e) => setDraft((d) => ({ ...d, semesterNumber: Number(e.target.value) }))}><option value="">Select a semester</option>{Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>Semester {n}</option>)}</select></div>
          {([ ["subjectName", "Subject"], ["subjectCode", "Subject code"] ] as const).map(([key, label]) => <div key={key}><label className="pv-label" htmlFor={`detected-${key}`}>{label}</label><input id={`detected-${key}`} className="pv-input" value={draft[key]} required maxLength={key === "subjectCode" ? 24 : 180} placeholder={key === "subjectCode" ? "e.g. BCS503" : "Subject name"} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} /></div>)}
        </div>
      </fieldset> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset disabled={automatic} className={automatic ? "hidden" : "contents"}>
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
              setExamId("");
              setProgramId("");
              setBranchId("");
              setSemesterId("");
              setSubjectId("");
              setAlsoIds([]);
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
              setSubjectId("");
              setAlsoIds([]);
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
              setSubjectId("");
              setAlsoIds([]);
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
            onChange={(e) => {
              setSemesterId(e.target.value);
              setSubjectId("");
              setAlsoIds([]);
            }}
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
          <select
            id="subjectId"
            name="subjectId"
            className="pv-input"
            value={subjectId}
            onChange={(e) => {
              setSubjectId(e.target.value);
              setAlsoIds([]);
            }}
            disabled={!semester}
            required
          >
            <option value="">Select a subject</option>
            {semester?.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
          <FieldError error={state.fieldErrors?.subjectId} />
        </div>

        </fieldset>
        <div>
          <label className="pv-label" htmlFor="examTypeId">
            Exam type
          </label>
          <select
            key={collegeId}
            id="examTypeId"
            name="examTypeId"
            className="pv-input"
            disabled={!automatic && !college}
            required
            value={automatic ? draft.examCode : examId}
            onChange={(e) => automatic ? setDraft((d) => ({ ...d, examCode: e.target.value })) : setExamId(e.target.value)}
          >
            <option value="">Select an exam type</option>
            {(automatic ? ["CT", "ST", "PUT", "MID_SEM", "END_SEM"].map((code) => ({ id: code, name: code.replace(/_/g, "-"), code })) : college?.examTypes)?.map((e) => (
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
          <select
            id="academicYear"
            name="academicYear"
            className="pv-input"
            required
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <FieldError error={state.fieldErrors?.academicYear} />
        </div>

      </div>

      <details className="border-t-2 border-ink/20 pt-3" data-testid="more-details">
        <summary className="cursor-pointer py-2 font-sans text-sm">More details (optional)</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div><label className="pv-label" htmlFor="sessionLabel">Test / session</label><input id="sessionLabel" name="sessionLabel" className="pv-input" placeholder="e.g. ST-1 · 2025-26" maxLength={60} value={sessionLabel} onChange={(e) => setSessionLabel(e.target.value)} /><p className="mt-1 font-sans text-xs text-ink/70">Keep ST-1 and ST-2 separate.</p></div>
          <div><label className="pv-label" htmlFor="setLabel">Paper set</label><input id="setLabel" name="setLabel" className="pv-input" defaultValue="Set A" maxLength={20} /></div>
          {automatic ? <>
            <div><label className="pv-label" htmlFor="detected-branchCode">Branch code</label><input id="detected-branchCode" className="pv-input" value={draft.branchCode} maxLength={16} onChange={(e) => setDraft((d) => ({ ...d, branchCode: e.target.value }))} /><p className="mt-1 font-sans text-xs text-ink/70">Filled from the branch. Only change it if needed.</p></div>
            <div><label className="pv-label" htmlFor="detected-university">University</label><input id="detected-university" className="pv-input" value={draft.university ?? ""} maxLength={180} onChange={(e) => setDraft((d) => ({ ...d, university: e.target.value }))} /></div>
          </> : null}
        </div>

      {subject && !automatic && siblings.length > 0 ? (
        <fieldset className="border-2 border-ink rounded-sm bg-paper px-4 py-3" data-testid="also-branches">
          <legend className="pv-label px-1">
            Also for other branches <span className="normal-case tracking-normal">(optional)</span>
          </legend>
          {siblings.length > 0 ? (
            <>
              <p className="mb-2 font-sans text-[11px] leading-relaxed text-ink/70">
                Was this exact paper also set for other {program?.name} branches? Tick each one and the
                paper will appear under that branch&apos;s {subject.name} page too.
              </p>
              <div className="flex flex-col gap-1.5">
                {siblings.map((s) => (
                  <label key={s.id} className="flex items-start gap-2 font-sans text-sm">
                    <input
                      type="checkbox"
                      name="alsoSubjectIds"
                      value={s.id}
                      className="mt-1"
                      checked={alsoIds.includes(s.id)}
                      onChange={(e) =>
                        setAlsoIds((ids) =>
                          e.target.checked ? [...ids, s.id] : ids.filter((id) => id !== s.id),
                        )
                      }
                    />
                    <span>
                      <strong>{s.branch.code}</strong> · {s.branch.name} · Semester {s.semesterNumber}
                      <span className="text-ink/60">
                        {" "}
                        — {s.name} ({s.code})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
              {siblings.length > 1 ? (
                <button
                  type="button"
                  className="mt-2 font-mono text-[11px] underline"
                  onClick={() =>
                    setAlsoIds(alsoIds.length === siblings.length ? [] : siblings.map((s) => s.id))
                  }
                >
                  {alsoIds.length === siblings.length ? "Clear all" : "Select all branches"}
                </button>
              ) : null}
            </>
          ) : (
            <p className="font-sans text-[11px] leading-relaxed text-ink/70">
              No other {program?.name} branch lists {subject.name}. If another branch sat this paper
              under a different subject name, mention it in the notes and a moderator can add it.
            </p>
          )}
          <FieldError error={state.fieldErrors?.alsoSubjectIds} />
        </fieldset>
      ) : null}

      <div className="mt-4">
        <label className="pv-label" htmlFor="notes">
          Notes for moderators <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <textarea id="notes" name="notes" className="pv-input" rows={2} maxLength={500} />
      </div>

      </details>

      {sessionLabel ? <p className="font-sans text-sm text-ink/70">Test / session: <strong>{sessionLabel}</strong> <button type="button" className="pv-link ml-1" onClick={(event) => { const form = event.currentTarget.closest("form"); const details = form?.querySelector<HTMLDetailsElement>("[data-testid=more-details]"); if (details) details.open = true; form?.querySelector<HTMLInputElement>("#sessionLabel")?.focus(); }}>Edit</button></p> : null}
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <div><label className="pv-label" htmlFor="examClassification">Paper status</label><select id="examClassification" name="examClassification" className="pv-input" required defaultValue=""><option value="" disabled>Confirm it’s safe to share</option><option value="PAST">Past exam — already finished</option><option value="RELEASED">Officially released for sharing</option><option value="UNKNOWN">Not sure — needs review</option></select><FieldError error={state.fieldErrors?.examClassification} /></div>
        {automatic ? <label className="flex gap-2 font-sans text-sm"><input type="checkbox" name="catalogueConfirmed" value="yes" required checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />I checked these details against the paper.</label> : null}
      </div>
      <p className="font-sans text-xs leading-relaxed text-ink/60">Only share papers you’re allowed to upload. New groups are created automatically; papers still need moderator approval.</p>

      <SubmitButton
        pendingOverride={statePending}
        pendingLabel={mode === "camera" ? "Building your PDF…" : "Uploading…"}
        className="self-start"
      >
        Submit paper
      </SubmitButton>
      </div>
      </div>
      {previewOpen && file ? <UploadPreview file={file} onClose={() => setPreviewOpen(false)} /> : null}
    </form>
  );
}
