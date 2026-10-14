"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { markAllRead, markRead } from "../services/inbox";
import { run, type ActionState } from "./types";

export async function markInboxReadAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const id = String(formData.get("id") ?? "");
    if (id) await markRead(user, id);
    revalidatePath("/inbox");
    revalidatePath("/", "layout");
    return { ok: true, message: "Marked as read." };
  });
}

export async function markAllInboxReadAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const count = await markAllRead(user);
    revalidatePath("/inbox");
    revalidatePath("/", "layout");
    return { ok: true, message: count ? `Marked ${count} as read.` : "Nothing unread." };
  });
}

/** Read and navigate only on explicit activation, never on link prefetch. */
export async function openInboxMessageAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    const id = String(formData.get("id") ?? "");
    const message = await prisma.inboxMessage.findFirst({ where: { id, userId: user.id } });
    if (!message) return { ok: false, message: "Notification not found." };
    // Use the stored destination, not a client-supplied return URL.
    const href = message.href;
    if (!href || !href.startsWith("/") || href.startsWith("//") || href.includes("\\")) {
      return { ok: false, message: "This notification has no valid destination." };
    }
    await markRead(user, id);
    revalidatePath("/inbox");
    revalidatePath("/", "layout");
    redirect(href);
  });
}
