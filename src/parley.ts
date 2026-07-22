import Anthropic from "@anthropic-ai/sdk";
import { AGENTS } from "./config/agents.js";
import { PARLEY_PERSONAS, PARLEY_TOPICS } from "./config/parley.js";
import { chatJson, openAiCompatConfigured } from "./brain/llm.js";
import { loadParley, loadState, saveParley, type ParleyThread } from "./portfolio/store.js";

/**
 * One parley round: ten minds argue one topic, the thread lands in state.
 * The minds see the actual state of the ship (crew equity, latest trades and
 * commentary), so the debate references what really happened on deck.
 *
 * Usage:
 *   npm run parley                 # open a new topic
 *   npm run parley -- --continue   # add replies to the newest thread instead
 *
 * Cadence suggestion: twice a day, alternating new and continue:
 *   0 13 * * * cd /Users/adrianolourenco/pirate-capital && npm run parley >> parley.log 2>&1
 *   0 21 * * * cd /Users/adrianolourenco/pirate-capital && npm run parley -- --continue >> parley.log 2>&1
 */

const CONTINUE = process.argv.includes("--continue");

const THREAD_SCHEMA = {
  type: "object",
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          author: { type: "string", description: "one of the given handles, exactly" },
          text: {
            type: "string",
            description: "the post, 1 to 3 sentences, lowercase informal english, in the persona's voice. no emoji, no dashes.",
          },
        },
        required: ["author", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["posts"],
  additionalProperties: false,
} as const;

/** What actually happened on deck, so the minds argue about real events. */
function shipContext(): string {
  const lines: string[] = [];
  for (const persona of AGENTS) {
    const state = loadState(persona.id);
    const last = state.trades.slice(-3).map((t) =>
      `${t.action} ${t.ticker} $${t.usd.toFixed(0)} ("${t.reasoning}")`,
    );
    lines.push(
      `- ${persona.name} (${persona.tagline}): cash $${state.cash.toFixed(0)}, ` +
        `${state.trades.length} trades total. latest: ${last.length ? last.join("; ") : "none yet"}. ` +
        (state.lastCommentary ? `last words: "${state.lastCommentary}"` : ""),
    );
  }
  return `STATE OF THE SHIP RIGHT NOW (real data, reference it concretely where it helps):\n${lines.join("\n")}`;
}

function roster(): string {
  return PARLEY_PERSONAS.map((p) => `- ${p.handle}: ${p.stance}`).join("\n");
}

function newThreadPrompt(topic: string): string {
  return `You are the engine of THE PARLEY, a public roundtable attached to "the pirate capital",
a live experiment where four ai agents trade stock tokens in public on robinhood chain, funded by
a support token, with every order and every reason published.

The ten minds at the table:
${roster()}

${shipContext()}

Produce ONE discussion thread on the topic: "${topic}"

Rules:
- 12 to 18 posts total. Every persona posts at least once; the loudest post twice or three times.
- Real disagreement. At least four direct replies that push back on a previous post by name.
- Each post is 1 to 3 sentences, lowercase informal english, in that persona's distinct voice.
- Concrete over abstract: cite the ship's real trades and words above when relevant.
- No emoji. No dashes. No hashtags. End mid-argument, never with a tidy conclusion.`;
}

function continuePrompt(thread: ParleyThread): string {
  const history = thread.posts.map((p, i) => `#${i + 1} ${p.author}: ${p.text}`).join("\n");
  return `You are the engine of THE PARLEY (context: "the pirate capital", four ai agents trading
stock tokens in public, everything published).

The ten minds:
${roster()}

${shipContext()}

This thread is already running on the topic: "${thread.topic}"

Thread so far:
${history}

Continue it with 6 to 9 NEW posts. Rules:
- React to specific earlier posts by name and number where natural.
- Bring in what changed on the ship since (see state above) if it fuels the argument.
- Each post 1 to 3 sentences, lowercase informal english, distinct voices, real disagreement.
- No emoji. No dashes. No hashtags. End mid-argument.`;
}

function coercePosts(raw: unknown): { author: string; text: string }[] | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as { posts?: unknown };
  if (!Array.isArray(obj.posts)) return null;
  const handles = new Set(PARLEY_PERSONAS.map((p) => p.handle));
  const posts = obj.posts
    .filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object")
    .map((p) => ({ author: String(p.author ?? ""), text: String(p.text ?? "") }))
    .filter((p) => handles.has(p.author) && p.text.length > 0);
  return posts.length >= 4 ? posts : null;
}

async function generate(system: string): Promise<{ author: string; text: string }[] | null> {
  if (openAiCompatConfigured()) {
    const raw = await chatJson(
      `${system}\n\nRespond with ONLY minified JSON: {"posts":[{"author":"handle","text":"..."}]}`,
      "Run the round.",
    );
    return coercePosts(raw);
  }
  const client = new Anthropic();
  const response = await client.messages.create({
    model: process.env.PIRATE_MODEL ?? "claude-opus-4-8",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system,
    output_config: { format: { type: "json_schema", schema: THREAD_SCHEMA } },
    messages: [{ role: "user", content: "Run the round." }],
  });
  const text = response.content.find((b) => b.type === "text");
  return text && text.type === "text" ? coercePosts(JSON.parse(text.text)) : null;
}

async function main() {
  const existing = loadParley();

  if (CONTINUE && existing.threads.length > 0) {
    const thread = existing.threads[0];
    console.log(`\nTHE PARLEY continues thread ${thread.id}: "${thread.topic}"\n`);
    const posts = await generate(continuePrompt(thread));
    if (!posts) {
      console.error("the parley stayed silent. nothing saved.");
      process.exit(1);
    }
    thread.posts.push(...posts);
    saveParley(existing);
    console.log(`added ${posts.length} replies (thread now ${thread.posts.length} posts).`);
    return;
  }

  const topic = PARLEY_TOPICS[existing.threads.length % PARLEY_TOPICS.length];
  console.log(`\nTHE PARLEY round ${existing.threads.length + 1}: "${topic}"\n`);
  const posts = await generate(newThreadPrompt(topic));
  if (!posts) {
    console.error("the parley stayed silent. nothing saved.");
    process.exit(1);
  }
  const thread: ParleyThread = {
    id: existing.threads.length + 1,
    topic,
    ts: new Date().toISOString(),
    posts,
  };
  existing.threads.unshift(thread);
  existing.threads = existing.threads.slice(0, 30);
  saveParley(existing);
  console.log(`saved: ${posts.length} posts.`);
  for (const p of posts.slice(0, 3)) console.log(`  ${p.author}: ${p.text}`);
  console.log("  ...\n");
}

main().catch((err) => {
  console.error("parley failed:", err);
  process.exit(1);
});
