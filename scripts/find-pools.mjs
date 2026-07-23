import fs from "node:fs";
import { createPublicClient, http, parseAbiItem } from "viem";

// Alchemy RPC (no rate limit) from .env.local
const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf-8");
const RPC = env.match(/^CHAIN_RPC_URL=(.+)$/m)[1].trim();
const client = createPublicClient({ transport: http(RPC) });

const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const TOKENS = {
  NVDA: "0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC",
  AAPL: "0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9",
  MSFT: "0xe93237C50D904957Cf27E7B1133b510C669c2e74",
  TSLA: "0x322F0929c4625eD5bAd873c95208D54E1c003b2d",
};
const POOL_MANAGERS = [
  "0x8c490d4b0E0889238A3CB5Afc85A6f4a97171d95",
  "0xE72bC44161aD5AFF6fb0353d3b5549c2Be34B0dF",
  "0x7e12E80C0332Be7E40ccB7904301Bf1393cbe42c",
];

// Uniswap v4 Initialize event: currencies are indexed
const initEvent = parseAbiItem(
  "event Initialize(bytes32 indexed id, address indexed currency0, address indexed currency1, uint24 fee, int24 tickSpacing, address hooks, uint160 sqrtPriceX96, int24 tick)"
);

const latest = await client.getBlockNumber();
console.log("latest block:", latest.toString());

const stockSet = new Set(Object.values(TOKENS).map((a) => a.toLowerCase()));
const usdgL = USDG.toLowerCase();
const found = [];

async function scan(pm) {
  // chunk the range to respect any getLogs range cap
  const CHUNK = 100000n;
  for (let from = 0n; from <= latest; from += CHUNK) {
    const to = from + CHUNK - 1n > latest ? latest : from + CHUNK - 1n;
    let logs;
    try {
      logs = await client.getLogs({ address: pm, event: initEvent, fromBlock: from, toBlock: to });
    } catch (e) {
      // range too big for this provider window; halve and retry once
      try {
        const mid = from + (to - from) / 2n;
        const a = await client.getLogs({ address: pm, event: initEvent, fromBlock: from, toBlock: mid });
        const b = await client.getLogs({ address: pm, event: initEvent, fromBlock: mid + 1n, toBlock: to });
        logs = [...a, ...b];
      } catch (e2) {
        continue;
      }
    }
    for (const lg of logs) {
      const c0 = lg.args.currency0.toLowerCase();
      const c1 = lg.args.currency1.toLowerCase();
      if ((c0 === usdgL && stockSet.has(c1)) || (c1 === usdgL && stockSet.has(c0))) {
        const stockAddr = c0 === usdgL ? c1 : c0;
        const ticker = Object.entries(TOKENS).find(([, a]) => a.toLowerCase() === stockAddr)?.[0];
        found.push({
          poolManager: pm,
          ticker,
          poolId: lg.args.id,
          currency0: lg.args.currency0,
          currency1: lg.args.currency1,
          fee: lg.args.fee,
          tickSpacing: lg.args.tickSpacing,
          hooks: lg.args.hooks,
        });
      }
    }
  }
}

for (const pm of POOL_MANAGERS) {
  process.stdout.write(`scanning PoolManager ${pm} ... `);
  try {
    await scan(pm);
    console.log("done");
  } catch (e) {
    console.log("err", String(e).slice(0, 80));
  }
}

console.log("\n=== USDG/stock V4 pools found ===");
for (const p of found) {
  console.log(`${p.ticker}: fee=${p.fee} tickSpacing=${p.tickSpacing} hooks=${p.hooks}`);
  console.log(`   poolManager=${p.poolManager}`);
  console.log(`   currency0=${p.currency0} currency1=${p.currency1}`);
  console.log(`   poolId=${p.poolId}`);
}
if (!found.length) console.log("(none found)");
fs.writeFileSync(new URL("../state/v4-pools.json", import.meta.url), JSON.stringify(found, (k, v) => typeof v === "bigint" ? v.toString() : v, 2));
