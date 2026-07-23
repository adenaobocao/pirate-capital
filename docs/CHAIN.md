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

## RESOLVED: stock swaps ARE doable by code, via an aggregator RFQ API

The "blocker" below is real but NOT a wall. Research (well-sourced) resolved it:

- The settlement contract 0x000000007A1C8e570011EeDF86A2A35593013cBA is a
  **UniswapX V3DutchOrderReactor**. Stock tokens trade via **RFQ / intent
  (UniswapX-style)**, not a spot AMM. That is why the plain router failed.
- The 65-byte signature is a **cosigner signature** on a Dutch/RFQ order. You do
  NOT compute it; you REQUEST it from a quote/auction API, exactly like the UI.
- **Robinhood Chain docs explicitly invite agents:** "Developers and agents can
  integrate instantly with standard EVM tooling" and "RFQ uses signed
  market-maker quotes sourced through aggregators such as **0x RFQ, 1inch Fusion,
  and LiFi**." (docs.robinhood.com/chain/building-with-stock-tokens/)
- **1inch is confirmed live on Robinhood Chain** (business.1inch.com/chains/robinhood):
  Business Swap API + gasless swap.

### The real executor path (this is what to build)

Bot flow per stock trade:
1. GET a quote from an aggregator RFQ API live on RH Chain (1inch or 0x), passing
   sellToken=USDG, buyToken=<stock>, amount, taker=pirate wallet, chainId 4663.
2. The API returns an EXECUTABLE quote: ready calldata (or a SignedOrder with the
   cosigned price = the 65-byte sig) plus the target (the reactor / settler).
3. The bot EIP-712 / Permit2-signs its side, then broadcasts (or submits to the
   filler network). Same pattern as GMGN (Solana): get route -> sign -> submit.

Caveats (from research, verify when building):
- Needs an aggregator API key (1inch/0x/Uniswap Trading API) - keyed, not anonymous,
  but self-serve/obtainable. Not the Robinhood Agentic MCP (that is US-only custodial equities).
- Exact quote host not byte-confirmed; test one real quote before wiring.
- Crypto legs (ETH<->USDG) still go through the plain router, no signature.

Chosen path: **1inch Business Swap API on RH Chain** (confirmed live) as the
signed-quote source. Next: get a 1inch (or 0x) API key, then build the executor
to fetch quote -> sign -> broadcast, test on the canary.

## (historical) CRITICAL BLOCKER: stock-token swaps require an off-chain signed price

Decoded a real USDG->NVDA swap the owner did via the Uniswap UI (tx
0x9d3aed9d..., from the Ledger EOA). It does NOT call the plain router. It calls
an unverified wrapper 0x09e99d23bf226a6c6b4c2126239a3df3ca1b89b6 with
`execute(address to, (bytes,bytes) payload, bytes extra)`, which:
- forwards to a settlement contract 0x000000007A1C8e570011EeDF86A2A35593013cBA
- carries a **65-byte ECDSA signature** (payload.b = r+s+v) over a price/intent
- plus an `extra` blob encoding the swap params (USDG address visible in it)

Meaning: every STOCK-token trade needs a price attestation signed by Robinhood/
Uniswap's authorized signer, produced by their UI/backend. A third-party
autonomous bot cannot forge it.

Contrast: the owner's ETH->USDG swap (tx 0x0f7f44d5) went through the plain
UniversalRouter with standard `execute(bytes,bytes[],uint256)` and NO signature.
So CRYPTO swaps are autonomous; STOCK swaps are gated by a signed price.

### Consequence for the plan

Fully autonomous onchain trading of STOCK tokens is NOT possible as-is without
access to the price-signing API. This is an architecture-level constraint, not a
coding gap. Resolve before committing the $400 + token:
- Investigate whether the signing endpoint (the Uniswap UI calls it per swap) is
  reachable by a bot (inspect the UI's network requests). If yes, the bot fetches
  the signature per trade and the plan holds.
- If not: options are (a) trade CRYPTO onchain (autonomous, works), (b) keep the
  stock pirates on paper against real prices (honest, still the product) and prove
  real money on a crypto sleeve, (c) rethink the venue.

The $50 canary test already paid for itself: it surfaced this before the $400.

## DECISIVE: liquidity is Uniswap V4, and autonomous swaps are feasible (crypto)

Verified on-chain 2026-07-22:
- NO Uniswap V3 pools exist for USDG/NVDA (all fee tiers) or WETH/USDG. The V3
  SwapRouter02 path is a DEAD END for our pairs. Do not build against it.
- Uniswap **V4** PoolManagers are deployed. The liquidity (USDG/stock pools) is on V4.
- The 50 most recent transactions to the UniversalRouter ALL call plain
  `execute(commands, inputs)` (47 ok, 3 fail). NONE use `executeSigned`.
  => Autonomous swaps do NOT need a Robinhood-signed price. The onchain plan is
  feasible for a third-party bot. This was the make-or-break question; it passed.

### The real swap path (what to build)

- Router: UniversalRouter 0x8876789976decbfcbbbe364623c63652db8c0904, `execute()`.
- Protocol: Uniswap **V4** (Actions encoding: SWAP_EXACT_IN_SINGLE + SETTLE_ALL + TAKE_ALL).
- Approvals: Permit2 canonical 0x000000000022D473030F116dDEE9F6B43aC78BA3.
- Still needed to write the swap safely (extract from a real successful swap's
  calldata + the V4 PoolManager): the **PoolKey** for each USDG/stock pair
  (currency0, currency1, fee, tickSpacing, hooks). The hooks address especially
  must be exact. Get it by decoding one successful execute() swap on the router,
  or reading PoolManager Initialize events.
- Validation: a real test swap must be broadcast (by the owner) to confirm the
  encoding before scaling. Gas-only risk on a wrong encoding (it reverts), but
  confirm on a tiny amount first.

### Immediate ETH -> USDG bootstrap

The pirates hold USDG; the canary wallet holds ETH. Simplest safe path for this
ONE-OFF: do it in the Robinhood Wallet / Uniswap app UI (their UI does correct V4
routing), keep a little ETH for gas. Building a bespoke V4 swap just for a one-time
bootstrap is not worth the risk; the bot's RECURRING swaps are where the V4 build pays off.

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
