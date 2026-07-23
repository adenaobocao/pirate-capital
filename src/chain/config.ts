/**
 * Chain configuration for real (onchain) execution on Robinhood Chain.
 *
 * Every fund-critical value is read from env and defaults to a placeholder that
 * FAILS the preflight. Nothing spends real money until these are set to real,
 * verified values and CHAIN_PARAMS_VERIFIED=true is explicitly exported. This
 * is deliberate: a wrong router or token address loses money silently.
 *
 * Fill these from the research in docs/CHAIN.md once addresses are confirmed
 * against the official Robinhood Chain docs and the block explorer.
 */

const PLACEHOLDER = "0xUNVERIFIED";

export interface ChainConfig {
  rpcUrl: string;
  chainId: number;
  explorer: string;
  /** the AMM router used for swaps */
  router: `0x${string}`;
  /** the stablecoin the pirates hold and quote in */
  stable: `0x${string}`;
  /** ticker -> onchain stock-token address */
  tokens: Record<string, `0x${string}`>;
  verified: boolean;
}

function addr(env: string | undefined): `0x${string}` {
  return (env && /^0x[0-9a-fA-F]{40}$/.test(env) ? env : PLACEHOLDER) as `0x${string}`;
}

export function chainConfig(): ChainConfig {
  const tokens: Record<string, `0x${string}`> = {};
  for (const t of ["NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "META", "GOOGL", "AMD", "HOOD", "COIN", "PLTR", "MSTR"]) {
    tokens[t] = addr(process.env[`TOKEN_${t}`]);
  }
  return {
    rpcUrl: process.env.CHAIN_RPC_URL ?? "",
    chainId: Number(process.env.CHAIN_ID ?? 0),
    explorer: process.env.CHAIN_EXPLORER ?? "",
    router: addr(process.env.CHAIN_ROUTER),
    stable: addr(process.env.CHAIN_STABLE),
    tokens,
    verified: process.env.CHAIN_PARAMS_VERIFIED === "true",
  };
}

/** Refuses to proceed unless every fund-critical param is real and verified. */
export function assertChainReady(cfg: ChainConfig): string[] {
  const problems: string[] = [];
  if (!cfg.verified) problems.push("CHAIN_PARAMS_VERIFIED is not 'true' (params not confirmed against official docs)");
  if (!cfg.rpcUrl) problems.push("CHAIN_RPC_URL unset");
  if (!cfg.chainId) problems.push("CHAIN_ID unset");
  if (cfg.router === PLACEHOLDER) problems.push("CHAIN_ROUTER unset or malformed");
  if (cfg.stable === PLACEHOLDER) problems.push("CHAIN_STABLE unset or malformed");
  const missingTokens = Object.entries(cfg.tokens).filter(([, a]) => a === PLACEHOLDER).map(([t]) => t);
  if (missingTokens.length) problems.push(`token addresses unset: ${missingTokens.join(", ")}`);
  return problems;
}
