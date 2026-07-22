import type { McStats } from "../types.js";

/**
 * "A thousand walks": GBM style Monte Carlo per ticker.
 * Estimates mu/sigma from recent daily log returns, projects `paths`
 * trajectories over the horizon and summarizes the return distribution.
 */
export function monteCarlo(
  ticker: string,
  closes: number[],
  opts: { horizonDays?: number; paths?: number } = {},
): McStats | null {
  const horizonDays = opts.horizonDays ?? 5;
  const paths = opts.paths ?? 1000;
  if (closes.length < 40) return null;

  const logs: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    logs.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mu = logs.reduce((a, b) => a + b, 0) / logs.length;
  const variance =
    logs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, logs.length - 1);
  const sigma = Math.sqrt(variance);

  const drift = mu - (sigma * sigma) / 2;
  const finals: number[] = new Array(paths);
  for (let p = 0; p < paths; p++) {
    let logSum = 0;
    for (let d = 0; d < horizonDays; d++) {
      logSum += drift + sigma * gaussian();
    }
    finals[p] = Math.exp(logSum) - 1; // return over the horizon
  }
  finals.sort((a, b) => a - b);

  const mean = finals.reduce((a, b) => a + b, 0) / paths;
  const pUp = finals.filter((r) => r > 0).length / paths;
  const mom30 =
    closes.length > 30 ? closes[closes.length - 1] / closes[closes.length - 31] - 1 : 0;

  return {
    ticker,
    horizonDays,
    paths,
    expectedReturn: round(mean),
    pUp: round(pUp),
    p5: round(finals[Math.floor(paths * 0.05)]),
    p95: round(finals[Math.floor(paths * 0.95)]),
    sigmaDaily: round(sigma),
    mom30d: round(mom30),
  };
}

function gaussian(): number {
  // Box-Muller
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function round(x: number): number {
  return Math.round(x * 10000) / 10000;
}
