"use client";

import { useActionState } from "react";
import {
  cancelTeacherVerificationAction,
  provideTeacherInfoAction,
  submitTeacherVerificationAction,
} from "@/server/actions/teacher-verification";
import { idle } from "@/server/actions/types";
import { FieldError, FormBanner, SubmitButton } from "@/components/Form";
import { DocumentPicker } from "@/components/DocumentPicker";

type College = { id: string; name: string; university: string };

export function TeacherApplicationForm({
  colleges,
  defaults,
  maxFiles,
  maxBytes,
}: {
  colleges: College[];
  defaults: { fullName: string; collegeId: string };
  maxFiles: number;
  maxBytes: number;
}) {
  const [state, action] = useActionState(submitTeacherVerificationAction, idle);
  if (state.ok) {
    return (
      <p role="status" className="pv-panel-flat bg-mint px-4 py-3 font-mono text-xs" data-testid="teacher-submitted">
        {state.message}
      </p>
    );
  }
  const err = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" data-testid="teacher-application">
      <FormBanner state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="pv-label" htmlFor="fullName">Full name</label>
          <input id="fullName" name="fullName" className="pv-input" defaultValue={defaults.fullName} required maxLength={120} autoComplete="name" />
          <FieldError error={err.fullName} />
        </div>
        <div className="sm:col-span-2">
          <label className="pv-label" htmlFor="collegeId">College on PaperVault (if listed)</label>
          <select id="collegeId" name="collegeId" className="pv-input" defaultValue={defaults.collegeId}>
            <option value="">Not listed / other institution</option>
            {colleges.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <FieldError error={err.collegeId} />
        </div>
        <div>
          <label className="pv-label" htmlFor="institutionName">College / institution</label>
          <input id="institutionName" name="institutionName" className="pv-input" required maxLength={200} />
          <FieldError error={err.institutionName} />
        </div>
        <div>
          <label className="pv-label" htmlFor="university">University (optional)</label>
          <input id="university" name="university" className="pv-input" maxLength={200} />
          <FieldError error={err.university} />
        </div>
        <div>
          <label className="pv-label" htmlFor="department">Department</label>
          <input id="department" name="department" className="pv-input" required maxLength={120} placeholder="Computer Science" />
          <FieldError error={err.department} />
        </div>
        <div>
          <label className="pv-label" htmlFor="designation">Designation</label>
          <input id="designation" name="designation" className="pv-input" required maxLength={120} placeholder="Assistant Professor" />
          <FieldError error={err.designation} />
        </div>
        <div className="sm:col-span-2">
          <label className="pv-label" htmlFor="subjectsTaught">Subject(s) you teach</label>
          <input id="subjectsTaught" name="subjectsTaught" className="pv-input" required maxLength={500} placeholder="DBMS, Operating Systems" />
          <FieldError error={err.subjectsTaught} />
        </div>
        <div>
          <label className="pv-label" htmlFor="institutionalEmail">Official institutional email (optional)</label>
          <input id="institutionalEmail" name="institutionalEmail" type="email" className="pv-input" maxLength={200} placeholder="name@college.edu.in" />
          <FieldError error={err.institutionalEmail} />
        </div>
        <div>
          <label className="pv-label" htmlFor="employeeId">Faculty / employee ID (optional)</label>
          <input id="employeeId" name="employeeId" className="pv-input" maxLength={60} />
          <FieldError error={err.employeeId} />
        </div>
        <div className="sm:col-span-2">
          <label className="pv-label" htmlFor="verificationNotes">Anything else that helps us verify you (optional)</label>
          <textarea id="verificationNotes" name="verificationNotes" rows={3} className="pv-input" maxLength={2000} placeholder="e.g. a link to your faculty profile on the college website" />
          <FieldError error={err.verificationNotes} />
        </div>
      </div>
      <DocumentPicker
        name="documents"
        label="Proof of teaching affiliation"
        maxFiles={maxFiles}
        maxBytes={maxBytes}
        required
        hint="A faculty ID card or a letter from your institution works best. Please don't upload Aadhaar, PAN or bank documents. Files are scanned and stored privately; only PaperVault admins can open them."
      />
      <label className="flex items-start gap-2 font-sans text-xs">
        <input type="checkbox" name="attest" className="pv-checkbox mt-[2px]" required />
        <span>
          The information above is accurate and I currently teach at this institution. I understand that false
          information can lead to rejection or action on my account.
        </span>
      </label>
      <FieldError error={err.attest} />
      <SubmitButton className="self-start" pendingLabel="Uploading and scanning…" testId="teacher-submit">
        Submit for review
      </SubmitButton>
    </form>
  );
}

export function MoreInformationForm({ requestId, maxFiles, maxBytes }: { requestId: string; maxFiles: number; maxBytes: number }) {
  const [state, action] = useActionState(provideTeacherInfoAction, idle);
  if (state.ok) {
    return <p role="status" className="pv-panel-flat bg-mint px-4 py-3 font-mono text-xs">{state.message}</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="teacher-more-info">
      <FormBanner state={state} />
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <label className="pv-label" htmlFor="notes">Your reply</label>
        <textarea id="notes" name="notes" rows={3} className="pv-input" maxLength={2000} />
        <FieldError error={state.fieldErrors?.notes} />
      </div>
      <DocumentPicker name="documents" label="Additional documents (optional)" maxFiles={maxFiles} maxBytes={maxBytes} />
      <SubmitButton className="self-start" pendingLabel="Sending…">Send to reviewer</SubmitButton>
    </form>
  );
}

export function WithdrawForm({ requestId }: { requestId: string }) {
  const [state, action] = useActionState(cancelTeacherVerificationAction, idle);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Withdraw your verification request? You can apply again later.")) event.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <FormBanner state={state} />
      <input type="hidden" name="requestId" value={requestId} />
      <SubmitButton variant="secondary" className="self-start px-3 py-2 text-xs" pendingLabel="Withdrawing…">
        Withdraw request
      </SubmitButton>
    </form>
  );
}
