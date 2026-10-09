import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { AppError } from "../errors";
import { logger } from "../logger";
import type { PutInput, StorageAdapter } from "./index";

/**
 * S3-compatible object storage (AWS S3, Cloudflare R2, Backblaze B2, MinIO…).
 *
 * The bucket must stay private. By default every read is streamed through
 * /api/files/[fileId], which authorises it; set S3_SIGNED_URLS=true to redirect
 * authorised readers to a short-lived presigned URL instead (saves bandwidth,
 * but the URL works for anyone who holds it until it expires).
 */
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new AppError("STORAGE_ERROR", "S3_BUCKET is not set but STORAGE_DRIVER=s3.");
    }
    this.bucket = bucket;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    this.client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      // Fall back to the SDK's default chain (instance role, env, profile).
      credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
    });
  }

  private wrap(op: string, key: string, err: unknown): never {
    logger.error("storage_error", { op, key, error: String(err) });
    throw new AppError("STORAGE_ERROR", "File storage is temporarily unavailable. Try again shortly.");
  }

  async put({ key, body, contentType }: PutInput) {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ContentLength: body.length,
          // R2 and MinIO reject this header; AWS encrypts by default anyway.
          ...(process.env.S3_SSE && process.env.S3_SSE !== "none"
            ? { ServerSideEncryption: process.env.S3_SSE as "AES256" }
            : {}),
        }),
      );
    } catch (err) {
      this.wrap("put", key, err);
    }
  }

  async get(key: string): Promise<Buffer> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) throw new Error("empty body");
      return Buffer.from(await res.Body.transformToByteArray());
    } catch (err) {
      if (err instanceof NoSuchKey) throw new AppError("NOT_FOUND", "That file no longer exists.");
      this.wrap("get", key, err);
    }
  }

  async delete(key: string) {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (err) {
      this.wrap("delete", key, err);
    }
  }

  async signedUrl(key: string, expiresInSeconds = 300): Promise<string | null> {
    if (process.env.S3_SIGNED_URLS !== "true") return null;
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  /** Used by /api/healthz. */
  async ping(): Promise<boolean> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return true;
    } catch {
      return false;
    }
  }
}
