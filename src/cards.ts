import fs from "node:fs";
import path from "node:path";
import { AGENTS } from "./config/agents.js";
import { loadState } from "./portfolio/store.js";

/**
 * The distribution engine, step one: every raid becomes a shareable card.
 * Generates one SVG per recent trade into public/cards/ (TPB style: white,
 * beige bars, arial, the reasoning as the star) plus cards/index.json.
 * Runs in the hourly cron before the deploy, so cards ship automatically.
 *
 * Run: npm run cards
 */

const OUT = path.resolve(process.cwd(), "public/cards");
const W = 800;
const H = 418;

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > width) {
      lines.push(line.trim());
      line = word;
      if (lines.length === maxLines) {
        lines[maxLines - 1] = lines[maxLines - 1].replace(/.{3}$/, "...");
        return lines;
      }
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

function card(pirate: string, tagline: string, t: {
  ts: string; action: string; ticker: string; price: number; usd: number; reasoning: string;
}): string {
  const green = "#1a7f37", red = "#b02a2a";
  const actionColor = t.action === "buy" ? green : red;
  const lines = wrap(t.reasoning, 52, 4);
  const when = t.ts.slice(0, 10);
  const reasoningText = lines
    .map((l, i) => `<text x="46" y="${208 + i * 30}" font-family="Georgia, serif" font-style="italic" font-size="19" fill="#555555">${esc(l)}</text>`)
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  <rect width="${W}" height="6" fill="#7a4e21"/>
  <rect x="0" y="30" width="${W}" height="34" fill="#f2efe2" stroke="#ccc7b0"/>
  <text x="46" y="53" font-family="Arial, sans-serif" font-size="15" font-weight="bold" fill="#000000">The Pirate Capital</text>
  <text x="${W - 46}" y="53" font-family="Arial, sans-serif" font-size="13" fill="#777777" text-anchor="end">The Ship's Log</text>
  <text x="46" y="122" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="${actionColor}">${esc(t.action.toUpperCase())}</text>
  <text x="${46 + (t.action === "buy" ? 105 : 125)}" y="122" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="#0b24bb">${esc(t.ticker)} @ $${t.price.toFixed(2)}</text>
  <text x="46" y="158" font-family="Arial, sans-serif" font-size="17" fill="#444444">size $${t.usd.toFixed(2)} · logged ${esc(when)} · ULed by ${esc(pirate)}, ${esc(tagline)}</text>
  ${reasoningText}
  <rect x="0" y="${H - 52}" width="${W}" height="34" fill="#f2efe2" stroke="#ccc7b0"/>
  <text x="46" y="${H - 30}" font-family="Arial, sans-serif" font-size="13" fill="#555555">four ai pirates. real prices. every decision in the open. · @thepiratecapital_</text>
  <text x="${W - 46}" y="${H - 30}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#0b24bb" text-anchor="end">thepirate.capital</text>
</svg>
`;
}

fs.mkdirSync(OUT, { recursive: true });
const index: { file: string; pirate: string; ts: string; ticker: string; action: string }[] = [];

for (const persona of AGENTS) {
  const state = loadState(persona.id);
  for (const t of state.trades.slice(-6)) {
    const stamp = t.ts.replace(/[:.]/g, "-");
    const file = `${persona.id}-${stamp}.svg`;
    fs.writeFileSync(path.join(OUT, file), card(persona.id, persona.tagline, t));
    index.push({ file, pirate: persona.id, ts: t.ts, ticker: t.ticker, action: t.action });
  }
}

index.sort((a, b) => (a.ts < b.ts ? 1 : -1));
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
console.log(`cards: ${index.length} generated in public/cards/`);
