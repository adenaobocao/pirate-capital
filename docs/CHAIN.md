# Chain parameters (real execution)

## Path decision (from research, 2026-07-22)

Two execution paths exist and they serve MUTUALLY EXCLUSIVE jurisdictions:

- **Path A, Robinhood Agentic Trading MCP** (agent.robinhood.com/mcp/trading):
  US persons only, traditional US equities, one agentic account per login, no
  sandbox, market hours only. Does NOT trade Robinhood Chain Stock Tokens.
- **Path B, onchain Stock Tokens**: the tokenized stocks are "not available in
  the US or to US persons" and restricted in CA, UK, CH, UAE and sanctioned
  places; available in 120+ other countries. This is the wallets path.

The owner is a non-US person (Brazil). Brazil is not on the restricted list.
=> **Path B (onchain) is our path.** The per-pirate wallets are correct. The MCP
is unavailable to us and is not pursued. Final jurisdiction call sits with the
owner's lawyer; the tooling reality is fixed.

Source: https://robinhood.com/us/en/newsroom/robinhood-accelerates-global-expansion-robinhood-chain-mainnet-stock-tokens-agentic-trading/

## CRITICAL open question (blocks funding)

Are the tokenized stocks freely swappable by an arbitrary wallet, or
permissioned / KYC-gated at the contract level? If permissioned, our fresh
wallets may be unable to hold or swap them and the plan changes. Resolve this
against the explorer BEFORE funding. The chain-params-hunt research run is
resolving this plus the addresses below.

---


Fill this from verified sources ONLY. Every value here can move real money if
wrong. Confirm each against the official Robinhood Chain docs AND the block
explorer before setting CHAIN_PARAMS_VERIFIED=true.

Until this is filled and verified, the onchain executor fails closed and every
canary/live tick aborts at preflight. That is intended.

## How to fill it

1. Get each value from an official source (Robinhood Chain docs, the explorer).
2. Put them in `.env.local` (never `.env`, never committed):

```
CHAIN_RPC_URL=
CHAIN_ID=
CHAIN_EXPLORER=
CHAIN_ROUTER=          # the AMM router/swap contract
CHAIN_STABLE=          # the stablecoin the pirates quote in (USDC/USDG)
TOKEN_NVDA=
TOKEN_AAPL=
TOKEN_MSFT=
TOKEN_TSLA=
TOKEN_AMZN=
TOKEN_META=
TOKEN_GOOGL=
TOKEN_AMD=
TOKEN_HOOD=
TOKEN_COIN=
TOKEN_PLTR=
TOKEN_MSTR=
CHAIN_PARAMS_VERIFIED=true   # set ONLY after you personally verified every address
```

3. Verify with the explorer that each TOKEN_ address is the real tokenized stock
   and that the router is the canonical AMM router. A single wrong address is a
   silent loss.

## Researched values (HIGH confidence, explorer-verified by research; you confirm before CHAIN_PARAMS_VERIFIED=true)

Source: docs.robinhood.com/chain/* + robinhoodchain.blockscout.com (2026-07-22 research run).

| Param | Value | Note |
|---|---|---|
| Chain ID | 4663 | chainlist + explorer |
| RPC (public) | https://rpc.mainnet.chain.robinhood.com | official, rate-limited |
| RPC (recommended) | your Alchemy: https://robinhood-mainnet.g.alchemy.com/v2/KEY | higher throughput for the bot |
| Explorer | https://robinhoodchain.blockscout.com | Blockscout |
| Native gas | ETH | WETH 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73 |
| AMM | Uniswap (UniversalRouter) | router 0x8876789976decbfcbbbe364623c63652db8c0904 |
| Stablecoin | USDG (Paxos), 6 dec | 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168 — impostors exist, pin exact addr |

Stock tokens (18 dec). Explorer-verified: **TSLA** 0x322F0929c4625eD5bAd873c95208D54E1c003b2d, **NVDA** 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC, **AAPL** 0xaF3D76f1834A1d425780943C99Ea8A608f8a93f9, **MSFT** 0xe93237C50D904957Cf27E7B1133b510C669c2e74. Unverified third-party list (CONFIRM before use): AMZN 0x12f190a9F9d7D37a250758b26824B97CE941bF54, GOOGL 0x2e0847E8910a9732eB3fb1bb4b70a580ADAD4FE3, META 0xc0D6457C16Cc70d6790Dd43521C899C87ce02f35, COIN 0x6330D8C3178a418788dF01a47479c0ce7CCF450b. Not found onchain: AMD, HOOD, PLTR, MSTR.

## Trading rules the executor MUST respect (from reading the verified Stock contract)

- Stock tokens are FREELY swappable by any wallet (blocklist model, not a KYC
  allowlist). Our fresh wallets can hold and swap them. Good.
- BUT: each token can be `pause()`d and has an oracle-pause. When paused,
  transfers/swaps REVERT (`IsPaused`). The executor must check `paused()` /
  `oraclePaused()` before every swap and skip if paused.
- Balances are 18-dec raw via `balanceOf` (NOT `balanceOfUI`, which is
  split-adjusted). USDG is 6-dec. Get decimals per token, never assume.
- Admin can blocklist an address or `adminBurn` (clawback). Low probability for
  a clean wallet, but the log should surface a blocklist/burn if it ever happens.
- US-person restriction is enforced OFF-CHAIN at the wallet-app layer, not by the
  contract. The owner (non-US) is fine; keep the lawyer memo on file.

## Start-small universe

Begin real trading with the 4 explorer-verified names only: NVDA, AAPL, MSFT, TSLA.
Add others only after you personally verify each address on the explorer.

## Open question that changes everything (from research)

Are the tokenized stocks freely transferable and swappable by an arbitrary
wallet, or permissioned / KYC-gated at the contract level? If permissioned, the
pure onchain path (B) may not work for our wallets and the official Agentic
Trading MCP path (A) becomes the route. Resolve this before funding.
See docs/research findings appended by the research run.
