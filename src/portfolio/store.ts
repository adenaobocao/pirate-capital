import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STARTING_CASH } from "../config/agents.js";
import type { AgentState, Quote } from "../types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const STATE_DIR = path.resolve(here, "../../state");

function stateFile(agentId: string): string {
  return path.join(STATE_DIR, `${agentId}.json`);
}

export function loadState(agentId: string): AgentState {
  const file = stateFile(agentId);
  if (fs.existsSync(file)) {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as AgentState;
  }
  return {
    id: agentId,
    cash: STARTING_CASH,
    positions: {},
    trades: [],
    equityCurve: [],
    lastCommentary: "",
  };
}

export function saveState(state: AgentState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(stateFile(state.id), JSON.stringify(state, null, 2));
}

export function saveCrowdReport(report: object): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(path.join(STATE_DIR, "crowd.json"), JSON.stringify(report, null, 2));
}

export function loadCrowdReport(): object | null {
  const file = path.join(STATE_DIR, "crowd.json");
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export function loadWire(): object | null {
  const file = path.join(STATE_DIR, "wire.json");
  if (!fs.existsSync(file)) return null;
  try {
    const w = JSON.parse(fs.readFileSync(file, "utf-8"));
    return { macro: w.macro, tickers: w.tickers };
  } catch {
    return null;
  }
}

export interface ParleyThread {
  id: number;
  topic: string;
  ts: string;
  posts: { author: string; text: string }[];
}

export interface ParleyState {
  threads: ParleyThread[];
}

const SEED_DIR = path.resolve(here, "../../seed");

/** The parley lives in state/ once generated; seed/ ships the opening rounds. */
export function loadParley(): ParleyState {
  for (const dir of [STATE_DIR, SEED_DIR]) {
    const file = path.join(dir, "parley.json");
    if (fs.existsSync(file)) {
      try {
        return JSON.parse(fs.readFileSync(file, "utf-8")) as ParleyState;
      } catch {
        // fall through to the next source
      }
    }
  }
  return { threads: [] };
}

export function saveParley(state: ParleyState): void {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(path.join(STATE_DIR, "parley.json"), JSON.stringify(state, null, 2));
}

export function computeEquity(state: AgentState, quotes: Quote[]): number {
  let equity = state.cash;
  for (const [ticker, pos] of Object.entries(state.positions)) {
    const q = quotes.find((x) => x.ticker === ticker);
    // no quote: fall back to the average price
    equity += pos.qty * (q?.price ?? pos.avgPrice);
  }
  return Math.round(equity * 100) / 100;
}
