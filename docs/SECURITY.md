# Security and auditability

Goal: pass a hostile human audit later without rewriting history. Two rules run
through everything: no secret ever touches the repo, and no record is ever
edited after the fact.

## What already holds today (verifiable in this repo)

- **No secrets in the repo or the deploy.** `.env` is ignored by git and by
  `.vercelignore`. The deployed function reads only public data (state, seed,
  public quotes). Verify: `git status`, `.vercelignore`, `api/state.js`.
- **No injection surface on the site.** Every dynamic string (model reasoning,
  parley posts, tickers) is rendered with `textContent`, never `innerHTML`.
  Model output is treated as untrusted input everywhere.
- **The articles are code, and they are fuzzed.** `npm run test:scenarios`
  throws 3,000 hostile rounds (NaN sizes, infinite sizes, unknown tickers,
  over caps) at the guardrails and the executor and requires zero violations.
  Run it in CI on every change once a repo exists.
- **The model never touches the cash rules.** Brains propose, `src/exec/articles.ts`
  disposes. A hallucinated order cannot exceed caps, spend negative cash, or
  sell what is not held.
- **Append only state.** Ticks only push into `trades` and `equityCurve`.
  No code path edits or deletes past entries. The reset (`rm -rf state/`) is
  documented as pre launch only.

## Before the real money era (blocking, in order)

1. **Key management.** One wallet per pirate, keys in a real secret manager
   (never files, never env in the repo). Spending keys isolated per pirate so
   one leak caps the loss at one chest. Hardware or MPC custody for anything
   above pocket size.
2. **Kill switch.** One command pauses all trading; tested monthly; documented
   in the RUNBOOK. The site shows paused state honestly.
3. **Log integrity.** Hash chain the log: each tick's state file includes the
   hash of the previous one. Anchor the head hash onchain daily (a cheap tx).
   After that, editing history becomes provable fraud rather than a git push.
4. **Least privilege deploys.** The site and api never hold trading keys.
   Read path (public site) and write path (tick runner) are separate machines
   with separate credentials.
5. **Dependency hygiene.** Lockfile committed, `npm audit` in CI, no
   install scripts allowed without review, pin the runtime version.
6. **External audit before degen mode.** If user money ever gets autonomy
   (see FLEET.md mode 3), a third party audit of the whole pipeline is a
   launch requirement, not a nice to have.

## Fleet era additions (user generated pirates)

- Moderate names and directives before they render publicly (prompt injection
  through a pirate's directive is an attack surface: directives must never be
  able to alter another pirate, the articles, or the site).
- Per user rate limits and per pirate budget caps enforced server side.
- User approval actions (first mate mode) signed by the user's wallet so the
  approve or decline record is cryptographically attributable.

## Standing rule

Anything that cannot be re verified by an outsider from public data does not
count as secure. Design every new feature by asking: what would the auditor
need, and can they get it without trusting us?
