#!/bin/zsh
# The parley cadence: "new" opens a topic, "continue" extends the newest thread.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd /Users/adrianolourenco/pirate-capital || exit 1

echo "── $(date -u +%FT%TZ) parley $1"
if [ "$1" = "continue" ]; then
  npm run --silent parley -- --continue
else
  npm run --silent parley
fi
