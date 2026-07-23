/**
 * Execution mode and the real-money safety rails.
 *
 * Three modes, chosen by EXEC_MODE (default paper):
 *   paper  - simulated fills against real prices. no keys, no chain. the default.
 *   canary - onchain, real money, but ONE armed pirate and hard tiny caps.
 *   live   - onchain, real money, all armed pirates.
 *
 * Real money never moves unless ALL of these are true:
 *   - EXEC_MODE is canary or live
 *   - EXEC_ARM=YES_I_MEAN_IT   (a deliberate second switch)
 *   - the kill switch file is absent
 *   - the chain params pass assertChainReady()
 *   - the pirate has a funded wallet in the vault
 *
 * Caps are enforced in code on top of the articles, so a bad tick or a bad
 * model output cannot drain a wallet.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type ExecMode = "paper" | "canary" | "live";

export interface ExecPolicy {
  mode: ExecMode;
  armed: boolean;
  /** in canary mode, only this pirate id trades real */
  canaryPirate: string;
  /** hard caps, real money, per pirate */
  maxOrderUsd: number;
  maxDailyUsd: number;
  /** max slippage tolerated on a swap, e.g. 0.01 = 1% */
  maxSlippage: number;
  /** max gap allowed between the AMM quote and the reference (yahoo) price */
  maxPriceDivergence: number;
  killSwitchPath: string;
}

export function killSwitchPath(): string {
  return process.env.PIRATE_KILL_SWITCH ?? path.join(os.homedir(), ".pirate-capital", "STOP");
}

export function killSwitchEngaged(): boolean {
  return fs.existsSync(killSwitchPath());
}

export function execPolicy(): ExecPolicy {
  const mode = (process.env.EXEC_MODE as ExecMode) || "paper";
  return {
    mode: mode === "canary" || mode === "live" ? mode : "paper",
    armed: process.env.EXEC_ARM === "YES_I_MEAN_IT",
    canaryPirate: process.env.EXEC_CANARY ?? "ledger",
    maxOrderUsd: Number(process.env.EXEC_MAX_ORDER_USD ?? 15),
    maxDailyUsd: Number(process.env.EXEC_MAX_DAILY_USD ?? 40),
    maxSlippage: Number(process.env.EXEC_MAX_SLIPPAGE ?? 0.01),
    maxPriceDivergence: Number(process.env.EXEC_MAX_DIVERGENCE ?? 0.03),
    killSwitchPath: killSwitchPath(),
  };
}

/** Is this pirate allowed to trade real money this tick? Returns the reason if not. */
export function realTradingBlockedReason(policy: ExecPolicy, pirateId: string): string | null {
  if (policy.mode === "paper") return "paper mode";
  if (!policy.armed) return "not armed (EXEC_ARM unset)";
  if (killSwitchEngaged()) return "kill switch engaged";
  if (policy.mode === "canary" && pirateId !== policy.canaryPirate) return "canary mode, not the canary pirate";
  return null;
}
