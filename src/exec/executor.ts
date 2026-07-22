import type { AgentState, Fill, Order } from "../types.js";

/**
 * Execution interface. Phase 1: PaperExecutor (simulated).
 * Phase 3: RobinhoodChainExecutor (see robinhood-chain.ts).
 */
export interface Executor {
  execute(state: AgentState, order: Order, price: number): Promise<Fill | null>;
}

/**
 * Honest paper friction (panel finding: frictionless fills at last price
 * inflate the record). 15 bps total per side approximates spread + fees for
 * liquid mega caps; the real era will replace this with actual fills.
 */
const FRICTION = 0.0015;

export class PaperExecutor implements Executor {
  async execute(state: AgentState, order: Order, price: number): Promise<Fill | null> {
    if (order.action === "hold" || price <= 0) return null;

    if (order.action === "buy") {
      const fillPrice = price * (1 + FRICTION);
      const usd = Math.min(order.usd, state.cash);
      if (usd < 1) return null;
      const qty = usd / fillPrice;
      const pos = state.positions[order.ticker];
      if (pos) {
        pos.avgPrice = (pos.avgPrice * pos.qty + price * qty) / (pos.qty + qty);
        pos.qty += qty;
      } else {
        state.positions[order.ticker] = { qty, avgPrice: price };
      }
      state.cash -= usd;
      return { ticker: order.ticker, action: "buy", qty, price, usd };
    }

    // sell
    const pos = state.positions[order.ticker];
    if (!pos || pos.qty <= 0) return null;
    const maxUsd = pos.qty * price;
    const usd = Math.min(order.usd, maxUsd);
    if (usd < 1) return null;
    const qty = usd / price;
    pos.qty -= qty;
    if (pos.qty * price < 0.5) {
      // dust left: liquidate the rest
      state.cash += pos.qty * price;
      delete state.positions[order.ticker];
    }
    state.cash += usd;
    return { ticker: order.ticker, action: "sell", qty, price, usd };
  }
}
