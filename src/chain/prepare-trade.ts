import { createPublicClient, http, parseUnits, formatUnits } from "viem";
import { chainConfig, assertChainReady } from "./config.js";
import { loadVault } from "./wallets.js";
import { execPolicy } from "../config/execution.js";
import { quote, price, getChains, classifyError, RH_CHAIN_ID } from "./zerox.js";

/**
 * Prepare a real trade for a pirate: check the token is tradeable, fetch a firm
 * 0x quote, apply the money caps, and produce the READY-TO-SEND transaction.
 *
 * It STOPS before signing/broadcasting. The prepared transaction (to/data/value)
 * is what a human developer signs and sends, see docs/EXECUTE.md. This file
 * touches no private key and moves no money.
 *
 *   npm run zerox:check                          # verify 0x serves chain 4663
 *   npm run trade:prepare -- ledger buy NVDA 10  # prepare a $10 USDG->NVDA buy
 *
 * Needs ZEROEX_API_KEY (free, no KYC, dashboard.0x.org) and the verified chain
 * params in .env.local.
 */

const ERC20 = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "paused", stateMutability: "view", inputs: [], outputs: [{ type: "bool" }] },
] as const;

export interface PreparedTrade {
  pirateId: string;
  taker: `0x${string}`;
  action: "buy" | "sell";
  ticker: string;
  sellToken: `0x${string}`;
  buyToken: `0x${string}`;
  sellAmount: string;
  minBuyAmount: string;
  needsApprove: { token: `0x${string}`; spender: string } | null;
  transaction: { to: string; data: string; value: string; gas: string | null };
  note: string;
}

/** Build a ready-to-send trade, or a reason it was skipped. Never signs/sends. */
export async function prepareTrade(
  pirateId: string,
  action: "buy" | "sell",
  ticker: string,
  usd: number,
): Promise<{ prepared: PreparedTrade | null; skip: string | null }> {
  const cfg = chainConfig();
  const problems = assertChainReady(cfg);
  if (problems.length) return { prepared: null, skip: `chain not ready: ${problems.join("; ")}` };

  const stock = cfg.tokens[ticker];
  if (!stock) return { prepared: null, skip: `no verified token address for ${ticker}` };

  const addr = loadVault()[pirateId]?.address;
  if (!addr) return { prepared: null, skip: `no wallet for ${pirateId}` };

  const policy = execPolicy();
  if (usd > policy.maxOrderUsd) usd = policy.maxOrderUsd; // clamp to the real-money per-order cap

  const client = createPublicClient({ transport: http(cfg.rpcUrl) });

  // stock token must not be paused (swaps revert while paused/oracle-paused)
  try {
    const paused = (await client.readContract({ address: stock, abi: ERC20, functionName: "paused" })) as boolean;
    if (paused) return { prepared: null, skip: `${ticker} is paused on-chain, skipping` };
  } catch {
    // some tokens may not expose paused(); continue, 0x will fail loudly if untradeable
  }

  // buy stock = sell USDG; sell stock = sell the stock for USDG
  const sellToken = action === "buy" ? cfg.stable : stock;
  const buyToken = action === "buy" ? stock : cfg.stable;
  const sellDecimals = action === "buy" ? 6 : 18;
  const sellAmount = action === "buy"
    ? parseUnits(usd.toFixed(6), 6).toString()
    : // for a sell, usd is a rough target; convert via a price call to a token amount
      await sellStockAmount(addr, stock, usd, client, cfg.stable);

  if (!sellAmount || sellAmount === "0") return { prepared: null, skip: "computed sell amount is zero" };

  try {
    const q = await quote({ sellToken, buyToken, sellAmount, taker: addr, slippageBps: Math.round(policy.maxSlippage * 10000) });
    if (!q.liquidityAvailable || !q.transaction) return { prepared: null, skip: "no liquidity for this route right now" };
    if (q.balanceIssue) return { prepared: null, skip: `insufficient balance: ${JSON.stringify(q.balanceIssue)}` };
    return {
      prepared: {
        pirateId,
        taker: addr,
        action,
        ticker,
        sellToken,
        buyToken,
        sellAmount,
        minBuyAmount: q.minBuyAmount,
        needsApprove: q.needsAllowance ? { token: sellToken, spender: q.needsAllowance.spender as `0x${string}` } : null,
        transaction: { to: q.transaction.to, data: q.transaction.data, value: q.transaction.value, gas: q.transaction.gas },
        note: `sell ${formatUnits(BigInt(sellAmount), sellDecimals)} ${action === "buy" ? "USDG" : ticker} -> min ${formatUnits(BigInt(q.minBuyAmount), action === "buy" ? 18 : 6)} ${action === "buy" ? ticker : "USDG"}`,
      },
      skip: null,
    };
  } catch (e) {
    return { prepared: null, skip: classifyError(e) };
  }
}

/** For a sell, size the stock amount to roughly `usd` using an indicative price. */
async function sellStockAmount(
  taker: string,
  stock: `0x${string}`,
  usd: number,
  client: ReturnType<typeof createPublicClient>,
  stable: `0x${string}`,
): Promise<string> {
  const held = (await client.readContract({ address: stock, abi: ERC20, functionName: "balanceOf", args: [taker as `0x${string}`] })) as bigint;
  if (held === 0n) return "0";
  // 1-share indicative price via 0x (sell 1e18 stock -> USDG out)
  try {
    const p = await price({ sellToken: stock, buyToken: stable, sellAmount: parseUnits("1", 18).toString(), taker });
    const usdgOutPerShare = Number(formatUnits(BigInt(p.buyAmount ?? "0"), 6));
    if (usdgOutPerShare <= 0) return held.toString();
    const shares = Math.min(usd / usdgOutPerShare, Number(formatUnits(held, 18)));
    return parseUnits(shares.toFixed(18), 18).toString();
  } catch {
    return held.toString();
  }
}

// ── CLI ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
if (args[0] === "check") {
  getChains()
    .then((r) => {
      console.log(`0x serves chain ${RH_CHAIN_ID}: ${r.supported ? "YES" : "NO"}`);
      if (!r.supported) console.log("chains:", r.chains.map((c: any) => c.chainId).join(", "));
    })
    .catch((e) => { console.error(classifyError(e)); process.exit(1); });
} else if (args.length >= 4) {
  const [pirate, action, ticker, usd] = args;
  prepareTrade(pirate, action as "buy" | "sell", ticker.toUpperCase(), Number(usd))
    .then(({ prepared, skip }) => {
      if (skip) { console.log("SKIP:", skip); return; }
      console.log("\nPREPARED TRADE (ready for a human to sign+send, see docs/EXECUTE.md):\n");
      console.log(JSON.stringify(prepared, null, 2));
      console.log("\nThis script did NOT sign or send. The transaction above is what the next dev broadcasts.\n");
    })
    .catch((e) => { console.error(classifyError(e)); process.exit(1); });
}
