import { EXPERIENCE_COLUMNS, GAME_COLUMNS, SERVICE_COLUMNS } from "./rows";

/**
 * Upsert statements, derived from the column lists so the placeholders can
 * never drift out of sync with the columns they fill.
 */

const columnList = (columns: string): string[] =>
  columns
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);

function upsert(table: string, columns: string): string {
  const names = columnList(columns);
  const placeholders = names.map((_, index) => `$${index + 1}`).join(", ");
  const updates = names
    .filter((name) => name !== "id")
    .map((name) => `${name} = excluded.${name}`)
    .join(", ");
  return `insert into ${table} (${names.join(", ")}) values (${placeholders})
          on conflict (id) do update set ${updates}`;
}

export const UPSERT_GAME = upsert("games", GAME_COLUMNS);
export const UPSERT_SERVICE = upsert("services", SERVICE_COLUMNS);
export const UPSERT_EXPERIENCE = upsert("experiences", EXPERIENCE_COLUMNS);

export const UPSERT_STUDIO = `insert into studio (singleton, data, updated_at)
  values (true, $1, now())
  on conflict (singleton) do update set data = excluded.data, updated_at = now()`;

/** Bumps the content version and stamps the time of the change. */
export const TOUCH_META = `insert into site_meta (singleton, version, updated_at)
  values (true, 1, now())
  on conflict (singleton) do update set version = site_meta.version + 1, updated_at = now()`;
