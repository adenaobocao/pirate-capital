import {
  MAX_PIRATES,
  RISK_PRESETS,
  STARTING_CASH,
  hashToken,
  moderateName,
  moderatePhilosophy,
  newId,
  newToken,
  readJson,
  writeJson,
} from "./_fleet.js";
import { gate, cacheFor } from "./_auth.js";

/**
 * The fleet, lookout mode (paper only, zero friction):
 *   GET  /api/fleet            -> leaderboard
 *   GET  /api/fleet?id=<id>    -> one pirate, public record
 *   POST /api/fleet            -> set sail {name, philosophy, risk, forkOf?}
 *
 * No brains here: user pirates think on the ship's own model every few hours
 * (src/fleet-tick.ts, run by the captain's cron). The browser never needs a
 * key and this endpoint never executes trades, so the attack surface is
 * creation and reading only.
 */

const INDEX = "fleet/index.json";

function json(body, status = 200, cache = "no-store") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheFor(cache),
    },
  });
}

export async function GET(request) {
  const closed = gate(request);
  if (closed) return closed;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    if (!/^[a-z0-9_-]{3,40}$/.test(id)) return json({ error: "bad id" }, 400);
    const pirate = await readJson(`fleet/pirates/${id}.json`);
    if (!pirate) return json({ error: "no such pirate" }, 404);
    const { tokenHash, ...pub } = pirate;
    return json(pub, 200, "s-maxage=60, stale-while-revalidate=120");
  }

  const index = (await readJson(INDEX)) ?? { pirates: [] };
  const board = [...index.pirates]
    .sort((a, b) => b.equity - a.equity)
    .slice(0, 100);
  return json(
    { count: index.pirates.length, board },
    200,
    "s-maxage=120, stale-while-revalidate=300",
  );
}

export async function POST(request) {
  const closed = gate(request);
  if (closed) return closed;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad json" }, 400);
  }

  const name = moderateName(body.name);
  if (!name.ok) return json({ error: name.error }, 400);
  const philosophy = moderatePhilosophy(body.philosophy);
  if (!philosophy.ok) return json({ error: philosophy.error }, 400);
  const risk = RISK_PRESETS[body.risk] ? String(body.risk) : "classic";

  const index = (await readJson(INDEX)) ?? { pirates: [] };
  if (index.pirates.length >= MAX_PIRATES) {
    return json({ error: "the harbor is full for now. next wave soon." }, 429);
  }
  if (index.pirates.some((p) => p.name === name.value)) {
    return json({ error: "a pirate already sails under that name" }, 409);
  }

  let forkOf = null;
  if (body.forkOf) {
    const parent = await readJson(`fleet/pirates/${String(body.forkOf)}.json`);
    if (parent) forkOf = parent.id;
  }

  const id = newId(name.value);
  const token = newToken();
  const now = new Date().toISOString();
  const pirate = {
    id,
    name: name.value,
    philosophy: philosophy.value,
    risk,
    forkOf,
    createdAt: now,
    tokenHash: hashToken(token),
    lastTick: null,
    state: {
      cash: STARTING_CASH,
      positions: {},
      trades: [],
      equityCurve: [],
      lastCommentary: "",
    },
  };

  await writeJson(`fleet/pirates/${id}.json`, pirate);
  index.pirates.push({
    id,
    name: name.value,
    philosophy: philosophy.value,
    risk,
    forkOf,
    createdAt: now,
    equity: STARTING_CASH,
    pnlPct: 0,
    raids: 0,
    lastTick: null,
  });
  await writeJson(INDEX, index);

  return json({
    id,
    token,
    note: "this is your boarding pass. save it. it is shown exactly once.",
  });
}
