import { validation } from "./errors";

/** Bound streamed bodies too; Content-Length alone is not a size guarantee. */
export async function boundedFormData(request: Request, maximum: number): Promise<FormData> {
  const tooLarge = () => { const error = validation("The paper exceeds the upload size limit."); error.status = 413; return error; };
  if (Number(request.headers.get("content-length") ?? 0) > maximum) throw tooLarge();
  if (!request.body) throw validation("Choose a paper first.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw tooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const body = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new Response(body, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
}
