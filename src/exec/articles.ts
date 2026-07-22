import type { AgentPersona } from "../config/agents.js";
import type { MarketView, Order } from "../types.js";

/**
 * THE ARTICLES: risk rules in code, signed like ship articles.
 * The model proposes orders; this function decides what is allowed.
 * Invariants (enforced here, proven by src/test/scenarios.ts):
 * - never spend more cash than the pirate has
 * - a single buy never exceeds maxBuyPctOfCash of remaining cash
 * - a ticker's total position (held + bought this tick) never exceeds
 *   maxPositionPct of equity at decision time
 * - at most maxOrdersPerTick orders pass
 */
export function applyGuardrails(
  persona: AgentPersona,
  orders: Order[],
  cash: number,
  equity: number,
  view: MarketView,
  positions: Record<string, { qty: number; avgPrice: number }>,
): Order[] {
  const valid: Order[] = [];
  let remainingCash = cash;
  // market value already held per ticker, so the position cap counts what the
  // pirate owns, not just this order
  const heldValue: Record<string, number> = {};
  for (const [ticker, pos] of Object.entries(positions)) {
    const q = view.quotes.find((x) => x.ticker === ticker);
    heldValue[ticker] = pos.qty * (q?.price ?? pos.avgPrice);
  }
  for (const order of orders) {
    if (valid.length >= persona.risk.maxOrdersPerTick) break;
    if (order.action === "hold") continue;
    const quote = view.quotes.find((q) => q.ticker === order.ticker);
    if (!quote) continue;
    if (!Number.isFinite(order.usd) || order.usd <= 0) continue;

    if (order.action === "buy") {
      const current = heldValue[order.ticker] ?? 0;
      const cap = Math.min(
        remainingCash * persona.risk.maxBuyPctOfCash,
        Math.max(0, equity * persona.risk.maxPositionPct - current),
        remainingCash,
      );
      const usd = Math.min(order.usd, cap);
      if (usd < 5) continue;
      remainingCash -= usd;
      heldValue[order.ticker] = current + usd;
      valid.push({ ...order, usd });
    } else {
      valid.push(order);
    }
  }
  return valid;
}
