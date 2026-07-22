import Anthropic from "@anthropic-ai/sdk";
import type { CrowdReport, McStats, Quote } from "../types.js";
import { chatJson, openAiCompatConfigured } from "../brain/llm.js";

/**
 * THE TAVERN, a crowd simulation inspired by MiroFish:
 * one model call roleplays a panel of 24 investor personas
 * (from the dividend boomer to the leveraged degen) reacting to the
 * state of the market, then aggregates per-ticker sentiment in [-1, +1].
 */

const CROWD_SCHEMA = {
  type: "object",
  properties: {
    vibe: {
      type: "string",
      description: "one line summary of the tavern's overall mood, lowercase informal english. no emoji, no dashes.",
    },
    takes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ticker: { type: "string" },
          sentiment: {
            type: "number",
            description: "aggregated sentiment of the tavern: -1 panic .. +1 euphoria",
          },
          summary: {
            type: "string",
            description: "one line on what the tavern says about this ticker, lowercase informal english. no emoji, no dashes.",
          },
        },
        required: ["ticker", "sentiment", "summary"],
        additionalProperties: false,
      },
    },
  },
  required: ["vibe", "takes"],
  additionalProperties: false,
} as const;

const CROWD_SYSTEM = `You are the engine of THE TAVERN, a market crowd simulation.
Mentally roleplay 24 distinct investor personas (a dividend boomer, an options degen,
a skeptical quant, a finance influencer, a conservative retiree, a tech maximalist,
a macro trader, a rookie on their first deposit...). Each persona reacts to the market
snapshot in their own way. Then AGGREGATE the reactions into one sentiment per ticker
in the range [-1, +1]:
-1 = widespread panic or aversion, 0 = indifference or a split, +1 = widespread euphoria or FOMO.
Stay faithful to crowd psychology: strong momentum breeds FOMO, drops breed fear and denial,
meme tickers polarize. Do not give advice. Just simulate the crowd.`;

function coerceCrowd(raw: unknown): CrowdReport | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { vibe?: unknown; takes?: unknown };
  if (typeof obj.vibe !== "string" || !Array.isArray(obj.takes)) return null;
  const takes = obj.takes
    .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === "object")
    .map((t) => ({
      ticker: String(t.ticker ?? ""),
      sentiment: Math.max(-1, Math.min(1, Number(t.sentiment ?? 0))),
      summary: String(t.summary ?? ""),
    }));
  return { vibe: obj.vibe, takes };
}

export async function runCrowd(
  client: Anthropic | null,
  quotes: Quote[],
  mc: McStats[],
): Promise<CrowdReport | null> {
  const snapshot = quotes.map((q) => {
    const m = mc.find((s) => s.ticker === q.ticker);
    return {
      ticker: q.ticker,
      price: q.price,
      changePct1d: q.changePct1d,
      mom30d: m?.mom30d ?? null,
      sigmaDaily: m?.sigmaDaily ?? null,
    };
  });
  const userMsg = `Market snapshot right now:\n${JSON.stringify(snapshot, null, 2)}\n\nSimulate the tavern and aggregate sentiment per ticker.`;

  // default path: any openai compatible endpoint (see src/brain/llm.ts)
  if (openAiCompatConfigured()) {
    const system = `${CROWD_SYSTEM}

Respond with ONLY minified JSON, no prose, in exactly this shape:
{"vibe":"...","takes":[{"ticker":"NVDA","sentiment":0.4,"summary":"..."}]}`;
    return coerceCrowd(await chatJson(system, userMsg));
  }

  if (!client) return null;

  const response = await client.messages.create({
    model: process.env.PIRATE_CROWD_MODEL ?? process.env.PIRATE_MODEL ?? "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: CROWD_SYSTEM,
    output_config: { format: { type: "json_schema", schema: CROWD_SCHEMA } },
    messages: [{ role: "user", content: userMsg }],
  });

  if (response.stop_reason === "refusal") return null;
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") return null;
  const report = JSON.parse(text.text) as CrowdReport;
  // defensive clamp
  for (const t of report.takes) {
    t.sentiment = Math.max(-1, Math.min(1, t.sentiment));
  }
  return report;
}
