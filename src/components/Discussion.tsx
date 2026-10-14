"use client";

import { SuccessPopup, useSuccessPopup } from "./SuccessPopup";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { MessageSquare, Reply, Flag, Trash2, Pencil } from "lucide-react";
import { FieldError, FormBanner, SubmitButton } from "./Form";
import { idle } from "@/server/actions/types";
import {
  addCommentAction,
  editCommentAction,
  removeCommentAction,
  reportCommentAction,
} from "@/server/actions/comments";
import { formatDate } from "@/lib/utils";
import { COMMENT_REPORT_REASONS, COMMENT_REPORT_REASON_LABEL, ROLE_LABEL, type Role } from "@/lib/constants";

export type DiscussionComment = {
  id: string;
  body: string;
  status: string;
  parentId: string | null;
  createdAt: string;
  editedAt: string | null;
  removedReason: string | null;
  author: { id: string; name: string; role: string; trustLevel: string };
  replies?: DiscussionComment[];
};

type Viewer = { id: string; canModerate: boolean; emailVerified: boolean } | null;

const REPORT_REASONS: Array<[string, string]> = COMMENT_REPORT_REASONS.map((value) => [
  value,
  COMMENT_REPORT_REASON_LABEL[value],
]);

const EDIT_WINDOW_MS = 15 * 60_000;

function Composer({
  paperId,
  parentId,
  autoFocus,
  placeholder,
  onDone,
  compact,
}: {
  paperId: string;
  parentId?: string;
  autoFocus?: boolean;
  placeholder: string;
  onDone?: () => void;
  compact?: boolean;
}) {
  const [state, action, statePending] = useActionState(addCommentAction, idle);
  useSuccessPopup(state, statePending);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      onDone?.();
    }
  }, [state, onDone]);

  const id = `comment-${parentId ?? "root"}`;
  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="paperId" value={paperId} />
      {parentId ? <input type="hidden" name="parentId" value={parentId} /> : null}
      <label className="sr-only" htmlFor={id}>
        {placeholder}
      </label>
      <textarea
        id={id}
        name="body"
        rows={compact ? 2 : 3}
        autoFocus={autoFocus}
        placeholder={placeholder}
        maxLength={2000}
        className="pv-input resize-y"
      />
      <FieldError error={state.fieldErrors?.body} />
      {state.ok ? null : <FormBanner state={state.ok ? idle : state} />}
      <div className="flex items-center gap-2">
        <SubmitButton className="px-4 py-2 text-xs" pendingLabel="Posting…">
          {parentId ? "Post reply" : "Post comment"}
        </SubmitButton>
        {onDone ? (
          <button type="button" onClick={onDone} className="pv-btn-ghost px-3 py-2 text-xs">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function EditForm({
  comment,
  paperId,
  onDone,
}: {
  comment: DiscussionComment;
  paperId: string;
  onDone: () => void;
}) {
  const [state, action, statePending] = useActionState(editCommentAction, idle);
  useSuccessPopup(state, statePending);
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="commentId" value={comment.id} />
      <input type="hidden" name="paperId" value={paperId} />
      <label className="sr-only" htmlFor={`edit-${comment.id}`}>
        Edit comment
      </label>
      <textarea
        id={`edit-${comment.id}`}
        name="body"
        rows={3}
        defaultValue={comment.body}
        maxLength={2000}
        className="pv-input resize-y"
      />
      <FieldError error={state.fieldErrors?.body} />
      <FormBanner state={state.ok ? idle : state} />
      <div className="flex gap-2">
        <SubmitButton className="px-3 py-1 text-xs" pendingLabel="Saving…">
          Save
        </SubmitButton>
        <button type="button" onClick={onDone} className="pv-btn-ghost px-3 py-1 text-xs">
          Cancel
        </button>
      </div>
    </form>
  );
}

function RemoveForm({
  commentId,
  paperId,
  asModerator,
}: {
  commentId: string;
  paperId: string;
  asModerator: boolean;
}) {
  const [state, action, statePending] = useActionState(removeCommentAction, idle);
  useSuccessPopup(state, statePending);
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(asModerator ? "Remove this comment?" : "Delete your comment?")) {
          event.preventDefault();
        }
      }}
      className="inline-flex items-center gap-1"
    >
      <input type="hidden" name="commentId" value={commentId} />
      <input type="hidden" name="paperId" value={paperId} />
      {asModerator ? (
        <>
          <label className="sr-only" htmlFor={`reason-${commentId}`}>
            Reason
          </label>
          <input
            id={`reason-${commentId}`}
            name="reason"
            placeholder="Reason"
            className="pv-input w-32 px-2 py-1 text-[11px]"
          />
        </>
      ) : null}
      <SubmitButton variant="secondary" className="px-2 py-1 text-[11px]" pendingLabel="…">
        <Trash2 className="h-3 w-3" aria-hidden /> {asModerator ? "Remove" : "Delete"}
      </SubmitButton>
      {state.message && !state.ok ? (
        <span className="text-[11px] text-red-700">{state.message}</span>
      ) : null}
    </form>
  );
}

function ReportForm({ commentId, onDone }: { commentId: string; onDone: () => void }) {
  const [state, action, statePending] = useActionState(reportCommentAction, idle);
  useSuccessPopup(state, statePending);
  useEffect(() => {
    if (state.ok) {
      const timer = window.setTimeout(onDone, 1_500);
      return () => window.clearTimeout(timer);
    }
  }, [state, onDone]);
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
      <input type="hidden" name="commentId" value={commentId} />
      <div>
        <label
          htmlFor={`report-reason-${commentId}`}
          className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em]"
        >
          Reason
        </label>
        <select id={`report-reason-${commentId}`} name="reason" className="pv-input py-1 text-xs">
          {REPORT_REASONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[160px] flex-1">
        <label
          htmlFor={`report-details-${commentId}`}
          className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em]"
        >
          Details (optional)
        </label>
        <input id={`report-details-${commentId}`} name="details" className="pv-input py-1 text-xs" />
      </div>
      <SubmitButton variant="secondary" className="px-3 py-1 text-xs" pendingLabel="…">
        Send report
      </SubmitButton>
      <button type="button" onClick={onDone} className="pv-btn-ghost px-2 py-1 text-xs">
        Cancel
      </button>
      <FormBanner state={state.ok ? idle : state} />
    </form>
  );
}

function CommentCard({
  comment,
  paperId,
  viewer,
  depth,
}: {
  comment: DiscussionComment;
  paperId: string;
  viewer: Viewer;
  depth: number;
}) {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reporting, setReporting] = useState(false);

  const removed = comment.status !== "PUBLISHED";
  const isAuthor = viewer?.id === comment.author.id;
  const withinEditWindow = Date.now() - new Date(comment.createdAt).getTime() < EDIT_WINDOW_MS;
  const badge = comment.author.role !== "STUDENT";
  const teacher = comment.author.role === "TEACHER";

  return (
    <li className={depth > 0 ? "border-l-2 border-ink/15 pl-3 sm:pl-4" : ""}>
      <article className="pv-panel-flat px-3 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <Link
              href={`/contributors/${comment.author.id}`}
              prefetch={false}
              className="pv-link font-mono text-sm"
            >
              {comment.author.name}
            </Link>
            {badge ? (
              <span
                className={`border-2 border-ink px-1 font-mono text-[10px] uppercase ${teacher ? "bg-mint" : "bg-lavender"}`}
                title={teacher ? "PaperVault has verified this member's teaching affiliation." : undefined}
              >
                {ROLE_LABEL[comment.author.role as Role] ?? comment.author.role.replace(/_/g, " ").toLowerCase()}
              </span>
            ) : null}
          </div>
          <span className="font-sans text-[11px] text-ink/55">
            {formatDate(new Date(comment.createdAt))}
            {comment.editedAt ? " · edited" : ""}
          </span>
        </div>

        <p
          className={`mt-2 whitespace-pre-wrap break-words font-sans text-sm ${
            removed ? "italic text-ink/55" : ""
          }`}
        >
          {removed
            ? comment.removedReason
              ? `This comment was removed by a moderator: ${comment.removedReason}`
              : "This comment was removed."
            : comment.body}
        </p>

        {removed ? null : (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {viewer && depth === 0 ? (
              <button
                type="button"
                onClick={() => setReplying((value) => !value)}
                className="pv-btn-ghost px-2 py-1 text-[11px]"
              >
                <Reply className="h-3 w-3" aria-hidden /> Reply
              </button>
            ) : null}
            {isAuthor && withinEditWindow ? (
              <button
                type="button"
                onClick={() => setEditing((value) => !value)}
                className="pv-btn-ghost px-2 py-1 text-[11px]"
              >
                <Pencil className="h-3 w-3" aria-hidden /> Edit
              </button>
            ) : null}
            {isAuthor || viewer?.canModerate ? (
              <RemoveForm
                commentId={comment.id}
                paperId={paperId}
                asModerator={Boolean(!isAuthor && viewer?.canModerate)}
              />
            ) : null}
            {viewer && !isAuthor ? (
              <button
                type="button"
                onClick={() => setReporting((value) => !value)}
                className="pv-btn-ghost px-2 py-1 text-[11px]"
              >
                <Flag className="h-3 w-3" aria-hidden /> Report
              </button>
            ) : null}
          </div>
        )}

        {editing ? (
          <EditForm comment={comment} paperId={paperId} onDone={() => setEditing(false)} />
        ) : null}
        {reporting ? (
          <ReportForm commentId={comment.id} onDone={() => setReporting(false)} />
        ) : null}
        {replying ? (
          <div className="mt-3">
            <Composer
              paperId={paperId}
              parentId={comment.id}
              autoFocus
              compact
              placeholder={`Reply to ${comment.author.name}…`}
              onDone={() => setReplying(false)}
            />
          </div>
        ) : null}
      </article>

      {comment.replies && comment.replies.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-2 pl-3 sm:pl-6">
          {comment.replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              paperId={paperId}
              viewer={viewer}
              depth={depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Discussion thread under a paper: ask a doubt, correct the metadata, or help
 * someone else out. Signed-out visitors can read everything.
 */
export function Discussion({
  paperId,
  comments,
  viewer,
  locked,
  flash,
}: {
  paperId: string;
  comments: DiscussionComment[];
  viewer: Viewer;
  locked?: boolean;
  /** Server-rendered confirmation after an edit or removal navigation. */
  flash?: string | null;
}) {
  const total = comments.reduce((sum, c) => sum + 1 + (c.replies?.length ?? 0), 0);

  return (
    <section id="discussion" className="scroll-mt-20">
      <h2 className="pv-section-title flex items-center gap-2 border-b-2 border-ink pb-2">
        <MessageSquare className="h-4 w-4" aria-hidden />
        Discussion
        <span className="font-sans text-xs font-normal text-ink/60">({total})</span>
      </h2>

      <div className="mt-3 flex flex-col gap-3">
        {flash ? (
          <SuccessPopup message={flash} />
        ) : null}
        {locked ? (
          <p className="pv-panel-flat bg-cream px-3 py-2 font-sans text-xs text-ink/70">
            Discussion opens once this paper is published.
          </p>
        ) : !viewer ? (
          <p className="pv-panel-flat bg-cream px-3 py-2 font-sans text-xs">
            <Link href={`/login?next=/papers/${paperId}`} className="pv-link">
              Sign in
            </Link>{" "}
            to ask a doubt or help someone out.
          </p>
        ) : !viewer.emailVerified ? (
          <p className="pv-panel-flat bg-yellow px-3 py-2 font-sans text-xs">
            Confirm your email address to join the discussion. You can resend the link from{" "}
            <Link href="/settings" className="pv-link">
              Settings
            </Link>
            .
          </p>
        ) : (
          <Composer paperId={paperId} placeholder="Ask a doubt or add something useful…" />
        )}

        {comments.length === 0 ? (
          <p className="font-sans text-xs text-ink/55">
            No comments yet. Be the first to ask a question about this paper.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((comment) => (
              <CommentCard
                key={comment.id}
                comment={comment}
                paperId={paperId}
                viewer={viewer}
                depth={0}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
