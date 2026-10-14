"use server";
import { requireUser, assertVerifiedEmail } from "@/lib/auth";
import { rateLimitAsync } from "@/lib/rate-limit";
import { validation } from "@/lib/errors";
import { scanUpload, assertClean } from "@/lib/scanner";
import { detectMime } from "../services/uploads";
import { uploadFileFromForm } from "../services/upload-input";
import { detectPaper } from "../services/paper-detection";
import { run, type ActionState } from "./types";

export async function detectPaperAction(_prev: ActionState, data: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await requireUser();
    assertVerifiedEmail(user);
    await rateLimitAsync(`paper-detection:${user.id}`, 30, 60 * 60_000);
    const file = await uploadFileFromForm(data, user.name);
    const mime = detectMime(file.bytes);
    if (!mime) throw validation("Only PDF, JPG and PNG papers can be read.");
    assertClean(await scanUpload(file.bytes));
    const detection = await detectPaper(file.bytes, mime, { filename: file.name });
    return { ok: true, data: { detection }, message: detection.method === "none" ? "Please enter the paper details manually." : "Paper details read. Review the detected fields before submitting." };
  });
}
