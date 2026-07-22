import fs from "node:fs";
import path from "node:path";
import { verifyChain } from "./portfolio/provenance.js";

/**
 * Daily anchor: verify the whole tick chain, then append the head hash to
 * ANCHORS.md. The cron script commits and pushes it, so the head lands in
 * public git history (a timestamped trail anyone can check). In the real era
 * the same head goes in an onchain tx and this file records the tx hash too.
 *
 * Run: npm run anchor
 */

const ANCHORS = path.resolve(process.cwd(), "ANCHORS.md");

const { entries, head } = verifyChain();
if (entries === 0) {
  console.log("nothing to anchor yet.");
  process.exit(0);
}

if (!fs.existsSync(ANCHORS)) {
  fs.writeFileSync(
    ANCHORS,
    "# Log anchors\n\nEach line: the verified head hash of the tick chain (state/ticks.jsonl)\nat anchor time. Recompute with `npm run verify:log`. History that rewrites\nitself breaks these hashes publicly.\n\n",
  );
}
const line = `- ${new Date().toISOString()} | ticks ${entries} | head ${head}\n`;
fs.appendFileSync(ANCHORS, line);
console.log("anchored: " + line.trim());
