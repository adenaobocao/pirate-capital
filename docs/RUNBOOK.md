# Runbook

Everything operational: setup, brains, ticks, deploys, troubleshooting.

## Setup

```bash
npm install
cp .env.example .env    # then fill in a brain (see below)
```

## Brains

The pirates need an LLM to think. Two paths, checked in this order:

1. **Any OpenAI compatible endpoint (default, free friendly).** Set in `.env`:
   - `PIRATE_API_BASE`, `PIRATE_API_MODEL`, and `PIRATE_API_KEY` unless local.
   - Working examples for OpenRouter free models, Groq, Gemini and local Ollama
     are in `.env.example`. Ollama is fully free and keyless: install it, run
     `ollama pull qwen2.5:7b`, set the base to `http://localhost:11434/v1`.
2. **Anthropic API (fallback).** Used only when `PIRATE_API_BASE` is not set.
   Needs `ANTHROPIC_API_KEY`. Models via `PIRATE_MODEL` / `PIRATE_CROWD_MODEL`.

Free tier notes: quotas change often, check the provider's current limits. One
tick = 5 calls (1 tavern + 4 pirates), 24 ticks/day = 120 calls/day. Size the
free tier against that.

## Ticks

```bash
npm run tick:dry     # no model, quant heuristic. tests the whole pipeline free
npm run tick         # real tick with whatever brain is configured
npm run tick -- --agent flint    # tick a single pirate
```

The heartbeat is INSTALLED in the user crontab (see `crontab -l`), via
`scripts/cron-tick.sh` (hourly: tick, regenerate cards, redeploy prod),
`scripts/cron-parley.sh` (13:00 new topic, 18:00 and 23:00 continue the
newest thread) and `scripts/cron-anchor.sh` (23:30: verify the chain, append
the head hash to ANCHORS.md, commit the audit trail and push).

macOS note: cron does not fire while the mac sleeps. Keep it awake
(`caffeinate -s`, Amphetamine, or plugged in with sleep off) or accept holes
in the curve. Missed ticks are just missed; nothing breaks.

Extra commands:

```
npm run cards        # regenerate shareable trade cards into public/cards/
npm run anchor       # verify chain + append head hash to ANCHORS.md
npm run verify:log   # re-walk the whole hash chain
```

Reset the experiment (all chests back to $1,000, log erased):

```bash
rm -rf state/
```

Do this only before going public. After launch the log is append only, that is
the whole trust story.

## The site

- Local: `npm run dash` then http://localhost:4243 (port via `PIRATE_PORT`).
- The page is `public/index.html`, served as is. No build step.
- Production (Vercel): static `public/` plus the self contained function
  `api/state.js`. Deploy from the project root:

```bash
vercel deploy --prod --yes
```

- `state/` is excluded from deploys by `.vercelignore` while in sea trials, so
  production shows a fresh crew. To publish the log: delete the `state` line
  from `.vercelignore` and redeploy (vercel.json already bundles `state/**`
  into the function). Redeploy after every tick you want reflected, or move
  state to real storage when that gets old (Vercel Blob is the obvious next step).

## Troubleshooting

- **Tick fails with "No quotes"**: Yahoo is down or rate limiting. Wait, retry.
- **Tick fails with an auth error**: no brain configured. Check `.env`.
- **llm error 429 in the log**: free tier quota hit. Slow the cron or switch provider.
- **Site shows "waiting" forever**: no state files yet. Run a tick.
- **Deployed api hangs**: it must export `GET` (web style Response), not a
  default (req, res) handler. Already correct; do not regress it.
- **Vercel build crashes with a readFile TypeError**: the builder tried to
  typecheck TS in the deploy. Keep the deploy JS only (`api/state.js`, `src/`
  stays excluded in `.vercelignore`).

## Ownership map

| Piece | File |
|---|---|
| Personas and risk limits | `src/config/agents.ts` |
| Brain provider switch | `src/brain/llm.ts` |
| Decision call | `src/brain/decide.ts` |
| Crowd sim (the tavern) | `src/sim/crowd.ts` |
| Monte carlo (a thousand voyages) | `src/sim/montecarlo.ts` |
| Guardrails (the articles) | `applyGuardrails` in `src/run.ts` |
| Paper execution | `src/exec/executor.ts` |
| Real execution stub | `src/exec/robinhood-chain.ts` |
| Local server | `src/server.ts` |
| Prod api | `api/state.js` |
| The site | `public/index.html` |
