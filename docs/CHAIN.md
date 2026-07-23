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

## On-chain verification (done live via the Alchemy RPC, read-only, 2026-07-22)

Confirmed directly against the chain, not trusted from research:
- Router 0x8876789976decbfcbbbe364623c63652db8c0904 exists (49 KB bytecode),
  verified on Blockscout as **UniversalRouter**.
- USDG 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168: decimals 6, symbol USDG.
- NVDA 0xd0601CE157Db5bdC3162BbaC2a2C8aF5320D9EEC: decimals 18, symbol NVDA,
  paused() == false.

## The router is a MODIFIED UniversalRouter fork (matters for the swap code)

Verified ABI exposes:
- `execute(bytes commands, bytes[] inputs)` — standard
- `execute(bytes commands, bytes[] inputs, uint256 deadline)` — standard
- `executeSigned(bytes commands, bytes[] inputs, bytes32 intent, bytes32 data,
   bool verifySender, bytes32 nonce, bytes signature, uint256 deadline)` — Robinhood
   addition (signed-intent flow, likely for the minHopPriceX36 signed-price path)

Conclusion: a standard Uniswap v3 swap via `execute()` with a V3_SWAP_EXACT_IN
command is available and is the path to build. The signed variant is not required
for a basic swap. UniversalRouter pulls tokens via Permit2, so the flow is:
approve USDG to Permit2 -> Permit2 approve to UniversalRouter -> execute() the swap,
with an on-chain quote (QuoterV2) and a minOut from maxSlippage, and a paused()
check on the target token before every trade.

## Swap venue pinned (verified by activity, 2026-07-22)

The explorer has multiple contracts sharing each name (impostors, like USDG).
Pinned the canonical ones by real activity / known constants:
- **SwapRouter02** = 0xB2d8eD81e79eb64A0751352459eC215FbAFad669 (40 txns, 62 transfers;
  the other 3 "SwapRouter02" have zero activity). Use exactInputSingle with a
  direct ERC-20 approve (no Permit2 needed for SwapRouter02).
- **Permit2** (canonical, universal) = 0x000000000022D473030F116dDEE9F6B43aC78BA3 (present, 18KB).
- QuoterV2: 4 candidates all show 0 txns, but a quoter is a view contract called
  via eth_call (0 txns is expected), so activity does not disambiguate it. Pick it
  by matching Uniswap's official deployment or by test-quoting against a known pool.
- Ledger canary funded: 0.0258 ETH (~$50) confirmed on-chain.

Swap path to build (SwapRouter02, simplest safe route):
1. check target token paused()==false
2. amountOutMinimum from a reference price (yahoo) x (1 - maxSlippage)
3. approve(SwapRouter02, amountIn) on the input token
4. exactInputSingle({tokenIn, tokenOut, fee, recipient, amountIn, amountOutMinimum, sqrtPriceLimitX96:0})
   ETH->USDG uses tokenIn=WETH with msg.value (SwapRouter02 wraps).
Confirm the WETH/USDG and USDG/<stock> pool fee tiers (500/3000/10000) exist before use.

## Canary funding (agreed 2026-07-22)

Canary pirate: **Ledger** = 0xa475646915E776CACEAE253a52674d352c773fc6.
Fund with a SMALL test first: ~$15 USDG (trading capital) + ~$2-3 ETH (gas). Prove
the full swap path with the tiny amount before scaling to $100/pirate across the crew.

## Open question that changes everything (from research)

Are the tokenized stocks freely transferable and swappable by an arbitrary
wallet, or permissioned / KYC-gated at the contract level? If permissioned, the
pure onchain path (B) may not work for our wallets and the official Agentic
Trading MCP path (A) becomes the route. Resolve this before funding.
See docs/research findings appended by the research run.
