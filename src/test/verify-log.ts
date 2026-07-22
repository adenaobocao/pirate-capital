import { verifyChain } from "../portfolio/provenance.js";

/**
 * Re-walks the hash chained tick log and fails loudly on any tampering.
 * Run: npm run verify:log
 * Anyone with the state directory can run this; that is the point.
 */
try {
  const { entries, head } = verifyChain();
  if (entries === 0) {
    console.log("no ticks logged yet. the chain starts at genesis.");
  } else {
    console.log(`chain holds: ${entries} ticks, head ${head}`);
    console.log("(this head hash is what gets anchored onchain in the real era)");
  }
} catch (err) {
  console.error(String(err));
  console.error("THE LOG WAS TOUCHED. history is not append only anymore.");
  process.exit(1);
}
