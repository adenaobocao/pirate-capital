import crypto from "node:crypto";

/**
 * Owner authentication and closed mode.
 *
 * Closed mode (CLOSED_MODE=true) makes EVERY api function owner-only: reads and
 * writes both require the owner key. Without it, requests get 403 {closed:true}
 * and the site renders a "harbor closed" state. The owner unlocks once in the
 * browser (thepirate.capital/#unlock) and the key rides along on every fetch.
 *
 * The key is compared in constant time and only ever lives in env + the owner's
 * browser localStorage. It is never in the repo, never in a deploy artifact,
 * never logged.
 */

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) {
    // still burn time against a fixed-size buffer to avoid a length oracle
    crypto.timingSafeEqual(Buffer.alloc(32), Buffer.alloc(32));
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

/** The presented key, from header or query. Header is preferred. */
function presentedKey(request) {
  try {
    const h = request.headers.get("x-pirate-key");
    if (h) return h;
    const url = new URL(request.url);
    return url.searchParams.get("k") ?? "";
  } catch {
    return "";
  }
}

export function isClosed() {
  return process.env.CLOSED_MODE === "true";
}

/**
 * Cache-Control for a success response. In closed mode the response is
 * authenticated and MUST NOT hit the shared CDN cache, or a cached owner
 * response would leak to anyone. Falls back to the public value when open.
 */
export function cacheFor(publicValue) {
  return isClosed() ? "private, no-store" : publicValue;
}

export function isOwner(request) {
  const key = process.env.OWNER_KEY;
  if (!key) return false;
  return timingSafeEqual(presentedKey(request), key);
}

/**
 * The gate. Call at the top of every handler.
 * Returns a Response to short-circuit with, or null to proceed.
 */
export function gate(request) {
  if (!isClosed()) return null;
  if (!process.env.OWNER_KEY) {
    return new Response(JSON.stringify({ error: "closed mode misconfigured (no owner key set)" }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  if (isOwner(request)) return null;
  return new Response(JSON.stringify({ closed: true, error: "the harbor is closed. owner only." }), {
    status: 403,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "WWW-Authenticate": "PirateKey",
    },
  });
}
