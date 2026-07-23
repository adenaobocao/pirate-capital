# Chain parameters (real execution)

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

## Verified values (record source + date next to each)

| Param | Value | Source | Verified on |
|---|---|---|---|
| RPC URL |  |  |  |
| Chain ID |  |  |  |
| Explorer |  |  |  |
| Router |  |  |  |
| Stablecoin |  |  |  |
| Stock tokens |  |  |  |

## Open question that changes everything (from research)

Are the tokenized stocks freely transferable and swappable by an arbitrary
wallet, or permissioned / KYC-gated at the contract level? If permissioned, the
pure onchain path (B) may not work for our wallets and the official Agentic
Trading MCP path (A) becomes the route. Resolve this before funding.
See docs/research findings appended by the research run.
