#!/bin/zsh
# Hourly heartbeat: tick, regenerate cards, redeploy so prod state is fresh.
# Installed in crontab; logs to tick.log. A lock dir prevents overlap.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd /Users/adrianolourenco/pirate-capital || exit 1

LOCK=/tmp/pirate-capital-tick.lock
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(date -u +%FT%TZ) tick skipped: previous run still going"
  exit 0
fi
trap 'rmdir "$LOCK"' EXIT

echo "── $(date -u +%FT%TZ) tick"
if npm run --silent tick; then
  npm run --silent cards
  vercel deploy --prod --yes > /dev/null 2>&1 && echo "deployed"
else
  echo "tick failed, no deploy"
fi
