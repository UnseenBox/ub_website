import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { seedContent } from "@/data/seed";
import { experienceParams, gameParams, json, serviceParams } from "./rows";
import { SCHEMA_STATEMENTS } from "./schema";
import { TOUCH_META, UPSERT_EXPERIENCE, UPSERT_GAME, UPSERT_SERVICE, UPSERT_STUDIO } from "./statements";

/**
 * Neon connection.
 *
 * Queries travel over Neon's HTTP endpoint, so there is no connection pool to
 * manage and serverless functions pay no handshake cost per invocation.
 *
 * Vercel's Neon integration provides DATABASE_URL; POSTGRES_URL and
 * NEON_DATABASE_URL are accepted too, so a database connected by any route
 * works without renaming anything.
 */

export function databaseUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    undefined
  );
}

export const hasDatabase = (): boolean => Boolean(databaseUrl());

let client: NeonQueryFunction<false, false> | undefined;

export function getSql(): NeonQueryFunction<false, false> {
  if (client) return client;
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set — no Neon database is connected.");
  client = neon(url);
  return client;
}

/* ------------------------------------------------------------------ */

let ready: Promise<void> | undefined;

/**
 * Creates the tables on first use and imports the seed content into an empty
 * database, so a fresh Neon project needs no manual migration step. Runs once
 * per process; every store call awaits it.
 */
export function ensureReady(): Promise<void> {
  ready ??= bootstrap().catch((error) => {
    ready = undefined; // let the next request retry rather than stay broken
    throw error;
  });
  return ready;
}

async function bootstrap(): Promise<void> {
  const sql = getSql();
  for (const statement of SCHEMA_STATEMENTS) {
    await sql.query(statement);
  }
  const [{ count }] = (await sql.query(
    `select (select count(*) from games) + (select count(*) from studio) as count`,
  )) as { count: string }[];
  if (Number(count) === 0) await importSeed();
}

/** Writes the built-in seed content. Safe to re-run: every write is an upsert. */
export async function importSeed(): Promise<void> {
  const sql = getSql();
  await sql.query(UPSERT_STUDIO, [json(seedContent.studio)]);
  for (const game of seedContent.games) await sql.query(UPSERT_GAME, gameParams(game));
  for (const service of seedContent.services) await sql.query(UPSERT_SERVICE, serviceParams(service));
  for (const experience of seedContent.experiences) {
    await sql.query(UPSERT_EXPERIENCE, experienceParams(experience));
  }
  await sql.query(TOUCH_META);
}
