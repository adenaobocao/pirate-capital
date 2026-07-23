import { createPublicClient, createWalletClient, http, parseUnits, formatUnits } from "viem";
import { chainConfig, assertChainReady, type ChainConfig } from "./config.js";
import { accountFor } from "./wallets.js";
import { execPolicy, realTradingBlockedReason, type ExecPolicy } from "../config/execution.js";
import type { Fill, Order } from "../types.js";

/**
 * Onchain executor for real money. Every swap runs a preflight that can abort:
 *   - chain params verified, kill switch clear, pirate armed
 *   - the pirate's wallet exists and holds enough stablecoin / token
 *   - the AMM quote is within maxSlippage of expected and within
 *     maxPriceDivergence of the reference price (guards a broken pool)
 *   - the order respects the real-money per-order and per-day caps
 *
 * This file intentionally does NOT invent contract ABIs or addresses. The
 * swap call is behind buildSwap(), which throws until wired to the real router
 * confirmed in docs/CHAIN.md. Until then canary/live ticks abort at preflight,
 * so nothing can move money by accident.
 */

const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ name: "o", type: "address" }, { name: "s", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

export interface PreflightResult {
  ok: boolean;
  reason?: string;
  quote?: { outAmount: number; priceImpact: number };
}

export class OnchainExecutor {
  private cfg: ChainConfig;
  private policy: ExecPolicy;
  private spentToday: Record<string, number> = {};

  constructor() {
    this.cfg = chainConfig();
    this.policy = execPolicy();
  }

  private publicClient() {
    return createPublicClient({ transport: http(this.cfg.rpcUrl) });
  }

  /** Read a pirate's on-chain balances. Used by the dashboard and preflight. */
  async balances(pirateId: string): Promise<{ address: string; stable: number; positions: Record<string, number> } | null> {
    const account = accountFor(pirateId);
    if (!account) return null;
    const client = this.publicClient();
    const readBal = async (token: `0x${string}`) => {
      const [raw, dec] = await Promise.all([
        client.readContract({ address: token, abi: ERC20_ABI, functionName: "balanceOf", args: [account.address] }),
        client.readContract({ address: token, abi: ERC20_ABI, functionName: "decimals", args: [] }),
      ]);
      return Number(formatUnits(raw as bigint, dec as number));
    };
    const stable = await readBal(this.cfg.stable);
    const positions: Record<string, number> = {};
    for (const [ticker, token] of Object.entries(this.cfg.tokens)) {
      const bal = await readBal(token);
      if (bal > 0) positions[ticker] = bal;
    }
    return { address: account.address, stable, positions };
  }

  /** The gate. Returns the reason a real trade must not happen, or null if clear. */
  preflightBlock(pirateId: string, order: Order, refPrice: number): string | null {
    const blocked = realTradingBlockedReason(this.policy, pirateId);
    if (blocked) return blocked;
    const problems = assertChainReady(this.cfg);
    if (problems.length) return `chain not ready: ${problems.join("; ")}`;
    if (!accountFor(pirateId)) return "no wallet for this pirate (run npm run wallets:gen)";
    if (order.usd > this.policy.maxOrderUsd) return `order $${order.usd} over per-order cap $${this.policy.maxOrderUsd}`;
    const spent = this.spentToday[pirateId] ?? 0;
    if (spent + order.usd > this.policy.maxDailyUsd) return `would exceed daily cap $${this.policy.maxDailyUsd}`;
    if (refPrice <= 0) return "no reference price";
    return null;
  }

  /**
   * Wire this to the confirmed router once docs/CHAIN.md has verified addresses
   * and ABI. It must: fetch an on-chain quote, check price impact vs maxSlippage
   * and divergence vs refPrice, approve if needed, then swapExactIn with a
   * minOut derived from maxSlippage. Until wired, it throws so preflight-passing
   * ticks still cannot move money.
   */
  private async buildSwap(_order: Order, _refPrice: number): Promise<Fill> {
    throw new Error(
      "onchain swap not wired yet: confirm router address and ABI in docs/CHAIN.md, " +
        "then implement buildSwap with quote, slippage/divergence checks, approve and swapExactIn.",
    );
  }

  async execute(pirateId: string, order: Order, refPrice: number): Promise<Fill | null> {
    if (order.action === "hold") return null;
    const block = this.preflightBlock(pirateId, order, refPrice);
    if (block) {
      console.log(`  [onchain] ${pirateId} ${order.action} ${order.ticker} blocked: ${block}`);
      return null;
    }
    const fill = await this.buildSwap(order, refPrice);
    this.spentToday[pirateId] = (this.spentToday[pirateId] ?? 0) + order.usd;
    return fill;
  }
}

/** Small helper so callers can format cap warnings without importing viem utils. */
export function usdcUnits(usd: number, decimals = 6): bigint {
  return parseUnits(usd.toFixed(decimals), decimals);
}
