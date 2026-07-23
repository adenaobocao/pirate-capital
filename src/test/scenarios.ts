import { AGENTS } from "../config/agents.js";
import { applyGuardrails } from "../exec/articles.js";
import { PaperExecutor } from "../exec/executor.js";
import type { AgentState, MarketView, Order, Quote } from "../types.js";

/**
 * Scenario fuzzing for THE ARTICLES and the paper executor.
 * Thousands of random market states and hostile order batches, then we check
 * the invariants that must never break, whatever the model hallucinates:
 *
 *   1. cash never goes negative
 *   2. a ticker's position value never exceeds maxPositionPct of equity
 *      at decision time (with a small numerical tolerance)
 *   3. orders per tick never exceed maxOrdersPerTick
 *   4. sells never exceed what is actually held
 *   5. buys never exceed maxBuyPctOfCash of the cash remaining when accepted
 *
 * Run: npm run test:scenarios
 */

const TICKERS = ["NVDA", "AAPL", "TSLA", "AMD", "HOOD", "COIN"];
const ROUNDS = 3000;
const EPS = 1e-6;

function rnd(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomQuotes(): Quote[] {
  return TICKERS.map((t) => ({
    ticker: t,
    price: Math.round(rnd(5, 900) * 100) / 100,
    date: "2026-01-01",
    changePct1d: rnd(-0.1, 0.1),
  }));
}

function randomState(quotes: Quote[]): AgentState {
  const state: AgentState = {
    id: "fuzz",
    cash: Math.round(rnd(0, 2000) * 100) / 100,
    positions: {},
    trades: [],
    equityCurve: [],
    lastCommentary: "",
  };
  for (const q of quotes) {
    if (Math.random() < 0.4) {
      state.positions[q.ticker] = {
        qty: rnd(0.01, 5),
        avgPrice: Math.round(rnd(5, 900) * 100) / 100,
      };
    }
  }
  return state;
}

function hostileOrders(quotes: Quote[]): Order[] {
  const n = Math.floor(rnd(1, 9));
  const orders: Order[] = [];
  for (let i = 0; i < n; i++) {
    const action = pick(["buy", "buy", "sell", "hold"] as const);
    const dirty = Math.random();
    orders.push({
      action,
      ticker: Math.random() < 0.9 ? pick(TICKERS) : "FAKE",
      usd:
        dirty < 0.1 ? -50 :
        dirty < 0.2 ? NaN :
        dirty < 0.3 ? Infinity :
        dirty < 0.5 ? rnd(0, 10) :
        rnd(10, 100000),
      reasoning: "fuzz",
    });
  }
  return orders;
}

async function main() {
  let violations = 0;
  let accepted = 0;

  for (let round = 0; round < ROUNDS; round++) {
    const persona = pick(AGENTS);
    const quotes = randomQuotes();
    const view: MarketView = { quotes, mc: [], crowd: null, wire: null };
    const state = randomState(quotes);

    let equity = state.cash;
    for (const [t, p] of Object.entries(state.positions)) {
      const q = quotes.find((x) => x.ticker === t)!;
      equity += p.qty * q.price;
    }

    const heldBefore: Record<string, number> = {};
    for (const [t, p] of Object.entries(state.positions)) {
      const q = quotes.find((x) => x.ticker === t)!;
      heldBefore[t] = p.qty * q.price;
    }

    const orders = applyGuardrails(persona, hostileOrders(quotes), state.cash, equity, view, state.positions);

    // invariant 3
    if (orders.length > persona.risk.maxOrdersPerTick) {
      console.error(`round ${round}: too many orders (${orders.length})`);
      violations++;
    }

    // invariant 5 + simulated cash walk for buys
    let walkCash = state.cash;
    const boughtValue: Record<string, number> = {};
    for (const o of orders) {
      if (o.action !== "buy") continue;
      accepted++;
      if (o.usd > walkCash * persona.risk.maxBuyPctOfCash + EPS) {
        console.error(`round ${round}: buy ${o.usd} above buy cap of remaining cash ${walkCash}`);
        violations++;
      }
      walkCash -= o.usd;
      boughtValue[o.ticker] = (boughtValue[o.ticker] ?? 0) + o.usd;
    }
    if (walkCash < -EPS) {
      console.error(`round ${round}: cash walked negative (${walkCash})`);
      violations++;
    }

    // invariant 2
    for (const [t, usd] of Object.entries(boughtValue)) {
      const total = (heldBefore[t] ?? 0) + usd;
      if (total > equity * persona.risk.maxPositionPct + EPS) {
        console.error(`round ${round}: position ${t} ${total.toFixed(2)} above cap ${(equity * persona.risk.maxPositionPct).toFixed(2)}`);
        violations++;
      }
    }

    // now execute and check hard state invariants (1 and 4)
    const executor = new PaperExecutor();
    for (const o of orders) {
      const q = quotes.find((x) => x.ticker === o.ticker);
      if (!q) continue;
      const beforeQty = state.positions[o.ticker]?.qty ?? 0;
      const fill = await executor.execute(state, o, q.price);
      if (state.cash < -EPS) {
        console.error(`round ${round}: executor let cash go negative (${state.cash})`);
        violations++;
      }
      if (fill && fill.action === "sell" && fill.qty > beforeQty + EPS) {
        console.error(`round ${round}: sold ${fill.qty} with only ${beforeQty} held`);
        violations++;
      }
    }
  }

  console.log(`\nscenarios: ${ROUNDS} rounds, ${accepted} buys accepted, ${violations} violations`);
  if (violations > 0) {
    console.error("THE ARTICLES LEAK. fix before anything sails.");
    process.exit(1);
  }
  console.log("the articles hold. nothing leaked.\n");
}

main().catch((err) => {
  console.error("scenario run failed:", err);
  process.exit(1);
});
