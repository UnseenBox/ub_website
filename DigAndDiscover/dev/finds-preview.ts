import { CATEGORY_STYLE, FINDS, FIND_TIER_LABELS, type FindCategory, type FindDef } from '../src/data/finds';
import { paintFind } from '../src/art/FindArt';
import { FindSystem } from '../src/systems/FindSystem';

/**
 * Development page: draws every find and simulates rolls.
 * Open with: npx vite  ->  http://localhost:5173/dev/finds-preview.html
 */

const CANVAS_SIZE = 128;
const SIM_SWINGS = 1000;

const categories: FindCategory[] = ['artifact', 'collection', 'junk'];

function header(): HTMLElement {
  const el = document.getElementById('header');
  if (!el) throw new Error('missing #header');
  const counts = categories.map((c) => FINDS.filter((f) => f.category === c).length);
  el.textContent =
    `Total finds: ${FINDS.length}  |  ` +
    categories.map((c, i) => `${CATEGORY_STYLE[c].label}: ${counts[i]}`).join('  |  ') +
    `  |  Painter keys: ${new Set(FINDS.map((f) => f.art)).size}`;
  return el;
}

function valueText(def: FindDef): string {
  if (!def.value) return 'no value';
  return `$${def.value[0]}-${def.value[1]}`;
}

function card(def: FindDef): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'card';

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) paintFind(ctx, def, CANVAS_SIZE);

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = def.name;

  const meta = document.createElement('div');
  meta.className = 'meta';
  const layerText =
    def.maxLayer !== undefined && def.maxLayer !== def.minLayer
      ? `layers ${def.minLayer}-${def.maxLayer}`
      : `layer ${def.minLayer}`;
  meta.textContent = [
    `id: ${def.id}`,
    `tier ${def.tier} (${FIND_TIER_LABELS[def.tier] ?? '?'})`,
    layerText,
    valueText(def),
    `art: ${def.art}`,
  ].join('\n');
  meta.style.whiteSpace = 'pre-line';

  wrap.appendChild(canvas);
  wrap.appendChild(name);
  wrap.appendChild(meta);
  return wrap;
}

function sections(): void {
  const host = document.getElementById('sections');
  if (!host) throw new Error('missing #sections');

  for (const category of categories) {
    const section = document.createElement('section');
    section.className = category;
    section.id = `${category}-section`;

    const heading = document.createElement('h2');
    heading.textContent = CATEGORY_STYLE[category].label;
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const def of FINDS.filter((f) => f.category === category)) grid.appendChild(card(def));
    section.appendChild(grid);

    host.appendChild(section);
  }
}

function simulator(): void {
  const select = document.getElementById('layer') as HTMLSelectElement | null;
  const button = document.getElementById('roll') as HTMLButtonElement | null;
  const out = document.getElementById('sim-out');
  if (!select || !button || !out) throw new Error('missing simulator elements');

  for (let i = 0; i < 10; i++) {
    const option = document.createElement('option');
    option.value = String(i);
    option.textContent = `Layer ${i}`;
    select.appendChild(option);
  }
  select.value = '0';

  button.addEventListener('click', () => {
    const layer = Number(select.value);
    const system = new FindSystem();
    const counts: Record<FindCategory, number> = { artifact: 0, collection: 0, junk: 0 };
    const tiers: Record<string, number> = {};

    for (let i = 0; i < SIM_SWINGS; i++) {
      const def = system.roll(layer);
      if (!def) continue;
      counts[def.category]++;
      const key = `${def.category} tier ${def.tier}`;
      tiers[key] = (tiers[key] ?? 0) + 1;
    }

    const total = counts.artifact + counts.collection + counts.junk;
    const lines: string[] = [];
    lines.push(`${SIM_SWINGS} swings at layer ${layer}`);
    lines.push(`finds: ${total}  (${((total / SIM_SWINGS) * 100).toFixed(2)} per 100 swings)`);
    lines.push(
      `  artifact: ${counts.artifact} (${((counts.artifact / SIM_SWINGS) * 100).toFixed(2)} per 100 swings)`,
    );
    lines.push(
      `  collection: ${counts.collection} (${((counts.collection / SIM_SWINGS) * 100).toFixed(2)} per 100 swings)`,
    );
    lines.push(`  junk: ${counts.junk} (${((counts.junk / SIM_SWINGS) * 100).toFixed(2)} per 100 swings)`);
    lines.push('share per tier:');
    for (const key of Object.keys(tiers).sort()) {
      const n = tiers[key];
      lines.push(`  ${key}: ${n} (${((n / total) * 100).toFixed(1)}%)`);
    }
    out.textContent = lines.join('\n');
  });
}

header();
sections();
simulator();
