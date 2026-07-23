export type Action = "buy" | "sell" | "hold";

export interface Quote {
  ticker: string;
  price: number;
  date: string;
  changePct1d: number | null;
}

export interface McStats {
  ticker: string;
  horizonDays: number;
  paths: number;
  /** expected return over the horizon (e.g. 0.023 = +2.3%) */
  expectedReturn: number;
  /** probability of ending the horizon above the current price */
  pUp: number;
  /** 5th percentile of return (bad scenario) */
  p5: number;
  /** 95th percentile of return (good scenario) */
  p95: number;
  /** estimated daily volatility */
  sigmaDaily: number;
  /** 30 day momentum (return) */
  mom30d: number;
}

export interface CrowdTake {
  ticker: string;
  /** -1 (panic) .. +1 (euphoria), aggregated across the park's personas */
  sentiment: number;
  summary: string;
}

export interface CrowdReport {
  vibe: string;
  takes: CrowdTake[];
}

export interface Order {
  action: Action;
  ticker: string;
  usd: number;
  reasoning: string;
}

export interface Decision {
  orders: Order[];
  commentary: string;
}

export interface Position {
  qty: number;
  avgPrice: number;
}

export interface Trade {
  ts: string;
  action: Action;
  ticker: string;
  qty: number;
  price: number;
  usd: number;
  reasoning: string;
}

export interface AgentState {
  id: string;
  cash: number;
  positions: Record<string, Position>;
  trades: Trade[];
  equityCurve: { ts: string; value: number }[];
  lastCommentary: string;
}

export interface Fill {
  ticker: string;
  action: Action;
  qty: number;
  price: number;
  usd: number;
}

export interface WireTicker {
  ticker: string;
  signal: number;
  newsTone: number | null;
  analyst: number | null;
  headline: string | null;
  sources: string[];
}

export interface WireReport {
  macro: {
    policyNote: string | null;
    tariffPressure: number | null;
    cryptoFearGreed: number | null;
    rates: string | null;
    asOf: string;
  };
  tickers: WireTicker[];
}

export interface MarketView {
  quotes: Quote[];
  mc: McStats[];
  crowd: CrowdReport | null;
  wire: WireReport | null;
}
