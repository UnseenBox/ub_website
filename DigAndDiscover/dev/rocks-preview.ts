import { EXTERIORS } from '../src/data/exteriors';
import { MINERALS, type MineralDef } from '../src/data/minerals';
import { RARITIES, type RarityDef } from '../src/data/rarities';
import { drawInside, drawOutside } from '../src/art/RockArt';
import { generateRock } from '../src/systems/RockGenerator';
import { mulberry32 } from '../src/core/Random';
import type { Rock } from '../src/core/types';

const SIZE = 160;

function rarityOf(id: string): RarityDef {
  const found = RARITIES.find((r) => r.id === id);
  if (!found) throw new Error(`Unknown rarity "${id}"`);
  return found;
}

/** A stable preview rock for a mineral: fixed seed, size 1, no sparkle. */
function previewRock(mineral: MineralDef, index: number): Rock {
  const exteriorId = mineral.exteriors?.[0] ?? EXTERIORS[index % EXTERIORS.length].id;
  const exterior = EXTERIORS.find((e) => e.id === exteriorId) ?? EXTERIORS[0];
  return {
    id: `preview-${mineral.id}`,
    seed: 1000 + index * 37,
    exterior,
    mineral,
    rarity: rarityOf(mineral.rarity),
    size: 1,
    value: mineral.value[0],
    sparkly: false,
    cut: false,
    layer: 0,
    valueMult: 1,
  };
}

function paint(canvas: HTMLCanvasElement, draw: (ctx: CanvasRenderingContext2D) => void): void {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, SIZE, SIZE);
  draw(ctx);
}

function card(mineral: MineralDef, index: number): HTMLElement {
  const rock = previewRock(mineral, index);
  const el = document.createElement('div');
  el.className = 'card';

  const canvases = document.createElement('div');
  canvases.className = 'canvases';
  const inside = document.createElement('canvas');
  const outside = document.createElement('canvas');
  canvases.appendChild(inside);
  canvases.appendChild(outside);

  paint(inside, (ctx) => drawInside(ctx, rock, SIZE));
  paint(outside, (ctx) => drawOutside(ctx, rock, SIZE));

  const name = document.createElement('div');
  name.className = 'name';
  name.textContent = mineral.name;

  const rarity = document.createElement('span');
  rarity.className = 'tag';
  rarity.textContent = mineral.rarity;
  rarity.style.background = rarityOf(mineral.rarity).css;
  rarity.style.color = '#12120f';

  const meta = document.createElement('div');
  meta.className = 'meta';
  const value = mineral.value[0] === mineral.value[1] ? `$${mineral.value[0]}` : `$${mineral.value[0]}-$${mineral.value[1]}`;
  meta.appendChild(rarity);
  meta.appendChild(document.createTextNode(` ${value} | style ${mineral.style} | minLayer ${mineral.minLayer ?? 0}`));

  const reveal = document.createElement('div');
  reveal.className = 'meta';
  reveal.textContent = `reveal: ${mineral.reveal ?? 'dust'}`;

  el.appendChild(canvases);
  el.appendChild(name);
  el.appendChild(meta);
  el.appendChild(reveal);
  return el;
}

function countTable(): void {
  const table = document.getElementById('counts');
  if (!table) return;
  table.innerHTML = '';
  const head = document.createElement('tr');
  for (const label of ['Rarity', 'Minerals', 'Rolled at layer 0', 'Rolled at layer 9', 'Zero value share L0', 'Zero value share L9']) {
    const th = document.createElement('th');
    th.textContent = label;
    head.appendChild(th);
  }
  table.appendChild(head);

  const rolls = 5000;
  const layers = [0, 9];
  const counts = layers.map(() => new Map<string, number>());
  const zero = layers.map(() => ({ zero: 0, total: 0 }));
  for (let li = 0; li < layers.length; li++) {
    const rng = mulberry32(99991 + li);
    for (let i = 0; i < rolls; i++) {
      const rock = generateRock(rng, undefined, 1, layers[li]);
      counts[li].set(rock.rarity.id, (counts[li].get(rock.rarity.id) ?? 0) + 1);
      zero[li].total++;
      if (rock.value === 0) zero[li].zero++;
    }
  }

  for (const rarity of RARITIES) {
    const row = document.createElement('tr');
    const cells = [
      rarity.label,
      String(MINERALS.filter((m) => m.rarity === rarity.id).length),
      String(counts[0].get(rarity.id) ?? 0),
      String(counts[1].get(rarity.id) ?? 0),
      `${((zero[0].zero / zero[0].total) * 100).toFixed(1)}%`,
      `${((zero[1].zero / zero[1].total) * 100).toFixed(1)}%`,
    ];
    for (const value of cells) {
      const td = document.createElement('td');
      td.textContent = value;
      row.appendChild(td);
    }
    table.appendChild(row);
  }
}

function main(): void {
  const root = document.getElementById('root');
  if (!root) return;
  countTable();
  let index = 0;
  for (const rarity of RARITIES) {
    const group = MINERALS.filter((m) => m.rarity === rarity.id);
    if (group.length === 0) continue;
    const heading = document.createElement('h2');
    heading.textContent = `${rarity.label} (${group.length})`;
    heading.style.color = rarity.css;
    root.appendChild(heading);
    const grid = document.createElement('div');
    grid.className = 'grid';
    for (const mineral of group) grid.appendChild(card(mineral, index++));
    root.appendChild(grid);
  }
}

main();
