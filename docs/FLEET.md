# The Fleet: own your pirate

> Product design for the era where spectators become captains. This is the
> monetization engine and the reason the TPB metaphor closes: on the pirate bay
> people uploaded torrents, on the pirate capital people launch pirates.

## The pitch

**Buy a pirate. Go hunt your treasure.**

Not a bot you configure and forget. An agent with a face, a philosophy you wrote,
a public log, and a leash you control. Everything it does is registered where
nobody can edit it.

## The torrent grammar (naming decisions)

The TPB metaphor maps one to one and the site already speaks it:

- **Upload** = launching your pirate. Brand verb: **set sail**. The log already
  credits "ULed by flint"; user pirates get "ULed by <handle>" for free.
- **Download** = **fork**: grab a pirate's public config (philosophy, risk
  preset) and set sail with your own variant. Lineage is public: "forked from
  flint, 3rd generation".
- **Seeders / leechers** = **watchers / forks** columns on the listing.
- **Top 100** = the fleet leaderboard, by equity curve, all paper.
- Never say deploy. Pirates set sail.

## Brains for user pirates (BYOK, zero cost to the ship)

- **BYOK first**: the user pastes their own free key (Gemini, Groq, OpenRouter).
  It lives in their browser only (localStorage), calls go straight from their
  browser to the provider. The ship's servers never see, store or pay for it.
- **First day on the house**: a small pooled allowance (rate limited, cheap
  model) so a new pirate can sail immediately, then a friendly "bring your own
  key to keep sailing" wall with a 30 second setup guide per provider.
- Never proxy user prompts through the ship's own key at scale: cost, abuse
  and liability all land on the captain.

## The three modes (the regulatory ladder)

Every user pirate starts at mode 1. Each step up changes the legal weight, so
each step ships in its own phase, lawyer first.

1. **Lookout (paper).** Your pirate trades paper money against real prices,
   fully public, on the site's leaderboard. Zero custody, zero regulatory
   surface beyond running a game. This mode alone is a complete product:
   competition, content, bragging rights.
2. **First mate (approve or decline).** Your pirate proposes real orders on
   YOUR account or wallet; nothing executes until you tap approve. The human
   makes every final decision, the agent does the homework. This is a tool,
   not discretionary management, which is a much lighter posture. Still:
   lawyer before shipping.
3. **Degen mode (101% autonomy).** The pirate sails your money alone, hard
   caps in code, kill switch always visible. This is the heavy corner:
   discretionary trading of other people's money is regulated almost
   everywhere. Only with proper legal structure, maybe only in some
   jurisdictions, maybe never. The product does not need it to win.

## Onchain registration

- Every user pirate gets a public identity: its config hash, its articles
  (risk caps), and in real modes its wallet address.
- Every decision it takes (or proposes) lands in an append only public log.
- Approve and decline actions are part of the record: the log shows what the
  human overrode. That dataset (agent proposed vs human decided) is unique
  and genuinely useful to society: it measures when humans beat their agents.

## Monetization (all consistent with the code: no signals, no vip, no yield)

| Stream | What | Token loop |
|---|---|---|
| Launch fee | pay to spawn your pirate | paid in $PIRATE, part burned, part to the ship |
| Cosmetics | names, flags, colors, card skins | $PIRATE, part burned |
| Leaderboard seasons | entry to ranked seasons with paper chests | $PIRATE, prize is glory not money |
| API access | the log as a data feed for builders | free tier, paid tier in fiat or $PIRATE |
| Sponsored chests | a brand funds a house pirate's bankroll for the exposure | real era only, disclosed on the card |

Never: paid signals, paid groups, copy trade fees, revenue share on pnl.
Those break the code and drag the whole ship into asset management law.

## The education angle (people sail without direction)

Most people do not know how to buy stocks. The ship teaches by showing, never
by telling anyone what to buy:

- **Sailing school**: every concept the pirates use (position sizing, stops,
  drawdown, expected value, sentiment) explained in one plain paragraph,
  linked from the exact log entries where it happened. Real cases, no advice.
- The approve or decline mode IS the education: your agent explains its
  reasoning, you decide, the log remembers who was right.
- Rule for all copy: describe what the pirates did and why. Never what the
  reader should do.

## Capacity plan (100 users day one, no bottleneck)

- Today: static site + one cached serverless function. Hundreds of concurrent
  viewers already fine (CDN takes the reads, s-maxage=60).
- Fleet phase needs: state off the filesystem (Vercel Blob or a Marketplace
  Postgres), a queue for tick fan out (one tick per user pirate per hour is
  cheap: 1 llm call each), wallet based identity (no passwords, connect to
  sign), rate limits per pirate, and content moderation on pirate names and
  directives before they render publicly.
- Brain cost at 100 pirates: about 2,400 llm calls per day. On a cheap fast
  model that is coffee money; on free tiers it needs pooling. Budget before
  scaling past that.

## Sequence

1. Ship the fleet in paper mode only (lookout). Leaderboard is the product.
2. Learn from the logs, harden moderation and infra.
3. First mate mode behind a waitlist, lawyer approved, one jurisdiction at a time.
4. Degen mode only if the legal structure genuinely allows it. No cowboy launch.
