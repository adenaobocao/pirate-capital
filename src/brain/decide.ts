import Anthropic from "@anthropic-ai/sdk";
import type { AgentPersona } from "../config/agents.js";
import type { AgentState, Decision, MarketView, Order } from "../types.js";
import { chatJson, openAiCompatConfigured } from "./llm.js";

const DECISION_SCHEMA = {
  type: "object",
  properties: {
    orders: {
      type: "array",
      items: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["buy", "sell", "hold"] },
          ticker: { type: "string" },
          usd: { type: "number", description: "dollar value of the order (0 for hold)" },
          reasoning: {
            type: "string",
            description: "short justification, lowercase informal english, in the pirate's voice. no emoji, no dashes.",
          },
        },
        required: ["action", "ticker", "usd", "reasoning"],
        additionalProperties: false,
      },
    },
    commentary: {
      type: "string",
      description: "the pirate's overall take on the market this tick, 1 or 2 sentences, lowercase informal english, in its voice. no emoji, no dashes.",
    },
  },
  required: ["orders", "commentary"],
  additionalProperties: false,
} as const;

const SILENT: Decision = { orders: [], commentary: "(the pirate said nothing this tick)" };

/** Defensive parse for the openai compatible path (no schema enforcement there). */
function coerceDecision(raw: unknown): Decision {
  if (!raw || typeof raw !== "object") return SILENT;
  const obj = raw as { orders?: unknown; commentary?: unknown };
  const orders: Order[] = Array.isArray(obj.orders)
    ? obj.orders
        .filter((o): o is Record<string, unknown> => Boolean(o) && typeof o === "object")
        .filter((o) => o.action === "buy" || o.action === "sell" || o.action === "hold")
        .map((o) => ({
          action: o.action as Order["action"],
          ticker: String(o.ticker ?? ""),
          usd: Number(o.usd ?? 0),
          reasoning: String(o.reasoning ?? ""),
        }))
    : [];
  return {
    orders,
    commentary: typeof obj.commentary === "string" ? obj.commentary : SILENT.commentary,
  };
}

export async function decide(
  client: Anthropic | null,
  persona: AgentPersona,
  state: AgentState,
  view: MarketView,
  equity: number,
): Promise<Decision> {
  const portfolio = {
    cash: state.cash,
    equity,
    positions: Object.entries(state.positions).map(([ticker, p]) => {
      const q = view.quotes.find((x) => x.ticker === ticker);
      return {
        ticker,
        qty: p.qty,
        avgPrice: p.avgPrice,
        lastPrice: q?.price ?? null,
        pnlPct: q ? q.price / p.avgPrice - 1 : null,
      };
    }),
    lastTrades: state.trades.slice(-5),
  };

  const payload = {
    universe: view.quotes.map((q) => q.ticker),
    quotes: view.quotes,
    monteCarlo: view.mc,
    crowd: view.crowd,
    portfolio,
    limits: {
      maxOrdersPerTick: persona.risk.maxOrdersPerTick,
      maxBuyPctOfCash: persona.risk.maxBuyPctOfCash,
      maxPositionPctOfEquity: persona.risk.maxPositionPct,
    },
  };
  const userMsg = `New tick. State of the market and of your portfolio:\n${JSON.stringify(payload, null, 2)}\n\nDecide your orders for this tick (or hold).`;

  // default path: any openai compatible endpoint (see src/brain/llm.ts)
  if (openAiCompatConfigured()) {
    const system = `${persona.directive}

Respond with ONLY minified JSON, no prose, in exactly this shape:
{"orders":[{"action":"buy|sell|hold","ticker":"NVDA","usd":123,"reasoning":"..."}],"commentary":"..."}`;
    return coerceDecision(await chatJson(system, userMsg));
  }

  if (!client) return SILENT;

  const response = await client.messages.create({
    model: process.env.PIRATE_MODEL ?? "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: persona.directive,
    output_config: { format: { type: "json_schema", schema: DECISION_SCHEMA } },
    messages: [{ role: "user", content: userMsg }],
  });

  if (response.stop_reason === "refusal") {
    return { orders: [], commentary: "(the pirate refused to speak this tick)" };
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return SILENT;
  return JSON.parse(text.text) as Decision;
}
