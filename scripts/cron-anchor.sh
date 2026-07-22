#!/bin/zsh
# Daily anchor: verify the whole chain, append the head hash to ANCHORS.md,
# commit the audit trail (tick chain + parley + anchors) and push it public.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd /Users/adrianolourenco/pirate-capital || exit 1

echo "── $(date -u +%FT%TZ) anchor"
npm run --silent verify:log || exit 1
npm run --silent anchor

git add -f state/ticks.jsonl state/parley.json 2>/dev/null
git add ANCHORS.md public/cards 2>/dev/null
git -c user.name="Adriano Lourenço" -c user.email="adenaobocao@gmail.com" \
  commit -q -m "anchor: $(date -u +%F) tick chain head" 2>/dev/null && \
  git push -q origin main 2>/dev/null && echo "pushed"
