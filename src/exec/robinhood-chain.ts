import type { AgentState, Fill, Order } from "../types.js";
import type { Executor } from "./executor.js";

/**
 * PHASE 3: real execution. Two possible paths, in order of simplicity:
 *
 * (A) Robinhood Agentic Trading (MCP) - RECOMMENDED FIRST STEP
 *     Robinhood exposes an official Trading MCP server: you connect the agent to
 *     a dedicated agentic trading account and send equity orders via MCP.
 *     Docs: https://robinhood.com/us/en/support/agentic-trading
 *     Pros: official path, compliance built in, spot equities.
 *     Cons: US account, beta with limited asset classes, off chain
 *     (the "onchain" narrative waits for path B).
 *
 * (B) 100% onchain on Robinhood Chain (Arbitrum Orbit, mainnet since 2026-07-01)
 *     - One wallet per pirate (its own private key, the "life" of the agent).
 *     - Stock Tokens (NVDA, AAPL, ...) traded 24/7 on the chain's dedicated
 *       Uniswap AMM, paired with USDC/USDG.
 *     - Implementation: viem + the Robinhood Chain RPC; swapExactIn on the
 *       Uniswap router; Chainlink oracle as a price sanity check before the swap
 *       (configurable max slippage).
 *     Pros: perfect narrative for the token (public wallets, every trade
 *     auditable on the explorer, people literally watch).
 *     Cons: pool liquidity, jurisdiction (stock tokens are not offered in every
 *     region), key management.
 *
 * This stub exists to keep the rest of the system pluggable: when phase 3
 * arrives, implement execute() and swap the executor in run.ts.
 */
export class RobinhoodChainExecutor implements Executor {
  async execute(_state: AgentState, _order: Order, _price: number): Promise<Fill | null> {
    throw new Error(
      "RobinhoodChainExecutor not implemented yet. Use PaperExecutor (phase 1). " +
        "See the comments in this file for the integration plan.",
    );
  }
}
