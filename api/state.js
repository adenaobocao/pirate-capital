import fs from "node:fs";
import path from "node:path";
import { gate, cacheFor } from "./_auth.js";

/**
 * Vercel serverless twin of the local dashboard endpoint in src/server.ts.
 * Self contained on purpose (no imports from src/) so the deploy ships only
 * public/ plus this file. Reads whatever state/ shipped with the deploy and
 * fetches live quotes, returning the same JSON shape the page expects.
 * While pre launch, .vercelignore excludes state/ on purpose, so this serves
 * a fresh crew; drop that line when the log should go public.
 */

const STARTING_CASH = 1000;

const UNIVERSE = [
  "NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "META",
  "GOOGL", "AMD", "HOOD", "COIN", "PLTR", "MSTR",
];

const AGENTS = [
  { id: "flint", name: "Flint", tagline: "the old captain. buys panic, sells euphoria" },
  { id: "cannon", name: "Cannon", tagline: "the gunner. full sail into momentum" },
  { id: "crow", name: "Crow", tagline: "the lookout. reads the tavern, trades the mood" },
  { id: "ledger", name: "Ledger", tagline: "the quartermaster. only the numbers, no rum" },
];

const STATE_DIR = path.join(process.cwd(), "state");

function loadState(agentId) {
  try {
    return JSON.parse(fs.readFileSync(path.join(STATE_DIR, `${agentId}.json`), "utf-8"));
  } catch {
    return {
      id: agentId,
      cash: STARTING_CASH,
      positions: {},
      trades: [],
      equityCurve: [],
      lastCommentary: "",
    };
  }
}

function loadCrowd() {
  try {
    return JSON.parse(fs.readFileSync(path.join(STATE_DIR, "crowd.json"), "utf-8"));
  } catch {
    return null;
  }
}

function loadParley() {
  for (const dir of [STATE_DIR, path.join(process.cwd(), "seed")]) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, "parley.json"), "utf-8"));
      if (parsed && Array.isArray(parsed.threads)) return parsed.threads.slice(0, 12);
    } catch {
      // try the next source
    }
  }
  return [];
}

async function fetchQuote(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=5d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (pirate-capital)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const rawCloses = result.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses.filter((c) => Number.isFinite(c) && c > 0);
    if (closes.length < 1) return null;
    const price = result.meta?.regularMarketPrice ?? closes[closes.length - 1];
    const prev = closes.length > 1 ? closes[closes.length - 2] : null;
    const date = new Date((result.meta?.regularMarketTime ?? 0) * 1000).toISOString().slice(0, 10);
    return {
      ticker,
      price: Math.round(price * 100) / 100,
      date,
      changePct1d: prev > 0 ? price / prev - 1 : null,
    };
  } catch {
    return null;
  }
}

function computeEquity(state, quotes) {
  let equity = state.cash;
  for (const [ticker, pos] of Object.entries(state.positions)) {
    const q = quotes.find((x) => x.ticker === ticker);
    equity += pos.qty * (q ? q.price : pos.avgPrice);
  }
  return Math.round(equity * 100) / 100;
}

export async function GET(request) {
  const closed = gate(request);
  if (closed) return closed;

  const quotes = (await Promise.all(UNIVERSE.map(fetchQuote))).filter(Boolean);

  const agents = AGENTS.map((persona) => {
    const state = loadState(persona.id);
    const equity = computeEquity(state, quotes);
    return {
      id: persona.id,
      name: persona.name,
      tagline: persona.tagline,
      cash: state.cash,
      equity,
      pnlPct: equity / STARTING_CASH - 1,
      positions: Object.entries(state.positions).map(([ticker, p]) => {
        const q = quotes.find((x) => x.ticker === ticker);
        return {
          ticker,
          qty: p.qty,
          avgPrice: p.avgPrice,
          lastPrice: q ? q.price : p.avgPrice,
          pnlPct: q ? q.price / p.avgPrice - 1 : 0,
        };
      }),
      lastTrades: state.trades.slice(-8).reverse(),
      tradesCount: state.trades.length,
      equityCurve: state.equityCurve.slice(-120),
      lastCommentary: state.lastCommentary,
    };
  });

  const body = {
    generatedAt: new Date().toISOString(),
    startingCash: STARTING_CASH,
    quotes,
    agents,
    crowd: loadCrowd(),
    parley: loadParley(),
  };

  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheFor("s-maxage=60, stale-while-revalidate=120"),
    },
  });
}
