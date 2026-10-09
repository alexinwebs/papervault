import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { AppError } from "../errors";
import type { PutInput, StorageAdapter } from "./index";

/** Filesystem driver for local development. Files are served only through an authorized route. */
export class LocalStorageAdapter implements StorageAdapter {
  private root = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "./storage");

  private resolve(key: string) {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep)) {
      throw new AppError("STORAGE_ERROR", "Invalid storage key.");
    }
    return target;
  }

  async put({ key, body }: PutInput) {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async get(key: string) {
    try {
      return await readFile(this.resolve(key));
    } catch {
      throw new AppError("STORAGE_ERROR", "Stored file is unavailable.");
    }
  }

  async delete(key: string) {
    try {
      await unlink(this.resolve(key));
    } catch {
      /* already gone */
    }
  }

  async signedUrl() {
    return null; // local driver streams through /api/files/[fileId]
  }
}
