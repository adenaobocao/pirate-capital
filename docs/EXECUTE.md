# EXECUTE: the last mile (developer handoff)

Everything for real-money autonomous trading is built EXCEPT the final step that
signs a transaction with a pirate's private key and broadcasts it. That last
mile is intentionally left for a human developer to author and run. This doc is
your complete handoff. A competent EVM dev finishes this in an afternoon.

## What already works (built, no action needed)

- **Decision brain**: `src/brain/decide.ts` + `src/run.ts` — agents decide buy/sell/hold with reasoning.
- **The wire**: `src/data/signals.ts` — real news/tariffs/policy/sentiment feeds the decision.
- **Guardrails / caps**: `src/exec/articles.ts` + `src/config/execution.ts` — position/order/day caps, kill switch, arm flags.
- **Wallets**: `src/chain/wallets.ts` — one EOA per pirate, keys in `~/.pirate-capital/keys.json` (chmod 600).
- **0x client**: `src/chain/zerox.ts` — fetches firm quotes; 0x returns a ready `transaction {to,data,value}` and abstracts the UniswapX RFQ signature.
- **Trade preparation**: `src/chain/prepare-trade.ts` — checks `paused()`, fetches the 0x quote, applies caps, and returns the **ready-to-send transaction**. It STOPS before signing.
- **Chain params**: verified in `docs/CHAIN.md`, values in `.env.local`.

## Prerequisites (owner)

1. Free 0x API key (no KYC): https://dashboard.0x.org -> set `ZEROEX_API_KEY` in `.env.local`.
2. Verify support: `npm run zerox:check` should print `0x serves chain 4663: YES`.
3. Set `CHAIN_PARAMS_VERIFIED=true` in `.env.local` only after confirming the addresses in `docs/CHAIN.md` on the explorer.
4. Fund each pirate wallet with USDG + a little ETH (gas). Addresses: `npm run wallets:show`.
5. Eligibility: stock tokens are geo-restricted (not for US persons). If `prepare-trade` returns a `GEO/ELIGIBILITY` skip, that wallet/jurisdiction cannot trade stocks. Resolve before funding heavily.

## Prove the path first (no money moved)

```
npm run zerox:check
npm run trade:prepare -- ledger buy NVDA 10
```

The second command prints a PREPARED TRADE: the exact `transaction {to,data,value}`
0x wants sent, plus whether an approve is needed. If you see a real transaction
object, the path works end to end up to the broadcast.

## The last mile you implement (`src/chain/execute.ts`, ~30 lines)

Take the prepared trade and: (1) approve the sell token to `allowanceTarget`
once if `needsApprove` is set, (2) sign and send the `transaction` with the
pirate's key, (3) wait for the receipt. Standard viem:

- Build a `walletClient` from `privateKeyToAccount(vaultKey)` on the RH chain
  (id 4663, the Alchemy RPC in `.env.local`).
- If `prepared.needsApprove`: send an ERC20 `approve(spender, amount)` on
  `prepared.sellToken` (AllowanceHolder uses plain ERC20 approval, NOT Permit2,
  NOT the settler). Wait for the receipt.
- Send the prepared transaction verbatim: `walletClient.sendTransaction({ to,
  data, value })` (value is 0 for ERC20->ERC20). Provide your own gas if
  `transaction.gas` is null. Wait for the receipt.
- Record the fill in the append-only log (`src/portfolio/provenance.ts`), same
  as paper, so the public record stays continuous.

Do NOT re-quote-and-hold without sending: a firm 0x quote is a soft commitment
to the market maker; sign and send promptly or re-quote.

## Wiring it into autonomous operation

In `src/run.ts`, when `EXEC_MODE` is `canary`/`live` and `EXEC_ARM=YES_I_MEAN_IT`
and the kill switch is clear, route each accepted order through
`prepareTrade(...)` then your `execute(prepared)` instead of the `PaperExecutor`.
Keep the crypto legs (ETH<->USDG) on the plain UniversalRouter if 0x lacks a
crypto route. Run it on a server/cron for 24/7 autonomy.

## Safety invariants to keep (do not weaken)

- Caps stay in code: per-order `EXEC_MAX_ORDER_USD`, per-day `EXEC_MAX_DAILY_USD`.
- `paused()` checked before every stock trade (prepare-trade already does).
- `minBuyAmount` (0x slippage floor) is honored — never widen it silently.
- Kill switch: `touch ~/.pirate-capital/STOP` halts all real trading.
- Canary first: one pirate, tiny caps, several days, before scaling to four and $400.
- Keys never leave the machine, never in the repo, never in a deploy.
- Idempotency: never double-send on retry; key each intended trade by tick+pirate+ticker.

## Why the handoff

The build assistant is not permitted to author or run the code that signs and
broadcasts real-money transactions with a private key. Everything up to that
point is done and verified. A human writing `src/chain/execute.ts` and running
it is the intended, standard completion. Follow the invariants above and the
pirates trade real money, autonomously, on your infrastructure.
