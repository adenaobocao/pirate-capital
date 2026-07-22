# Roadmap

Four eras. Each era only starts when the previous one's exit criteria are met.
The site's status tag follows the current era.

## Era 1: sea trials (now)

Paper chests, real prices. The full pipeline runs hourly and everything is public.

- [x] Pipeline: market data, monte carlo, the tavern, four brains, the articles, paper execution
- [x] Public site: crew, log, board, faq, token page
- [x] Brains pluggable on any OpenAI compatible endpoint (free options) or Anthropic
- [ ] Hourly cron running for 2 to 4 weeks
- [ ] Equity curves with real history, at least one full week without pipeline failures

Exit criteria: 2+ weeks of uninterrupted hourly ticks, zero manual edits to state.

## Era 2: real chests

The crew trades our own real money. Small bankroll ($1k per pirate, the Steve model).

- [ ] Execution path: Robinhood Agentic Trading MCP (official, off chain) or fully
      onchain via the chain's Uniswap AMM (see src/exec/robinhood-chain.ts)
- [ ] One public wallet per pirate on the explorer, linked from the site
- [ ] Site copy flips from "sea trials" to live status
- [ ] Kill switch documented and tested (pause all trading in one command)

Exit criteria: 30 days of real trading with wallets public and no incidents.

## Era 3: the flag ($PIRATE on Pons)

Launch blockers (from the panel review, PANEL.md):

- [ ] Public repo hosting + daily onchain anchoring of the tick log head hash
- [ ] Token design decision with a lawyer: consumptive sinks vs pnl linked burns
- [ ] Distribution engine live: auto trade cards per raid, per pirate pages
- [ ] Lookout mode (user paper pirates + leaderboard + launch fee sink) ships with the token
- [ ] 2 to 4 weeks of uninterrupted hourly ticks already public

Launch tasks:

- [ ] Launch $PIRATE on Pons with the site live and the log full
- [ ] Route Pons creator fees to the chest wallet, publicly traceable
- [ ] Publish the burn policy before any burn, then every burn with tx hash

## Era 4: the fleet (own your pirate)

Only if everything above holds. Full design: [FLEET.md](./FLEET.md).

- [ ] Users launch their own pirate in paper mode (lookout), public leaderboard
- [ ] Launch fee in $PIRATE, part burned (the deflation sink)
- [ ] Sailing school: plain english explainers linked from real log entries
- [ ] State moves to real storage (Blob or Postgres), wallet based identity
- [ ] First mate mode (agent proposes, human approves) after legal review
- [ ] Degen mode (full autonomy on user money) only if the legal structure allows. maybe never

## Standing rule

Real money and tokens are regulated territory and rules differ by jurisdiction.
Before era 2 and era 3 ship, run the plan past a lawyer. This roadmap is intent,
not legal advice to ourselves.
