// A development page (puppet-preview.html) that draws a creature's animations as strips of
// frames, so every pose can be checked at a glance. It is not part of the built game.
//   ?c=crimson            all actions, eight frames each
//   ?c=crimson&a=attack   one action, large frames
//   ?c=crimson&play=walk  one action, playing

import { CREATURES } from './index';
import { pointOn, skeletonOrder, solve } from './solve';
import type { ActionState, Creature } from './types';

const atlases = import.meta.glob('../assets/puppets/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

const ACTIONS = ['idle', 'walk', 'attack', 'channel', 'release', 'hit', 'death'] as const;
type Action = (typeof ACTIONS)[number];

/** The state at fraction `f` (0..1) through an action. */
function stateAt(action: Action, f: number): ActionState {
  const s: ActionState = { time: 0.4 + f * 3.2, walk: 0, moving: 0, attack: -1, channel: -1, release: -1, hit: 0, hitDir: 1, death: -1, deathDir: 1 };
  if (action === 'walk') {
    s.walk = f * Math.PI * 2;
    s.moving = 1;
  }
  if (action === 'attack') s.attack = f;
  if (action === 'channel') s.channel = f;
  if (action === 'release') s.release = f;
  if (action === 'hit') s.hit = 1 - f;
  if (action === 'death') s.death = f;
  return s;
}

function draw(ctx: CanvasRenderingContext2D, creature: Creature, atlas: HTMLImageElement, state: ActionState, x: number, feet: number, scale: number): void {
  const order = skeletonOrder(creature.rig);
  const placed = solve(creature.rig, creature.animate(state), order);
  const byName = new Map(order.map((p) => [p.name, p]));
  for (const part of creature.rig.parts) {
    const p = placed.get(part.name)!;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.a));
    ctx.translate(x + p.x * scale, feet + p.y * scale);
    ctx.rotate(p.r);
    ctx.scale(scale * p.k * p.sx, scale * p.k * p.sy);
    const [fx, fy, fw, fh] = part.frame;
    ctx.drawImage(atlas, fx, fy, fw, fh, part.offset[0] - part.pivot[0], part.offset[1] - part.pivot[1], fw, fh);
    ctx.restore();
  }
  for (const glow of creature.glows ?? []) {
    const part = byName.get(glow.part)!;
    const p = placed.get(glow.part)!;
    const [gx, gy] = pointOn(part, p, glow.at);
    const r = glow.r * p.k * scale;
    const grad = ctx.createRadialGradient(x + gx * scale, feet + gy * scale, 0, x + gx * scale, feet + gy * scale, r);
    const hex = `#${glow.colour.toString(16).padStart(6, '0')}`;
    grad.addColorStop(0, `${hex}cc`);
    grad.addColorStop(1, `${hex}00`);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = p.a;
    ctx.fillStyle = grad;
    ctx.fillRect(x + gx * scale - r, feet + gy * scale - r, r * 2, r * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

async function main(): Promise<void> {
  const q = new URLSearchParams(location.search);
  const look = q.get('c') ?? 'crimson';
  const creature = CREATURES[look];
  const atlas = new Image();
  atlas.src = atlases[`../assets/puppets/${look}.webp`];
  await atlas.decode();

  const only = (q.get('a') ?? q.get('play')) as Action | null;
  const rows: readonly Action[] = only ? [only] : ACTIONS;
  const playing = q.has('play');
  const cols = playing ? 1 : only ? 4 : 8;
  const lines = playing ? 1 : only ? 2 : rows.length;
  const width = Number(q.get('w') ?? 1600);
  const cellW = width / cols;
  const cellH = Number(q.get('h') ?? (only ? 520 : 250));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = cellH * lines;
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const scale = Math.min((cellH * 0.72) / creature.rig.height, (cellW * 0.46) / creature.halfWidth);

  const frame = (f: number, action: Action, col: number, line: number): void => {
    const x = col * cellW + cellW / 2, feet = line * cellH + cellH * 0.92;
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(col * cellW + 6, feet);
    ctx.lineTo((col + 1) * cellW - 6, feet);
    ctx.stroke();
    draw(ctx, creature, atlas, stateAt(action, f), x, feet, scale);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    ctx.fillText(`${action} ${f.toFixed(2)}`, col * cellW + 6, line * cellH + 16);
  };
  const clear = (): void => {
    ctx.fillStyle = '#46606e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  if (playing) {
    const start = performance.now();
    const loop = (): void => {
      const t = (performance.now() - start) / 1000;
      clear();
      const length = only === 'walk' ? 1.4 : only === 'idle' ? 3 : 2;
      frame((t / length) % 1, only!, 0, 0);
      requestAnimationFrame(loop);
    };
    loop();
    return;
  }
  clear();
  if (only) {
    const picks = (q.get('f') ?? '0,0.15,0.3,0.45,0.6,0.68,0.82,1').split(',').map(Number);
    picks.slice(0, cols * lines).forEach((f, i) => frame(f, only, i % cols, Math.floor(i / cols)));
  } else {
    rows.forEach((action, line) => {
      for (let col = 0; col < cols; col++) {
        const loops = action === 'walk' || action === 'idle';
        frame(loops ? col / cols : col / (cols - 1), action, col, line);
      }
    });
  }
  document.title = `ready ${look}`;
}

void main();
