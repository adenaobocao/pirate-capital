import Anthropic from "@anthropic-ai/sdk";
import { AGENTS, UNIVERSE } from "./config/agents.js";
import { decide } from "./brain/decide.js";
import { openAiCompatConfigured } from "./brain/llm.js";
import { applyGuardrails } from "./exec/articles.js";
import { PaperExecutor } from "./exec/executor.js";
import { fetchSnapshot } from "./market/yahoo.js";
import { computeEquity, loadState, saveCrowdReport, saveState } from "./portfolio/store.js";
import { appendTick, type TickRecord } from "./portfolio/provenance.js";
import { brainId } from "./brain/llm.js";
import { monteCarlo } from "./sim/montecarlo.js";
import { runCrowd } from "./sim/crowd.js";
import type { Decision, MarketView, McStats, Order } from "./types.js";

/**
 * One "tick" = one full decision cycle for the four pirates:
 *   market -> a thousand voyages (monte carlo) -> the tavern (crowd sim)
 *   -> decision per persona (the brain) -> the articles (guardrails) -> execution -> state.
 *
 * Brains: any OpenAI compatible endpoint via PIRATE_API_* (default, see
 * src/brain/llm.ts and .env.example), or the Anthropic API as a fallback.
 *
 * Usage:
 *   npm run tick               # real tick (needs a brain configured)
 *   npm run tick:dry           # no model: quant heuristic, to test the pipeline
 *   npm run tick -- --agent flint   # a single pirate
 */

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const onlyAgent = args.includes("--agent") ? args[args.indexOf("--agent") + 1] : null;

/** Heuristic for --dry mode (no model): simple quant pass to validate the pipeline. */
function dryDecision(view: MarketView, cash: number): Decision {
  const ranked = [...view.mc].sort((a, b) => b.expectedReturn - a.expectedReturn);
  const best: McStats | undefined = ranked.find((m) => m.pUp > 0.55);
  const orders: Order[] = best
    ? [{
        action: "buy",
        ticker: best.ticker,
        usd: Math.round(cash * 0.15),
        reasoning: `[dry] best monte carlo ev: ${best.ticker} (E[r]=${best.expectedReturn}, pUp=${best.pUp})`,
      }]
    : [];
  return { orders, commentary: "[dry run] heuristic decision, no model." };
}

async function main() {
  const ts = new Date().toISOString();
  console.log(`\nTHE PIRATE CAPITAL tick ${ts}${DRY ? " (dry)" : ""}\n`);

  // 1. Market
  const { quotes, closesByTicker } = await fetchSnapshot(UNIVERSE);
  if (quotes.length === 0) {
    console.error("No quotes (feed down?). Aborting tick.");
    process.exit(1);
  }
  console.log(`market: ${quotes.map((q) => `${q.ticker} $${q.price}`).join("  ")}\n`);

  // 2. A thousand voyages per ticker
  const mc: McStats[] = [];
  for (const q of quotes) {
    const stats = monteCarlo(q.ticker, closesByTicker[q.ticker] ?? []);
    if (stats) mc.push(stats);
  }

  // 3. The brain: openai compatible endpoint by default, anthropic as fallback
  const live = !DRY;
  const client = live && !openAiCompatConfigured() ? new Anthropic() : null;

  // 4. The tavern (one call, shared by the four pirates)
  const crowd = live ? await runCrowd(client, quotes, mc) : null;
  if (crowd) {
    console.log(`the tavern: ${crowd.vibe}\n`);
    saveCrowdReport({ ts, ...crowd });
  }

  const view: MarketView = { quotes, mc, crowd };
  const executor = new PaperExecutor();

  // 5. Decision + execution per pirate
  const pirateRecords: TickRecord["pirates"] = [];
  const personas = AGENTS.filter((a) => !onlyAgent || a.id === onlyAgent);
  for (const persona of personas) {
    const state = loadState(persona.id);
    const equity = computeEquity(state, quotes);

    const decision = live
      ? await decide(client, persona, state, view, equity)
      : dryDecision(view, state.cash);

    const orders = applyGuardrails(persona, decision.orders, state.cash, equity, view, state.positions);

    for (const order of orders) {
      const quote = quotes.find((q) => q.ticker === order.ticker)!;
      const fill = await executor.execute(state, order, quote.price);
      if (fill) {
        state.trades.push({ ts, ...fill, reasoning: order.reasoning });
        console.log(
          `  ${persona.name}: ${fill.action.toUpperCase()} ` +
            `${fill.qty.toFixed(4)} ${fill.ticker} @ $${fill.price} ($${fill.usd.toFixed(2)})`,
        );
        console.log(`     "${order.reasoning}"`);
      }
    }
    if (orders.length === 0) {
      console.log(`  ${persona.name}: HOLD`);
    }

    state.lastCommentary = decision.commentary;
    const newEquity = computeEquity(state, quotes);
    state.equityCurve.push({ ts, value: newEquity });
    saveState(state);
    pirateRecords.push({
      id: persona.id,
      proposed: decision.orders,
      accepted: orders,
      equityAfter: newEquity,
      cashAfter: state.cash,
      commentary: decision.commentary,
    });
    console.log(
      `     chest: $${newEquity.toFixed(2)} (cash $${state.cash.toFixed(2)})` +
        `  "${decision.commentary}"\n`,
    );
  }

  // 6. Tamper evident provenance: model id, crowd, proposed vs accepted, hash chained
  const head = appendTick({
    ts,
    brain: DRY ? "dry-heuristic" : brainId(),
    quotes: quotes.map((q) => ({ ticker: q.ticker, price: q.price })),
    crowd,
    pirates: pirateRecords,
  });
  console.log(`log head: ${head.slice(0, 16)}...  (verify with: npm run verify:log)`);
  console.log("tick done. dashboard: npm run dash\n");
}

main().catch((err) => {
  console.error("tick failed:", err);
  process.exit(1);
});
