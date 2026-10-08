import "server-only";

import { randomBytes, timingSafeEqual } from "node:crypto";
import { ensureReady, getSql } from "@/lib/db/client";

/**
 * CRAZY GOAL duels.
 *
 * A duel is five rounds between two players. In each round both players set a
 * trap in front of their own goal, then each takes one shot at the other's.
 * Nothing here is real time: every move is one write, and clients poll.
 *
 * Players are anonymous. A browser asks for an id once and keeps the secret
 * that came with it; the id is what a friend types in to challenge them.
 * The game is the authority on what a shot did (it runs the physics), so this
 * is a scoreboard for friends, not an anti-cheat system.
 */

export const DUEL_ROUNDS = 5;

/** No look-alike characters, so an id can be read out loud or typed from a screenshot. */
const ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const PLAYER_ID_LENGTH = 6;
const PIECE_TYPES = new Set(["tyre", "crate", "car", "glass"]);
const MAX_PIECES = 4;
const MAX_PATH_NUMBERS = 900;
const MAX_NEW_DUELS_PER_HOUR = 30;

export class DuelError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
  ) {
    super(code);
  }
}

export interface DuelPlayer {
  id: string;
  name: string;
}

interface Piece {
  type: string;
  x: number;
  y: number;
}

interface Shot {
  goal: boolean;
  score: number;
  /** Flat x, y pairs; a null pair is a break in the line. */
  path: (number | null)[];
  /** Where the keeper stood at each path point, when there was one. */
  keeper: (number | null)[];
}

interface Round {
  def: [Piece[] | null, Piece[] | null];
  shot: [Shot | null, Shot | null];
}

export interface Duel {
  id: string;
  seed: number;
  players: [DuelPlayer, DuelPlayer];
  rounds: Round[];
  updatedAt: string;
}

interface DuelRow {
  id: string;
  player_a: string;
  player_b: string;
  name_a: string | null;
  name_b: string | null;
  seed: number;
  state: { rounds: Round[] };
  updated_at: string;
}

function randomId(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return out;
}

export function cleanId(value: unknown): string {
  return typeof value === "string" ? value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12) : "";
}

function cleanName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[^\p{L}\p{N} _.]/gu, "").trim().slice(0, 14).toUpperCase();
}

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

const SELECT_DUEL = `
  select d.id, d.player_a, d.player_b, d.seed, d.state, d.updated_at,
         pa.name as name_a, pb.name as name_b
    from duels d
    left join duel_players pa on pa.id = d.player_a
    left join duel_players pb on pb.id = d.player_b`;

function toDuel(row: DuelRow): Duel {
  return {
    id: row.id,
    seed: row.seed,
    players: [
      { id: row.player_a, name: row.name_a ?? "" },
      { id: row.player_b, name: row.name_b ?? "" },
    ],
    rounds: row.state.rounds,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** Checks the id and secret, and notes that the player was here. */
async function authenticate(id: unknown, secret: unknown): Promise<DuelPlayer> {
  const playerId = cleanId(id);
  if (!playerId || typeof secret !== "string") throw new DuelError("unknown_player", 401);
  const rows = (await getSql().query(`select id, secret, name from duel_players where id = $1`, [playerId])) as {
    id: string;
    secret: string;
    name: string;
  }[];
  const row = rows[0];
  if (!row || !sameSecret(row.secret, secret)) throw new DuelError("unknown_player", 401);
  return { id: row.id, name: row.name };
}

/**
 * Returns the caller's player, creating one if they have none (or if what they
 * sent no longer matches anything). The secret is only ever sent back here.
 */
export async function hello(input: { id?: unknown; secret?: unknown; name?: unknown }): Promise<DuelPlayer & { secret: string }> {
  await ensureReady();
  const sql = getSql();
  const name = cleanName(input.name);

  if (input.id && typeof input.secret === "string") {
    try {
      const player = await authenticate(input.id, input.secret);
      const kept = name || player.name;
      await sql.query(`update duel_players set name = $2, seen_at = now() where id = $1`, [player.id, kept]);
      return { id: player.id, name: kept, secret: input.secret };
    } catch {
      /* fall through and issue a fresh identity */
    }
  }

  const secret = randomBytes(18).toString("hex");
  for (let attempt = 0; attempt < 6; attempt++) {
    const id = randomId(PLAYER_ID_LENGTH);
    const rows = (await sql.query(
      `insert into duel_players (id, secret, name) values ($1, $2, $3) on conflict (id) do nothing returning id`,
      [id, secret, name],
    )) as { id: string }[];
    if (rows.length > 0) return { id, name, secret };
  }
  throw new DuelError("try_again", 503);
}

export async function challenge(input: { id?: unknown; secret?: unknown; opponent?: unknown }): Promise<Duel> {
  await ensureReady();
  const sql = getSql();
  const me = await authenticate(input.id, input.secret);
  const opponent = cleanId(input.opponent);
  if (!opponent) throw new DuelError("no_such_player", 404);
  if (opponent === me.id) throw new DuelError("that_is_you");

  const found = (await sql.query(`select id from duel_players where id = $1`, [opponent])) as { id: string }[];
  if (found.length === 0) throw new DuelError("no_such_player", 404);

  const [{ count }] = (await sql.query(
    `select count(*) as count from duels where player_a = $1 and created_at > now() - interval '1 hour'`,
    [me.id],
  )) as { count: string }[];
  if (Number(count) >= MAX_NEW_DUELS_PER_HOUR) throw new DuelError("slow_down", 429);

  const rounds: Round[] = Array.from({ length: DUEL_ROUNDS }, () => ({ def: [null, null], shot: [null, null] }));
  const id = randomId(10);
  const seed = randomBytes(4).readUInt32BE(0) & 0x7fffffff;
  await sql.query(`insert into duels (id, player_a, player_b, seed, state) values ($1, $2, $3, $4, $5::jsonb)`, [
    id,
    me.id,
    opponent,
    seed,
    JSON.stringify({ rounds }),
  ]);
  return getDuel(id, me.id);
}

async function getDuel(duelId: string, playerId: string): Promise<Duel> {
  const rows = (await getSql().query(`${SELECT_DUEL} where d.id = $1 and (d.player_a = $2 or d.player_b = $2)`, [
    duelId,
    playerId,
  ])) as DuelRow[];
  if (rows.length === 0) throw new DuelError("no_such_duel", 404);
  return toDuel(rows[0]);
}

export async function get(input: { id?: unknown; secret?: unknown; duel?: unknown }): Promise<Duel> {
  await ensureReady();
  const me = await authenticate(input.id, input.secret);
  return getDuel(cleanId(input.duel), me.id);
}

/** The caller's most recent duels, newest activity first. */
export async function list(input: { id?: unknown; secret?: unknown }): Promise<Duel[]> {
  await ensureReady();
  const me = await authenticate(input.id, input.secret);
  const rows = (await getSql().query(
    `${SELECT_DUEL} where d.player_a = $1 or d.player_b = $1 order by d.updated_at desc limit 12`,
    [me.id],
  )) as DuelRow[];
  return rows.map(toDuel);
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseDefence(data: unknown): Piece[] {
  if (!Array.isArray(data) || data.length > MAX_PIECES) throw new DuelError("bad_move");
  return data.map((piece: unknown) => {
    const p = piece as Partial<Piece> | null;
    if (!p || typeof p.type !== "string" || !PIECE_TYPES.has(p.type) || !finite(p.x) || !finite(p.y)) {
      throw new DuelError("bad_move");
    }
    return { type: p.type, x: Math.round(p.x), y: Math.round(p.y) };
  });
}

function parseNumbers(data: unknown, max: number): (number | null)[] {
  if (!Array.isArray(data) || data.length > max) throw new DuelError("bad_move");
  return data.map((v: unknown) => (finite(v) ? Math.round(v) : null));
}

function parseShot(data: unknown): Shot {
  const s = data as Partial<Shot> | null;
  if (!s || typeof s.goal !== "boolean" || !finite(s.score)) throw new DuelError("bad_move");
  return {
    goal: s.goal,
    score: s.goal ? Math.max(0, Math.min(200000, Math.round(s.score))) : 0,
    path: parseNumbers(s.path, MAX_PATH_NUMBERS),
    keeper: parseNumbers(s.keeper ?? [], MAX_PATH_NUMBERS / 2),
  };
}

/**
 * Records a trap or a shot. Each slot can be written once: the update only
 * lands while the slot is still empty, so a double submit or a second tab
 * cannot change a move that was already made.
 */
export async function move(input: {
  id?: unknown;
  secret?: unknown;
  duel?: unknown;
  round?: unknown;
  kind?: unknown;
  data?: unknown;
}): Promise<Duel> {
  await ensureReady();
  const sql = getSql();
  const me = await authenticate(input.id, input.secret);
  const duel = await getDuel(cleanId(input.duel), me.id);
  const side = duel.players[0].id === me.id ? 0 : 1;
  const round = input.round;
  if (typeof round !== "number" || !Number.isInteger(round) || round < 0 || round >= DUEL_ROUNDS) {
    throw new DuelError("bad_move");
  }

  let value: Piece[] | Shot;
  if (input.kind === "def") {
    value = parseDefence(input.data);
  } else if (input.kind === "shot") {
    // You can only shoot at a trap that exists.
    if (!duel.rounds[round].def[1 - side]) throw new DuelError("too_early", 409);
    value = parseShot(input.data);
  } else {
    throw new DuelError("bad_move");
  }

  const path = ["rounds", String(round), input.kind, String(side)];
  await sql.query(
    `update duels
        set state = jsonb_set(state, $2::text[], $3::jsonb), updated_at = now()
      where id = $1 and state #> $2::text[] = 'null'::jsonb`,
    [duel.id, path, JSON.stringify(value)],
  );
  return getDuel(duel.id, me.id);
}
