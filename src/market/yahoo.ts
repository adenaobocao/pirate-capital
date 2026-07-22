import type { Quote } from "../types.js";

/**
 * Market data via Yahoo Finance (public chart endpoint, no key needed).
 * One call per ticker returns the current quote plus daily history.
 */

const CHART_URL = (t: string) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}?range=1y&interval=1d`;

interface ChartData {
  quote: Quote;
  /** daily closes, oldest to newest */
  closes: number[];
}

export async function fetchChart(ticker: string): Promise<ChartData | null> {
  try {
    const res = await fetch(CHART_URL(ticker), {
      headers: { "User-Agent": "Mozilla/5.0 (pirate-capital)" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses.filter((c): c is number => Number.isFinite(c) && (c as number) > 0);
    if (closes.length < 2) return null;

    const price: number = result.meta?.regularMarketPrice ?? closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    const date = new Date((result.meta?.regularMarketTime ?? 0) * 1000)
      .toISOString()
      .slice(0, 10);

    return {
      quote: {
        ticker,
        price: Math.round(price * 100) / 100,
        date,
        changePct1d: prev > 0 ? price / prev - 1 : null,
      },
      closes: closes.slice(-140),
    };
  } catch {
    return null;
  }
}

export interface MarketSnapshot {
  quotes: Quote[];
  closesByTicker: Record<string, number[]>;
}

export async function fetchSnapshot(tickers: string[]): Promise<MarketSnapshot> {
  const charts = await Promise.all(tickers.map(fetchChart));
  const quotes: Quote[] = [];
  const closesByTicker: Record<string, number[]> = {};
  charts.forEach((c) => {
    if (!c) return;
    quotes.push(c.quote);
    closesByTicker[c.quote.ticker] = c.closes;
  });
  return { quotes, closesByTicker };
}

export async function fetchQuotes(tickers: string[]): Promise<Quote[]> {
  return (await fetchSnapshot(tickers)).quotes;
}
