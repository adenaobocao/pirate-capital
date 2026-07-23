import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGENTS, STARTING_CASH, UNIVERSE } from "./config/agents.js";
import { fetchQuotes } from "./market/yahoo.js";
import { computeEquity, loadCrowdReport, loadParley, loadState, loadWire } from "./portfolio/store.js";
import type { Quote } from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DASHBOARD = path.resolve(here, "../public/index.html");
const PORT = Number(process.env.PIRATE_PORT ?? 4243);

let quoteCache: { at: number; quotes: Quote[] } = { at: 0, quotes: [] };

async function getQuotes(): Promise<Quote[]> {
  if (Date.now() - quoteCache.at < 60_000 && quoteCache.quotes.length > 0) {
    return quoteCache.quotes;
  }
  const quotes = await fetchQuotes(UNIVERSE);
  if (quotes.length > 0) quoteCache = { at: Date.now(), quotes };
  return quoteCache.quotes;
}

async function buildState() {
  const quotes = await getQuotes();
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
          lastPrice: q?.price ?? p.avgPrice,
          pnlPct: q ? q.price / p.avgPrice - 1 : 0,
        };
      }),
      lastTrades: state.trades.slice(-8).reverse(),
      tradesCount: state.trades.length,
      equityCurve: state.equityCurve.slice(-120),
      lastCommentary: state.lastCommentary,
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    startingCash: STARTING_CASH,
    quotes,
    agents,
    crowd: loadCrowdReport(),
    parley: loadParley().threads.slice(0, 12),
    wire: loadWire(),
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === "/api/state") {
      const body = JSON.stringify(await buildState());
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(body);
      return;
    }
    if (req.url === "/" || req.url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(DASHBOARD));
      return;
    }
    res.writeHead(404);
    res.end("404");
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(String(err));
  }
});

server.listen(PORT, () => {
  console.log(`the pirate capital dashboard: http://localhost:${PORT}`);
});
