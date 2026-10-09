"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { myPinnedColleges, setCollegePin } from "../services/pins";
import { run, type ActionState } from "./types";

const pinSchema = z.object({
  collegeId: z.string().min(1).max(64),
  pinned: z.boolean(),
});

/**
 * Sets (not toggles) the pin, so a double click or a retried request lands on
 * the state the user asked for. The user id always comes from the session.
 */
export async function setCollegePinAction(collegeId: string, pinned: boolean): Promise<ActionState> {
  return run(async () => {
    const parsed = pinSchema.safeParse({ collegeId, pinned });
    if (!parsed.success) return { ok: false, message: "Invalid request." };
    const user = await requireUser();
    const result = await setCollegePin(user, parsed.data.collegeId, parsed.data.pinned);
    // The caller's own updated list, so the navigation can update at once
    // without waiting for a full page refresh.
    const nav = (await myPinnedColleges(user.id)).map((row) => ({
      slug: row.college.slug,
      name: row.college.name,
      shortName: row.college.shortName,
    }));
    return { ok: true, data: { ...result, nav } };
  });
}
