import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const REPORT_STORAGE = Symbol("REPORT_STORAGE");

/** Where report artifacts live. Local disk today; an S3 implementation (with object lock) slots in here. */
export interface ReportStorage {
  put(key: string, artifacts: { pdf: Buffer; json: Buffer }): Promise<void>;
  get(key: string, kind: "pdf" | "json"): Promise<Buffer>;
}

export class LocalDiskReportStorage implements ReportStorage {
  constructor(private readonly root: string) {}

  async put(key: string, artifacts: { pdf: Buffer; json: Buffer }): Promise<void> {
    const base = this.resolve(key);
    await mkdir(path.dirname(base), { recursive: true });
    await Promise.all([writeFile(`${base}.pdf`, artifacts.pdf, { flag: "wx" }), writeFile(`${base}.json`, artifacts.json, { flag: "wx" })]);
  }

  get(key: string, kind: "pdf" | "json"): Promise<Buffer> {
    return readFile(`${this.resolve(key)}.${kind}`);
  }

  /** Keys are `<orgId>/<reportId>`; anything that would escape the root is refused. */
  private resolve(key: string): string {
    if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(key)) throw new Error(`Invalid report storage key: ${key}`);
    return path.join(this.root, key);
  }
}
