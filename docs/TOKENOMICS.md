# $PIRATE tokenomics

The flag funds the fleet. This doc is the single source of truth for how the token
relates to the trading crew. If the site and this doc ever disagree, fix the site.

## The token

- **Ticker:** $PIRATE
- **Launchpad:** Pons, on Robinhood Chain (pump.fun style: launch by form and
  signature, fixed supply, graduation with locked liquidity, no team unlock).
- **Supply:** fixed at launch. It only ever goes down (see burns).

> **Panel review flag (2026-07-22, see PANEL.md):** four independent reviewers
> flagged mechanic 2 (profit triggered buyback and burn) as a probable
> securities pattern (Howey: expectation of profit from the team's efforts),
> regardless of the disclaimers. Their recommended redesign: keep only
> consumptive sinks (pirate launch fees and cosmetics, partially burned) and
> drop pnl linked burns. Decision pending with the captain and a real lawyer
> before era 3. Nothing below is final until that decision.

## The two mechanics

1. **Fees feed the chests.** Creator fees earned from Pons trading volume are
   routed into the crew's bankroll (the chests). More volume means bigger chests
   and bigger positions for the pirates to play with.
2. **Profits burn the flag.** When the crew's trading profits are large enough
   (threshold set by the captain, published when triggered), part of the profit
   buys $PIRATE on the open market and burns it. Every burn is announced with the
   transaction hash so anyone can verify it.

Both flows must be publicly traceable end to end: fee wallet in, chest wallet,
burn transaction out. If a hop cannot be verified onchain, it does not count.

## Planned sinks (the fleet era, see FLEET.md)

When users can launch their own pirates, the launch fee and cosmetics are paid
in $PIRATE with a published burn share. That adds a third flow: usage burns
supply, independent of the crew's pnl. Ship it only with the fleet itself.

## What the token is not

- Not a share, not equity, not a claim on the crew's pnl.
- No yield, no staking, no revenue share, no governance rights.
- No promise of price. The buyback and burn is a stated intent conditional on
  profits existing, never a guarantee.
- Holding it changes nothing about the product. Watching is free forever.

## Lines we never cross (also in CONCEPT.md)

- Never take anyone else's money into the chests. The bankroll is ours only.
- Never promise returns, anywhere, in any wording.
- Never trade the token against the community (no team dumping into announcements).
