/**
 * THE WIRE: real-world signal enrichment for the pirates.
 *
 * Turns the outside world into per-ticker numbers the agents reason over, so
 * they trade on news, policy and sentiment, not just price and monte carlo.
 *
 * Keyless sources (work with no signup, used now):
 *   - GDELT DOC 2.0     news tone per company + tariff/policy/speech tone
 *   - Federal Register  executive orders / tariff actions (policy events)
 *   - alternative.me    crypto Fear & Greed (ETH/crypto risk mood)
 * Optional keyed sources (plug in when the env keys exist, free tiers):
 *   - Alpha Vantage NEWS_SENTIMENT (ALPHAVANTAGE_KEY)
 *   - Finnhub recommendation trends (FINNHUB_KEY)
 *   - FRED macro series (FRED_KEY)
 *
 * Every source degrades gracefully: a dead source drops its weight and the rest
 * renormalize. The wire never blocks or breaks a tick.
 */

export interface TickerSignal {
  ticker: string;
  /** fused -1 (bearish) .. +1 (bullish) */
  signal: number;
  newsTone: number | null;
  analyst: number | null;
  headline: string | null;
  sources: string[];
}

export interface MacroContext {
  policyNote: string | null;
  tariffPressure: number | null; // -1 (heavy new tariff activity) .. 0
  cryptoFearGreed: number | null; // -1 fear .. +1 greed
  rates: string | null;
  asOf: string;
}

export interface WireReport {
  macro: MacroContext;
  tickers: TickerSignal[];
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CACHE_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../state/wire.json");
const CACHE_TTL_MS = 30 * 60_000;

// GDELT allows ~1 request / 5s. Space calls out with a module-level gate.
let gdeltLast = 0;
async function gdeltGate(): Promise<void> {
  const wait = Math.max(0, gdeltLast + 5500 - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  gdeltLast = Date.now();
}

const COMPANY: Record<string, string> = {
  NVDA: "NVIDIA", AAPL: "Apple", MSFT: "Microsoft", TSLA: "Tesla",
  AMZN: "Amazon", META: "Meta Platforms", GOOGL: "Google", AMD: "AMD",
  HOOD: "Robinhood", COIN: "Coinbase", PLTR: "Palantir", MSTR: "MicroStrategy",
};

async function getJson(url: string, ms = 7000): Promise<any | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "pirate-capital/wire" },
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const clamp = (x: number) => Math.max(-1, Math.min(1, x));

/** GDELT tone + latest headline in one rate-limited pass (tone ~ -10..+10 -> -1..+1). */
async function gdeltToneAndHeadline(query: string): Promise<{ tone: number | null; headline: string | null }> {
  await gdeltGate();
  const toneUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(`"${query}"`)}&mode=TimelineTone&timespan=2d&format=json`;
  const tj = await getJson(toneUrl);
  const series = tj?.timeline?.[0]?.data;
  let tone: number | null = null;
  if (Array.isArray(series) && series.length) {
    const recent = series.slice(-8);
    tone = clamp(recent.reduce((a: number, p: any) => a + (Number(p.value) || 0), 0) / recent.length / 6);
  }
  await gdeltGate();
  const artUrl = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(`"${query}"`)}&mode=ArtList&maxrecords=1&sort=DateDesc&format=json`;
  const aj = await getJson(artUrl);
  const headline = aj?.articles?.[0]?.title ? String(aj.articles[0].title).slice(0, 140) : null;
  return { tone, headline };
}

/** Tariff / executive-action pressure from the Federal Register (keyless). */
async function tariffPressure(): Promise<{ score: number; note: string } | null> {
  const url = `https://www.federalregister.gov/api/v1/documents.json?conditions[type][]=PRESDOCU&conditions[term]=tariff&per_page=5&order=newest&fields[]=title&fields[]=publication_date`;
  const j = await getJson(url);
  const docs = j?.results;
  if (!Array.isArray(docs)) return null;
  const now = Date.now();
  let recent = 0;
  for (const d of docs) {
    const t = new Date(d.publication_date).getTime();
    if (now - t < 21 * 86400_000) recent++;
  }
  const score = clamp(-recent / 4); // more recent tariff docs -> more risk-off
  const note = docs[0]?.title
    ? `latest tariff action: ${String(docs[0].title).slice(0, 100)}`
    : "no recent tariff actions";
  return { score, note };
}

/** Crypto Fear & Greed 0..100 -> -1..+1 (keyless). */
async function cryptoFearGreed(): Promise<number | null> {
  const j = await getJson("https://api.alternative.me/fng/?limit=1&format=json");
  const v = Number(j?.data?.[0]?.value);
  return Number.isFinite(v) ? clamp((v - 50) / 50) : null;
}

/** Alpha Vantage per-ticker news sentiment (optional, ALPHAVANTAGE_KEY). One call, all tickers. */
async function alphaVantageSentiment(tickers: string[]): Promise<Record<string, number>> {
  const key = process.env.ALPHAVANTAGE_KEY;
  if (!key) return {};
  const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${tickers.join(",")}&sort=LATEST&limit=200&apikey=${key}`;
  const j = await getJson(url, 9000);
  const feed = j?.feed;
  if (!Array.isArray(feed)) return {};
  const acc: Record<string, { sum: number; n: number }> = {};
  for (const item of feed) {
    for (const ts of item.ticker_sentiment ?? []) {
      const t = ts.ticker;
      if (!tickers.includes(t)) continue;
      const s = Number(ts.ticker_sentiment_score);
      if (!Number.isFinite(s)) continue;
      acc[t] = acc[t] ?? { sum: 0, n: 0 };
      acc[t].sum += s;
      acc[t].n += 1;
    }
  }
  const out: Record<string, number> = {};
  for (const [t, v] of Object.entries(acc)) out[t] = clamp(v.sum / v.n);
  return out;
}

/** Finnhub analyst recommendation trend -> -1..+1 (optional, FINNHUB_KEY). */
async function finnhubAnalyst(ticker: string): Promise<number | null> {
  const key = process.env.FINNHUB_KEY;
  if (!key) return null;
  const j = await getJson(`https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${key}`);
  const r = Array.isArray(j) ? j[0] : null;
  if (!r) return null;
  const total = (r.strongBuy || 0) + (r.buy || 0) + (r.hold || 0) + (r.sell || 0) + (r.strongSell || 0);
  if (!total) return null;
  const score = (2 * r.strongBuy + r.buy - r.sell - 2 * r.strongSell) / (2 * total);
  return clamp(score);
}

/** FRED 10y-2y spread as a compact rates-regime note (optional, FRED_KEY). */
async function fredRates(): Promise<string | null> {
  const key = process.env.FRED_KEY;
  if (!key) return null;
  const j = await getJson(`https://api.stlouisfed.org/fred/series/observations?series_id=T10Y2Y&api_key=${key}&file_type=json&sort_order=desc&limit=1`);
  const v = Number(j?.observations?.[0]?.value);
  if (!Number.isFinite(v)) return null;
  return v < 0 ? `10y2y inverted (${v.toFixed(2)})` : `10y2y ${v.toFixed(2)}`;
}

/** Cached wire: reads state/wire.json if fresh, else refetches. News/policy do
 *  not need per-tick freshness, and GDELT is harshly rate limited. */
export async function getWire(tickers: string[]): Promise<WireReport> {
  try {
    const cached = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8")) as WireReport & { fetchedAt?: number };
    if (cached.fetchedAt && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached;
  } catch {
    // no cache yet
  }
  const wire = await fetchWire(tickers);
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ ...wire, fetchedAt: Date.now() }, null, 2));
  } catch {
    // best effort
  }
  return wire;
}

export async function fetchWire(tickers: string[]): Promise<WireReport> {
  const [tariff, fng, rates, avSent] = await Promise.all([
    tariffPressure(),
    cryptoFearGreed(),
    fredRates(),
    alphaVantageSentiment(tickers),
  ]);

  const macro: MacroContext = {
    policyNote: tariff?.note ?? null,
    tariffPressure: tariff?.score ?? null,
    cryptoFearGreed: fng,
    rates,
    asOf: new Date().toISOString(),
  };

  // GDELT is serial (rate limited); analyst is parallel-safe.
  const perTicker: TickerSignal[] = [];
  for (const ticker of tickers) {
    const name = COMPANY[ticker] ?? ticker;
    const [{ tone, headline }, analyst] = await Promise.all([
      gdeltToneAndHeadline(name),
      finnhubAnalyst(ticker),
    ]);
    {
      const av = avSent[ticker] ?? null;
      const parts: { v: number; w: number }[] = [];
      if (av !== null) parts.push({ v: av, w: 0.4 });
      if (tone !== null) parts.push({ v: tone, w: av !== null ? 0.2 : 0.5 });
      if (analyst !== null) parts.push({ v: analyst, w: 0.25 });
      if (macro.tariffPressure !== null) parts.push({ v: macro.tariffPressure, w: 0.1 });
      const wsum = parts.reduce((a, p) => a + p.w, 0);
      const signal = wsum > 0 ? clamp(parts.reduce((a, p) => a + p.v * p.w, 0) / wsum) : 0;
      const sources: string[] = [];
      if (av !== null) sources.push("alphavantage");
      if (tone !== null) sources.push("gdelt");
      if (analyst !== null) sources.push("finnhub");
      perTicker.push({ ticker, signal: Math.round(signal * 100) / 100, newsTone: tone, analyst, headline, sources });
    }
  }

  return { macro, tickers: perTicker };
}
