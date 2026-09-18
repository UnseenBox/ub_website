/**
 * Connection check: `npm run db:check`
 *
 * Confirms the Neon database is reachable and reports what it holds. The
 * tables themselves are created automatically the first time the site queries
 * the database, so this script only reads.
 *
 * Reads DATABASE_URL from the environment, falling back to .env.local.
 */

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

function loadEnvLocal() {
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local — rely on the real environment
  }
}

loadEnvLocal();

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL found. Add it to .env.local, or export it before running this script.");
  process.exit(1);
}

const sql = neon(url);
const TABLES = ["studio", "games", "services", "experiences", "messages", "site_meta"];

try {
  const [{ version }] = await sql`select version()`;
  console.log(`Connected: ${version.split(",")[0]}`);

  const existing = await sql`
    select table_name from information_schema.tables where table_schema = 'public'`;
  const names = new Set(existing.map((row) => row.table_name));

  if (names.size === 0) {
    console.log("\nNo tables yet. They are created automatically on the site's first database query.");
  }

  for (const table of TABLES) {
    if (!names.has(table)) {
      console.log(`  ${table.padEnd(12)} —  not created yet`);
      continue;
    }
    const [{ count }] = await sql.query(`select count(*)::int as count from ${table}`);
    console.log(`  ${table.padEnd(12)} ${String(count).padStart(4)} row${count === 1 ? "" : "s"}`);
  }
} catch (error) {
  console.error(`\nConnection failed: ${error.message}`);
  process.exit(1);
}
