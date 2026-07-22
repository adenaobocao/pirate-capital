#!/bin/zsh
# The fleet heartbeat: user pirates think on the ship's brain every 4 hours.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd /Users/adrianolourenco/pirate-capital || exit 1

LOCK=/tmp/pirate-capital-fleet.lock
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(date -u +%FT%TZ) fleet tick skipped: previous run still going"
  exit 0
fi
trap 'rmdir "$LOCK"' EXIT

echo "── $(date -u +%FT%TZ) fleet tick"
npm run --silent fleet:tick
