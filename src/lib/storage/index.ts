import { LocalStorageAdapter } from "./local";
import { S3StorageAdapter } from "./s3";

export type PutInput = {
  key: string;
  body: Buffer;
  contentType: string;
};

export interface StorageAdapter {
  put(input: PutInput): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  /** Short-lived URL for direct reads where the driver supports it. */
  signedUrl(key: string, expiresInSeconds?: number): Promise<string | null>;
  /** Cheap reachability probe for /api/healthz. */
  ping?(): Promise<boolean>;
}

let adapter: StorageAdapter | null = null;

export function storage(): StorageAdapter {
  if (adapter) return adapter;
  adapter =
    process.env.STORAGE_DRIVER === "s3" ? new S3StorageAdapter() : new LocalStorageAdapter();
  return adapter;
}

/** Deterministic, non-guessable, traversal-safe storage key. */
export function buildStorageKey(parts: {
  collegeSlug: string;
  paperId: string;
  sha256: string;
  extension: string;
}) {
  const ext = parts.extension.replace(/[^a-z0-9]/gi, "").toLowerCase() || "bin";
  return `colleges/${parts.collegeSlug}/papers/${parts.paperId}/${parts.sha256.slice(0, 32)}.${ext}`;
}
