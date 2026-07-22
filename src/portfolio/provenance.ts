import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { STATE_DIR } from "./store.js";
import type { CrowdReport, Order } from "../types.js";

/**
 * The tamper evident tick log (panel finding: "append only is a pinky promise
 * until it is hash chained"). Every tick appends one record to state/ticks.jsonl:
 * full provenance (model id, the crowd report, what each pirate PROPOSED before
 * the articles cut it, what was accepted, equity after) plus a hash chain:
 *
 *   hash_n = sha256(hash_{n-1} + canonical(record_n))
 *
 * Nothing is ever rewritten: crowd.json stays as a latest cache for the site,
 * but the history lives here. `npm run verify:log` re-walks the whole chain.
 * The head hash is what gets anchored onchain in the real era.
 */

export interface TickRecord {
  ts: string;
  brain: string;
  quotes: { ticker: string; price: number }[];
  crowd: CrowdReport | null;
  pirates: {
    id: string;
    proposed: Order[];
    accepted: Order[];
    equityAfter: number;
    cashAfter: number;
    commentary: string;
  }[];
}

const LOG_FILE = () => path.join(STATE_DIR, "ticks.jsonl");

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value as object).sort()
      .map((k) => JSON.stringify(k) + ":" + canonical((value as Record<string, unknown>)[k]))
      .join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}

function lastHash(): string {
  const file = LOG_FILE();
  if (!fs.existsSync(file)) return "genesis";
  const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
  if (lines.length === 0 || lines[0] === "") return "genesis";
  try {
    const last = JSON.parse(lines[lines.length - 1]) as { hash?: string };
    return last.hash ?? "genesis";
  } catch {
    return "genesis";
  }
}

export function appendTick(record: TickRecord): string {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  const prevHash = lastHash();
  const hash = sha256(prevHash + canonical(record));
  const entry = { record, prevHash, hash };
  fs.appendFileSync(LOG_FILE(), JSON.stringify(entry) + "\n");
  return hash;
}

/** Walks the whole chain. Returns the head hash, throws on any break. */
export function verifyChain(): { entries: number; head: string } {
  const file = LOG_FILE();
  if (!fs.existsSync(file)) return { entries: 0, head: "genesis" };
  const lines = fs.readFileSync(file, "utf-8").trim().split("\n").filter(Boolean);
  let prev = "genesis";
  lines.forEach((line, i) => {
    const entry = JSON.parse(line) as { record: TickRecord; prevHash: string; hash: string };
    if (entry.prevHash !== prev) {
      throw new Error(`chain break at entry ${i}: prevHash ${entry.prevHash} != ${prev}`);
    }
    const expect = sha256(entry.prevHash + canonical(entry.record));
    if (entry.hash !== expect) {
      throw new Error(`tampered record at entry ${i}: hash mismatch`);
    }
    prev = entry.hash;
  });
  return { entries: lines.length, head: prev };
}
