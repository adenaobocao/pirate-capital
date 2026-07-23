/**
 * 0x Swap API v2 client for Robinhood Chain (chainId 4663).
 *
 * This module ONLY talks to the 0x API (read-only HTTP) and returns the
 * ready-to-send transaction that 0x builds. It NEVER signs or broadcasts.
 * The sign+send last mile is authored by a human developer, see docs/EXECUTE.md.
 *
 * 0x officially powers Robinhood Chain: the allowance-holder/quote endpoint
 * returns transaction {to, data, value} that an EOA signs and sends after a
 * one-time ERC20 approve of allowanceTarget on the sell token. 0x abstracts the
 * UniswapX RFQ / cosigner signature entirely, so the returned calldata already
 * contains the signed price.
 *
 * Get a FREE key (no KYC) at https://dashboard.0x.org and set ZEROEX_API_KEY.
 */

const BASE = "https://api.0x.org";
export const RH_CHAIN_ID = 4663;

function headers() {
  const key = process.env.ZEROEX_API_KEY;
  if (!key) throw new Error("ZEROEX_API_KEY unset (get a free key at dashboard.0x.org, no KYC)");
  return { "0x-api-key": key, "0x-version": "v2" };
}

async function get(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: headers(),
    signal: AbortSignal.timeout(12000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`0x ${res.status} ${body?.name ?? ""} ${body?.message ?? ""} (zid ${body?.zid ?? "?"})`);
    (err as any).status = res.status;
    (err as any).body = body;
    throw err;
  }
  return body;
}

/** Verify chain 4663 is served. Call once before wiring anything. */
export async function getChains(): Promise<{ supported: boolean; chains: any[] }> {
  const j = await get("/swap/chains", {});
  const chains = j?.chains ?? [];
  return { supported: chains.some((c: any) => Number(c.chainId) === RH_CHAIN_ID), chains };
}

export interface QuoteParams {
  sellToken: string;
  buyToken: string;
  /** base units (USDG 6-dec, stocks 18-dec) */
  sellAmount: string;
  taker: string;
  slippageBps?: number;
}

export interface PreparedQuote {
  liquidityAvailable: boolean;
  buyAmount: string;
  sellAmount: string;
  minBuyAmount: string;
  allowanceTarget: string | null;
  needsAllowance: { spender: string; actual: string } | null;
  balanceIssue: any | null;
  /** the transaction 0x built; a human signs+sends this (see EXECUTE.md) */
  transaction: { to: string; data: string; value: string; gas: string | null; gasPrice: string | null } | null;
  totalNetworkFee: string | null;
  zid: string | null;
  raw: any;
}

/** Indicative price only (no commitment) - for polling / sizing / pnl. */
export async function price(p: QuoteParams): Promise<any> {
  return get("/swap/allowance-holder/price", {
    chainId: String(RH_CHAIN_ID),
    sellToken: p.sellToken,
    buyToken: p.buyToken,
    sellAmount: p.sellAmount,
    taker: p.taker,
    slippageBps: String(p.slippageBps ?? 100),
  });
}

/** Firm quote: a soft commitment to the RFQ MM. Call only to execute, then
 *  sign+send promptly (quotes are short-lived, tied to blockNumber). */
export async function quote(p: QuoteParams): Promise<PreparedQuote> {
  const j = await get("/swap/allowance-holder/quote", {
    chainId: String(RH_CHAIN_ID),
    sellToken: p.sellToken,
    buyToken: p.buyToken,
    sellAmount: p.sellAmount,
    taker: p.taker,
    slippageBps: String(p.slippageBps ?? 100),
  });
  const tx = j.transaction ?? null;
  return {
    liquidityAvailable: Boolean(j.liquidityAvailable),
    buyAmount: j.buyAmount,
    sellAmount: j.sellAmount,
    minBuyAmount: j.minBuyAmount,
    allowanceTarget: j.allowanceTarget ?? null,
    needsAllowance: j.issues?.allowance ?? null,
    balanceIssue: j.issues?.balance ?? null,
    transaction: tx
      ? { to: tx.to, data: tx.data, value: tx.value ?? "0", gas: tx.gas ?? null, gasPrice: tx.gasPrice ?? null }
      : null,
    totalNetworkFee: j.totalNetworkFee ?? null,
    zid: j.zid ?? null,
    raw: j,
  };
}

/** Human-readable classification of a 0x error (esp. the geo/stock gates). */
export function classifyError(err: any): string {
  const name = err?.body?.name ?? "";
  if (/XSTOCKS_NOT_AUTHORIZED|TAKER_NOT_AUTHORIZED_FOR_TRADE|USER_NOT_AUTHORIZED/.test(name)) {
    return "GEO/ELIGIBILITY: stock tokens are not permitted for this wallet/jurisdiction. Stop this agent's stock trading (do not retry).";
  }
  if (/BUY_TOKEN_NOT_AUTHORIZED_FOR_TRADE|SELL_TOKEN_NOT_AUTHORIZED_FOR_TRADE/.test(name)) {
    return "TOKEN not authorized for trade on this route.";
  }
  if (/TOKEN_NOT_SUPPORTED|INPUT_INVALID/.test(name)) return "bad token/params.";
  return String(err?.message ?? err);
}
