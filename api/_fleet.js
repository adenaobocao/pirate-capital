import crypto from "node:crypto";
import { put } from "@vercel/blob";

/**
 * Shared machinery for the fleet (lookout mode): blob io, moderation,
 * the articles (guardrails), the paper executor, market data and monte carlo.
 * Underscore prefix keeps this file from becoming an endpoint.
 *
 * Trust model: the owner's browser thinks (BYOK) and submits ORDERS only.
 * Everything that guards money runs here, on server clocks and server prices.
 */

export const UNIVERSE = [
  "NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "META",
  "GOOGL", "AMD", "HOOD", "COIN", "PLTR", "MSTR",
];

export const RISK_PRESETS = {
  cautious: { maxPositionPct: 0.25, maxOrdersPerTick: 2, maxBuyPctOfCash: 0.4 },
  classic: { maxPositionPct: 0.35, maxOrdersPerTick: 2, maxBuyPctOfCash: 0.5 },
  degen: { maxPositionPct: 0.45, maxOrdersPerTick: 3, maxBuyPctOfCash: 0.6 },
};

export const STARTING_CASH = 1000;
export const FRICTION = 0.0015;
export const TICK_COOLDOWN_MS = 55 * 60 * 1000;
export const MAX_PIRATES = 500;
const RESERVED = new Set(["flint", "cannon", "crow", "ledger", "coco", "admin", "captain", "pons", "pirate"]);

/* ── blob io ─────────────────────────────────────────── */

function storeBase() {
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? "";
  const match = token.match(/^vercel_blob_rw_([A-Za-z0-9]+)_/);
  if (!match) throw new Error("blob token missing");
  return `https://${match[1]}.public.blob.vercel-storage.com`;
}

export async function readJson(pathname) {
  try {
    const res = await fetch(`${storeBase()}/${pathname}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function writeJson(pathname, data) {
  await put(pathname, JSON.stringify(data), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

/* ── identity ────────────────────────────────────────── */

export function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function newId(name) {
  return `${name}-${crypto.randomBytes(3).toString("hex")}`;
}

/* ── moderation (names and philosophies render publicly) ── */

export function moderateName(raw) {
  const name = String(raw ?? "").toLowerCase().trim();
  if (!/^[a-z0-9_]{3,24}$/.test(name)) {
    return { ok: false, error: "name must be 3 to 24 chars: a-z, 0-9, underscore" };
  }
  if (RESERVED.has(name)) return { ok: false, error: "that name belongs to the ship" };
  return { ok: true, value: name };
}

export function moderatePhilosophy(raw) {
  let text = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (/https?:\/\/|www\./i.test(text)) return { ok: false, error: "no links in a philosophy" };
  if (text.length < 20) return { ok: false, error: "philosophy too short, give your pirate a soul (20+ chars)" };
  if (text.length > 280) text = text.slice(0, 280);
  return { ok: true, value: text };
}

/* ── market data ─────────────────────────────────────── */

export async function fetchQuote(ticker, range = "5d") {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d`;
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
    return {
      ticker,
      price: Math.round(price * 100) / 100,
      changePct1d: prev > 0 ? price / prev - 1 : null,
      closes,
    };
  } catch {
    return null;
  }
}

export function monteCarlo(ticker, closes, horizonDays = 5, paths = 1000) {
  if (!closes || closes.length < 40) return null;
  const logs = [];
  for (let i = 1; i < closes.length; i++) logs.push(Math.log(closes[i] / closes[i - 1]));
  const mu = logs.reduce((a, b) => a + b, 0) / logs.length;
  const variance = logs.reduce((a, b) => a + (b - mu) ** 2, 0) / Math.max(1, logs.length - 1);
  const sigma = Math.sqrt(variance);
  const drift = mu - (sigma * sigma) / 2;
  const finals = new Array(paths);
  for (let p = 0; p < paths; p++) {
    let sum = 0;
    for (let d = 0; d < horizonDays; d++) {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      sum += drift + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    finals[p] = Math.exp(sum) - 1;
  }
  finals.sort((a, b) => a - b);
  const round = (x) => Math.round(x * 10000) / 10000;
  const mom30 = closes.length > 30 ? closes[closes.length - 1] / closes[closes.length - 31] - 1 : 0;
  return {
    ticker,
    horizonDays,
    paths,
    expectedReturn: round(finals.reduce((a, b) => a + b, 0) / paths),
    pUp: round(finals.filter((r) => r > 0).length / paths),
    p5: round(finals[Math.floor(paths * 0.05)]),
    p95: round(finals[Math.floor(paths * 0.95)]),
    sigmaDaily: round(sigma),
    mom30d: round(mom30),
  };
}

/* ── the articles + executor (server side, never trust the client) ── */

export function applyGuardrails(risk, orders, cash, equity, quotes, positions) {
  const valid = [];
  let remainingCash = cash;
  const heldValue = {};
  for (const [ticker, pos] of Object.entries(positions)) {
    const q = quotes.find((x) => x.ticker === ticker);
    heldValue[ticker] = pos.qty * (q ? q.price : pos.avgPrice);
  }
  for (const order of orders) {
    if (valid.length >= risk.maxOrdersPerTick) break;
    if (order.action === "hold") continue;
    const quote = quotes.find((q) => q.ticker === order.ticker);
    if (!quote) continue;
    if (!Number.isFinite(order.usd) || order.usd <= 0) continue;

    if (order.action === "buy") {
      const current = heldValue[order.ticker] ?? 0;
      const cap = Math.min(
        remainingCash * risk.maxBuyPctOfCash,
        Math.max(0, equity * risk.maxPositionPct - current),
        remainingCash,
      );
      const usd = Math.min(order.usd, cap);
      if (usd < 5) continue;
      remainingCash -= usd;
      heldValue[order.ticker] = current + usd;
      valid.push({ ...order, usd });
    } else if (order.action === "sell") {
      valid.push(order);
    }
  }
  return valid;
}

export function executePaper(state, order, price) {
  if (order.action === "hold" || price <= 0) return null;
  if (order.action === "buy") {
    const fillPrice = price * (1 + FRICTION);
    const usd = Math.min(order.usd, state.cash);
    if (usd < 1) return null;
    const qty = usd / fillPrice;
    const pos = state.positions[order.ticker];
    if (pos) {
      pos.avgPrice = (pos.avgPrice * pos.qty + fillPrice * qty) / (pos.qty + qty);
      pos.qty += qty;
    } else {
      state.positions[order.ticker] = { qty, avgPrice: fillPrice };
    }
    state.cash -= usd;
    return { ticker: order.ticker, action: "buy", qty, price: fillPrice, usd };
  }
  const pos = state.positions[order.ticker];
  if (!pos || pos.qty <= 0) return null;
  const fillPrice = price * (1 - FRICTION);
  const maxUsd = pos.qty * fillPrice;
  const usd = Math.min(order.usd, maxUsd);
  if (usd < 1) return null;
  const qty = usd / fillPrice;
  pos.qty -= qty;
  if (pos.qty * fillPrice < 0.5) {
    state.cash += pos.qty * fillPrice;
    delete state.positions[order.ticker];
  }
  state.cash += usd;
  return { ticker: order.ticker, action: "sell", qty, price: fillPrice, usd };
}

export function computeEquity(state, quotes) {
  let equity = state.cash;
  for (const [ticker, pos] of Object.entries(state.positions)) {
    const q = quotes.find((x) => x.ticker === ticker);
    equity += pos.qty * (q ? q.price : pos.avgPrice);
  }
  return Math.round(equity * 100) / 100;
}
