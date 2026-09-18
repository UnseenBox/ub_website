/**
 * Neon Postgres schema.
 *
 * One table per content type, so every game / service / archive entry is a
 * real row that can be queried, ordered and constrained by the database.
 * Localized text ({ en, fr, ar }) and short nested lists (links, dev notes,
 * screenshots…) are stored as JSONB: they are always read and written with
 * their parent row, so splitting them into further tables would buy nothing.
 *
 * Every statement is idempotent — `ensureReady()` runs them on the first
 * query of a process, and `npm run db:setup` runs them from the terminal.
 */

export const SCHEMA_STATEMENTS: string[] = [
  `create table if not exists site_meta (
     singleton boolean primary key default true check (singleton),
     version integer not null default 1,
     updated_at timestamptz not null default now()
   )`,

  `create table if not exists studio (
     singleton boolean primary key default true check (singleton),
     data jsonb not null,
     updated_at timestamptz not null default now()
   )`,

  `create table if not exists settings (
     singleton boolean primary key default true check (singleton),
     data jsonb not null,
     updated_at timestamptz not null default now()
   )`,

  `create table if not exists games (
     id text primary key,
     slug text not null unique,
     title text not null default '',
     status text not null default 'released',
     release_date text,
     estimated_release jsonb,
     progress integer,
     tagline jsonb not null default '{}'::jsonb,
     summary jsonb not null default '{}'::jsonb,
     description jsonb not null default '{}'::jsonb,
     genre jsonb not null default '{}'::jsonb,
     platforms jsonb not null default '[]'::jsonb,
     poster text not null default '',
     cover text not null default '',
     screenshots jsonb not null default '[]'::jsonb,
     trailer_url text,
     links jsonb not null default '[]'::jsonb,
     features jsonb not null default '[]'::jsonb,
     dev_notes jsonb not null default '[]'::jsonb,
     engine text,
     accent text,
     featured boolean not null default false,
     upcoming boolean not null default false,
     sort_order integer not null default 0,
     updated_at timestamptz not null default now()
   )`,

  `create table if not exists services (
     id text primary key,
     title jsonb not null default '{}'::jsonb,
     kicker jsonb not null default '{}'::jsonb,
     description jsonb not null default '{}'::jsonb,
     deliverables jsonb not null default '[]'::jsonb,
     glyph text not null default 'cube',
     sort_order integer not null default 0,
     updated_at timestamptz not null default now()
   )`,

  `create table if not exists experiences (
     id text primary key,
     slug text not null unique,
     title jsonb not null default '{}'::jsonb,
     type text not null default 'client',
     date text not null default '',
     location jsonb not null default '{}'::jsonb,
     client text,
     summary jsonb not null default '{}'::jsonb,
     body jsonb not null default '{}'::jsonb,
     cover text not null default '',
     images jsonb not null default '[]'::jsonb,
     link text,
     sort_order integer not null default 0,
     updated_at timestamptz not null default now()
   )`,

  `create table if not exists messages (
     id text primary key,
     name text not null,
     email text not null,
     topic text not null,
     message text not null,
     locale text not null default 'en',
     created_at timestamptz not null default now(),
     read boolean not null default false
   )`,

  `create table if not exists reviews (
     id text primary key,
     game_id text not null,
     game_slug text not null default '',
     game_title text not null default '',
     name text not null,
     email text,
     rating integer not null check (rating between 1 and 5),
     body text not null default '',
     locale text not null default 'en',
     status text not null default 'pending',
     reply text,
     created_at timestamptz not null default now()
   )`,

  `create index if not exists games_sort_order_idx on games (sort_order)`,
  `create index if not exists services_sort_order_idx on services (sort_order)`,
  `create index if not exists experiences_date_idx on experiences (date desc, sort_order)`,
  `create index if not exists messages_created_at_idx on messages (created_at desc)`,
  `create index if not exists reviews_game_status_idx on reviews (game_id, status)`,
  `create index if not exists reviews_created_at_idx on reviews (created_at desc)`,
];

/** Postgres error code for a unique-constraint violation (duplicate slug). */
export const UNIQUE_VIOLATION = "23505";
