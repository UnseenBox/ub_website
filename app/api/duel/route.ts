import { hasDatabase } from "@/lib/db/client";
import { challenge, DuelError, get, hello, list, move } from "@/lib/duel/store";

/**
 * The whole CRAZY GOAL duel API: one endpoint, an `action` in the JSON body.
 * The game is a static build served from this same origin (public/arcade),
 * so there is no CORS to configure and no cookie involved: a player proves
 * who they are with the id and secret the `hello` action gave them.
 */

const MAX_BODY_BYTES = 48 * 1024;

const ACTIONS = { hello, challenge, get, list, move } as const;

const isAction = (value: unknown): value is keyof typeof ACTIONS =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(ACTIONS, value);

function reply(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  if (!hasDatabase()) return reply({ error: "no_database" }, 503);

  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return reply({ error: "too_large" }, 413);

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: "bad_json" }, 400);
  }

  const action = body.action;
  if (!isAction(action)) return reply({ error: "unknown_action" }, 400);

  try {
    return reply({ ok: true, result: await ACTIONS[action](body) });
  } catch (error) {
    if (error instanceof DuelError) return reply({ error: error.code }, error.status);
    console.error("duel api", action, error);
    return reply({ error: "server_error" }, 500);
  }
}
