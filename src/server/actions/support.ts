"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { clientIp } from "@/lib/client-ip";
import {
  adminTicketReplySchema,
  collegeRequestDecisionSchema,
  subjectRequestDecisionSchema,
  ticketCreateSchema,
  ticketReplySchema,
  ticketUpdateSchema,
  userReportResolveSchema,
  userReportSchema,
} from "../validators";
import {
  TICKET_MAX_FILES,
  adminReply,
  closeTicketAsRequester,
  createTicket,
  replyAsRequester,
  updateTicket,
} from "../services/tickets";
import { decideCollegeRequest, decideSubjectRequest } from "../services/catalogue-requests";
import { reportUser, resolveUserReport } from "../services/user-reports";
import { filesFrom } from "../services/private-files";
import { run, zodErrors, type ActionState } from "./types";

function textFields(formData: FormData) {
  return Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
}

export async function createTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  let target: string | null = null;
  const result = await run(async () => {
    const user = await requireUser();
    const parsed = ticketCreateSchema.safeParse(textFields(formData));
    if (!parsed.success) return { ok: false, message: "Check the highlighted fields.", fieldErrors: zodErrors(parsed.error) };
    const v = parsed.data;
    const files = await filesFrom(formData, "attachments", TICKET_MAX_FILES);
    const ticket = await createTicket(
      user,
      {
        category: v.category,
        subject: v.subject,
        body: v.body,
        clientToken: v.clientToken || null,
        relatedPaperId: v.relatedPaperId || null,
        relatedCommentId: v.relatedCommentId || null,
        relatedUserId: v.relatedUserId || null,
        college:
          v.category === "ADD_COLLEGE"
            ? {
                name: v.collegeName ?? "",
                university: v.collegeUniversity ?? "",
                city: v.collegeCity ?? "",
                state: v.collegeState ?? "",
                website: v.collegeWebsite || null,
              }
            : undefined,
        subjectRequest:
          v.category === "ADD_SUBJECT"
            ? {
                collegeId: v.subjectCollegeId ?? "",
                semesterId: v.subjectSemesterId || null,
                subjectName: v.subjectName ?? "",
                subjectCode: v.subjectCode || null,
              }
            : undefined,
      },
      files,
      await clientIp(),
    );
    revalidatePath("/my-tickets");
    target = `/my-tickets/${ticket.id}?created=1`;
    return { ok: true, message: `Ticket ${ticket.number} created.` };
  });
  if (target) redirect(target);
  return result;
}

export async function replyTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const parsed = ticketReplySchema.safeParse(textFields(formData));
    if (!parsed.success) return { ok: false, message: "Check the form.", fieldErrors: zodErrors(parsed.error) };
    const files = await filesFrom(formData, "attachments", TICKET_MAX_FILES);
    await replyAsRequester(user, parsed.data, files);
    revalidatePath(`/my-tickets/${parsed.data.ticketId}`);
    return { ok: true, message: "Reply sent." };
  });
}

export async function closeTicketAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const ticketId = String(formData.get("ticketId") ?? "");
    await closeTicketAsRequester(user, ticketId);
    revalidatePath(`/my-tickets/${ticketId}`);
    revalidatePath("/my-tickets");
    return { ok: true, message: "Ticket closed." };
  });
}

export async function adminTicketReplyAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireUser();
    const parsed = adminTicketReplySchema.safeParse(textFields(formData));
    if (!parsed.success) return { ok: false, message: "Check the form.", fieldErrors: zodErrors(parsed.error) };
    const v = parsed.data;
    await adminReply(actor, {
      ticketId: v.ticketId,
      body: v.body,
      internal: v.internal === "1",
      clientToken: v.clientToken || null,
      status: v.status || "",
    });
    revalidatePath(`/admin/tickets/${v.ticketId}`);
    return { ok: true, message: v.internal === "1" ? "Internal note added." : "Reply sent to the member." };
  });
}

export async function adminTicketUpdateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireUser();
    const parsed = ticketUpdateSchema.safeParse(textFields(formData));
    if (!parsed.success) return { ok: false, message: "Check the form.", fieldErrors: zodErrors(parsed.error) };
    const v = parsed.data;
    const changes = await updateTicket(actor, {
      ticketId: v.ticketId,
      status: v.status || undefined,
      priority: v.priority || undefined,
      assigneeId: v.assigneeId === undefined ? undefined : v.assigneeId || null,
    });
    revalidatePath(`/admin/tickets/${v.ticketId}`);
    revalidatePath("/admin/tickets");
    return { ok: true, message: Object.keys(changes).length ? "Ticket updated." : "Nothing changed." };
  });
}

export async function collegeRequestDecisionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireUser();
    const parsed = collegeRequestDecisionSchema.safeParse(textFields(formData));
    if (!parsed.success) return { ok: false, message: "Check the form.", fieldErrors: zodErrors(parsed.error) };
    const college = await decideCollegeRequest(actor, parsed.data);
    revalidatePath("/admin/requests");
    revalidatePath("/admin/tickets");
    return { ok: true, message: college ? `${college.name} created.` : "Decision saved and the member notified." };
  });
}

export async function subjectRequestDecisionAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireUser();
    const parsed = subjectRequestDecisionSchema.safeParse(textFields(formData));
    if (!parsed.success) return { ok: false, message: "Check the form.", fieldErrors: zodErrors(parsed.error) };
    const subject = await decideSubjectRequest(actor, {
      ...parsed.data,
      semesterId: parsed.data.semesterId || undefined,
    });
    revalidatePath("/admin/requests");
    revalidatePath("/admin/tickets");
    return { ok: true, message: subject ? `${subject.name} created.` : "Decision saved and the member notified." };
  });
}

export async function reportUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireUser();
    const parsed = userReportSchema.safeParse(textFields(formData));
    if (!parsed.success) return { ok: false, message: "Choose a reason.", fieldErrors: zodErrors(parsed.error) };
    await reportUser(actor, parsed.data);
    return { ok: true, message: "Thanks. An admin will review this report." };
  });
}

export async function resolveUserReportAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return run(async () => {
    const actor = await requireUser();
    const parsed = userReportResolveSchema.safeParse(textFields(formData));
    if (!parsed.success) return { ok: false, message: "Check the form.", fieldErrors: zodErrors(parsed.error) };
    await resolveUserReport(actor, parsed.data);
    revalidatePath("/admin/reports");
    return { ok: true, message: parsed.data.status === "RESOLVED" ? "Report resolved." : "Report dismissed." };
  });
}
