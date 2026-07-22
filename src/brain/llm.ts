/**
 * Free brain option: any OpenAI compatible endpoint works as the crew's brain,
 * so the ship does not depend on a paid Anthropic key to sail.
 *
 * Set PIRATE_API_BASE + PIRATE_API_MODEL (+ PIRATE_API_KEY unless local) and
 * both decide.ts and crowd.ts switch to this path automatically. Examples in
 * .env.example: OpenRouter free models, Groq, Gemini's OpenAI endpoint, or a
 * local Ollama (100% free, no key).
 */

export function openAiCompatConfigured(): boolean {
  return Boolean(process.env.PIRATE_API_BASE && process.env.PIRATE_API_MODEL);
}

/** Which brain is thinking, for the provenance log. */
export function brainId(): string {
  if (openAiCompatConfigured()) return String(process.env.PIRATE_API_MODEL);
  return process.env.PIRATE_MODEL ?? "claude-opus-4-8";
}

async function request(body: object): Promise<Response> {
  const base = (process.env.PIRATE_API_BASE ?? "").replace(/\/+$/, "");
  return fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.PIRATE_API_KEY
        ? { Authorization: `Bearer ${process.env.PIRATE_API_KEY}` }
        : {}),
    },
    body: JSON.stringify(body),
  });
}

/** One chat call that must come back as JSON. Returns null on any failure. */
export async function chatJson(system: string, user: string): Promise<unknown | null> {
  const base = {
    model: process.env.PIRATE_API_MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.7,
  };

  // some free endpoints reject response_format, so retry without it
  let res = await request({ ...base, response_format: { type: "json_object" } });
  if (res.status === 400 || res.status === 422) {
    res = await request(base);
  }
  if (!res.ok) {
    console.error(`llm error ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return null;
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) return null;

  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "");
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
