# THE PIRATE CAPITAL

**Four ai pirates trading stock tokens around the clock. Every order and every reason, public. You watch from the dock.**

A financial The Pirate Bay: the layout, the search box, the listing table, the
attitude. Underneath it is a real agent pipeline trading against real market prices.

Declared inspiration:

- **The Pirate Bay**: the whole look and the whole vibe.
- **Steve** (Circle): autonomous agents with their own wallets betting on Polymarket, live.
- **MiroFish**: crowd simulation, ai personas reacting to the market before the decision.
- **Robinhood Chain**: an L2 (Arbitrum Orbit) with 24/7 Stock Tokens and Agentic Trading via MCP.

## The crew

| Pirate | Role | Style |
|---|---|---|
| **Flint** | the old captain | mean reversion contrarian. buys panic, sells euphoria |
| **Cannon** | the gunner | momentum degen. rides trends with a short stop |
| **Crow** | the lookout | sentiment. trades divergences from the tavern |
| **Ledger** | the quartermaster | pure quant. monte carlo only, fractional Kelly sizing |

## How a tick works

```
real market data (yahoo finance, no key)
  -> A THOUSAND VOYAGES: monte carlo GBM, 1,000 scenarios per ticker (E[r], pUp, p5, p95)
  -> THE TAVERN: crowd sim (24 personas -> sentiment per ticker)
  -> 4 pirates decide (one llm persona each, structured output)
  -> THE ARTICLES: risk guardrails in code (position and order caps, the model never rules the cash)
  -> execution (sea trials: paper) -> state in state/*.json -> the site
```

## Quick start

```bash
npm install
cp .env.example .env     # pick a brain: any OpenAI compatible endpoint (free
                         # options inside) or an Anthropic key

npm run tick:dry         # test the pipeline, no model, free
npm run tick             # real tick
npm run dash             # the site at http://localhost:4243
```

Full operations guide: [docs/RUNBOOK.md](./docs/RUNBOOK.md)

## The token

**$PIRATE** launches on Pons (Robinhood Chain's launchpad). Creator fees feed the
crew's bankroll; big profits buy $PIRATE back and burn it. No yield, no rights,
no promises, and watching stays free forever. The whole design:
[docs/TOKENOMICS.md](./docs/TOKENOMICS.md)

## Where this is going

Sea trials (paper, now) then real chests with public wallets, then the flag on
Pons, then scale. Eras and exit criteria: [docs/ROADMAP.md](./docs/ROADMAP.md).
Strategy and narrative: [CONCEPT.md](./CONCEPT.md).

## Warnings

- Nothing here is investment advice. It is an agent experiment with a loud theme.
- Real money and tokens are regulated territory per jurisdiction. Lawyer before
  era 2 and 3 (see ROADMAP).
- The pirates are not financial advisors. They are pirates.
