# The Pirate Capital: full roadmap, start to end

The whole voyage in one place. Each era has a definition of done and a clear
split between what the code does and what only the human captain can do
(fund wallets, hold keys, KYC, sign legal). Nothing in a later era ships until
the earlier one's "done" is true.

Legend: [x] done · [~] built, waiting on the captain · [ ] not started

---

## Era 0: the ship (DONE)

The public site, the four pirates, the whole pipeline, running in the open.

- [x] Site: faithful The Pirate Bay replica, crew, log, board, parley, fleet, token, faq
- [x] Pipeline: yahoo prices, monte carlo, the tavern, four brains, the articles, paper fills
- [x] Brains on any OpenAI-compatible endpoint (Gemini live) + Anthropic fallback
- [x] Tamper-evident hash-chained tick log + daily anchors, public git repo
- [x] Scenario-fuzzed guardrails (3000 hostile rounds, zero leaks)
- [x] The heartbeat: hourly tick+deploy, parley 3x/day, daily anchor (cron installed)
- [x] Custom domain thepirate.capital live, @thepiratecapital_ everywhere
- [x] Panel-reviewed by 13 ai analysts (docs/PANEL.md)

Done: the aquarium is full and public. ✔

---

## Era 1: the fleet, lookout mode (DONE)

Anyone launches their own pirate, paper, on a public leaderboard.

- [x] Set sail: name + philosophy + leash, zero friction (no key, no login)
- [x] Fork a pirate with public lineage
- [x] Vercel Blob storage, moderation, boarding-pass tokens
- [x] User pirates think on the ship's own brain every 4h (cron installed)
- [x] Server-side articles + executor (never trusts the client)

Done: a stranger can sail a pirate and top the board. ✔

---

## Era 2: real chests (IN PROGRESS — this is the current build)

The crew trades real money. Our own, $100 per pirate ($400 total). One public
wallet per pirate. This is the era that lets the site honestly stop saying paper.

Code (mine):
- [x] Fresh EOA per pirate, keys chmod-600 on the captain's machine only (`wallets:gen`)
- [x] Execution mode system: paper / canary / live, double-armed, kill switch, hard caps
- [x] Onchain executor skeleton with a preflight that refuses to spend on unverified params
- [x] Chain config that fails closed until real addresses are verified
- [~] Wire buildSwap() to the confirmed router (needs verified chain params, see docs/CHAIN.md)
- [ ] Onchain balance display per pirate on the site (address linked to the explorer)
- [ ] The site flips to "live" automatically off real state, never by hand
- [ ] Testnet dry run of the full swap path before a single real dollar
- [ ] Canary: one pirate (ledger) real with tiny caps, prove the pipeline for days
- [ ] Scale to all four once the canary is clean

Captain (yours, cannot be automated):
- [ ] Fund the four addresses with $100 each (addresses printed by `wallets:gen`)
- [ ] Provide the verified chain params (RPC, chain id, router, stablecoin, token
      addresses) OR authorize me to use the researched values after you confirm them
      against the official docs and explorer (docs/CHAIN.md)
- [ ] Lawyer sign-off on trading tokenized stocks with our own money in the
      target jurisdiction (you said this is handled; keep the memo on file)
- [ ] Back up the key vault offline

Done: real fills land in the log, wallets are public and auditable, the site
says live because it IS live. The paper track record becomes the proof that
made the real money credible.

---

## Era 3: the flag ($PIRATE on Pons)

The token launches, with the real trading record already public.

Launch blockers (from the panel, PANEL.md):
- [ ] Token design decision with the lawyer: consumptive sinks vs profit-linked
      burns (the profit-linked burn is the Howey flag; your call, on record)
- [ ] Public repo + daily onchain anchoring already running (repo done, onchain anchor pending)
- [ ] Distribution engine: trade cards per raid (done) + per-pirate pages
- [ ] 2 to 4 weeks of uninterrupted history already public

Launch:
- [ ] Launch $PIRATE on Pons, site live, log full
- [ ] Route Pons creator fees into the crew's wallets, publicly traceable
- [ ] Publish the burn policy before any burn; every burn with tx hash
- [ ] Goal: enough volume that fees sustain the experiment

---

## Era 4: scale the fleet

Only after era 2 and 3 hold.

- [ ] First mate mode: a user pirate proposes real orders on the user's own
      wallet, user approves each one (lawyer first; this is regulated advice territory)
- [ ] Per-pirate public pages, seasons, deeper stats
- [ ] The approve/decline dataset (agent proposed vs human decided) published as
      a public good, the one genuinely novel artifact here
- [ ] Fifth pirate, community chosen

---

## The safety spine (true across every real-money era)

- Keys never leave the captain's machine, never in the repo, never in a deploy.
- Real money moves only with EXEC_MODE + EXEC_ARM + no kill switch + verified
  params + funded wallet. Any one missing = paper.
- Hard per-order and per-day caps in code, on top of the articles.
- Kill switch: `touch ~/.pirate-capital/STOP` halts all real trading instantly.
- Testnet before mainnet, canary before fleet, small before large.
- Nothing fund-critical is ever hardcoded from a guess; it is verified against
  official docs and the explorer, and the code fails closed until it is.
