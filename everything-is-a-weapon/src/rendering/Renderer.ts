import { INK, PALETTE } from '../core/constants';
import type { Game } from '../core/Game';
import { TAU, lerp } from '../core/math';
import type { Pet } from '../entities/Pets';
import type { Enemy } from '../entities/Enemy';
import type { PhysicsObject } from '../entities/PhysicsObject';
import type { Player } from '../entities/Player';
import { Layer, type RigidBody } from '../physics/RigidBody';
import { drawPowerRings, drawPowerTags, drawRageVignette } from './CatArt';
import { drawEnemy } from './EnemyArt';
import { registerGadgetArt } from './GadgetArt';
import { registerHouseArt } from './HouseArt';
import { registerMoreArt } from './MoreArt';
import { drawPet } from './PetArt';
import { registerPickupArt } from './PickupArt';
import { drawPlayer } from './PlayerArt';
import { HAND_FONT, SHOUT_FONT, TYPE_FONT, hash, type Ctx } from './draw';
import { drawObject, drawObjectHalo } from './ObjectArt';
import { RoomArt, drawDoor, drawOutlet } from './RoomArt';
import { drawFloorZone, drawOverlayZone } from './ZoneArt';

interface Drawable {
  key: number;
  entity: PhysicsObject | Enemy | Player | Pet;
}

const MAX_DPR = 2;
const rayNormal = { nx: 0, ny: 0 };

export class Renderer {
  readonly debug = { hitboxes: false, grid: false };

  private readonly ctx: Ctx;
  private readonly roomArt = new RoomArt();
  private readonly drawables: Drawable[] = [];
  private drawableCount = 0;
  private time = 0;
  private alpha = 1;
  private cssWidth = 0;
  private cssHeight = 0;

  constructor(private readonly game: Game, private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available in this browser.');
    this.ctx = ctx;
    registerHouseArt();
    registerGadgetArt();
    registerPickupArt();
    registerMoreArt();
    window.addEventListener('resize', () => this.resize());
    // Catches size changes that never raise a window resize (container layout, zoom, DPR change).
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }

  /** Matches the backing store to the CSS size and device pixel ratio; the camera refits the room. */
  resize(): void {
    const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    const pw = Math.max(1, Math.round(width * dpr));
    const ph = Math.max(1, Math.round(height * dpr));
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    this.cssWidth = width;
    this.cssHeight = height;
    this.game.camera.resize(width, height, dpr);
  }

  private bx(b: RigidBody): number {
    return lerp(b.prevX, b.x, this.alpha);
  }

  private by(b: RigidBody): number {
    return lerp(b.prevY, b.y, this.alpha);
  }

  render(alpha: number, frameDt: number): void {
    const game = this.game;
    const ctx = this.ctx;
    const cam = game.camera;
    this.alpha = alpha;
    if (this.canvas.clientWidth !== this.cssWidth || this.canvas.clientHeight !== this.cssHeight) this.resize();
    if (game.state === 'playing' || game.state === 'menu') this.time += frameDt;
    const time = this.time;
    const room = game.room;
    const def = room.def;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    cam.apply(ctx);
    this.roomArt.draw(ctx, def, cam.scale * cam.dpr);

    const pending = room.pending.length > 0;
    const rattle = room.entranceRattle;
    if (rattle > 0.01) {
      // someone is hammering on it
      ctx.save();
      ctx.translate(Math.sin(time * 78) * 2.4 * rattle, Math.cos(time * 93) * 1.5 * rattle);
    }
    drawDoor(ctx, def, def.entrance, room.entranceOpen, PALETTE.coral, pending, time);
    if (rattle > 0.01) ctx.restore();
    drawDoor(ctx, def, def.exit, room.exitOpen, PALETTE.lime, room.cleared, time);

    for (const decal of game.decals) {
      if (decal.kind === 'scuff') {
        // a few scratches where something heavy came down
        ctx.strokeStyle = 'rgba(34, 27, 54, 0.22)';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
          const a = hash(decal.x + i * 3.7) * TAU;
          const r0 = decal.r * (0.3 + hash(decal.y + i) * 0.3);
          const r1 = r0 + 5 + hash(decal.x * 2 + i) * 8;
          ctx.moveTo(decal.x + Math.cos(a) * r0, decal.y + Math.sin(a) * r0 * 0.78);
          ctx.lineTo(decal.x + Math.cos(a + 0.25) * r1, decal.y + Math.sin(a + 0.25) * r1 * 0.78);
        }
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = 'rgba(34, 27, 54, 0.28)';
      ctx.beginPath();
      ctx.ellipse(decal.x, decal.y, decal.r, decal.r * 0.78, 0, 0, TAU);
      ctx.fill();
    }

    const zones = game.zones.zones;
    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i]!;
      if (!zone.alive) continue;
      // a wall socket; a car battery is an "outlet" too but draws itself
      if (zone.tags.has('outlet') && !zone.attached) drawOutlet(ctx, zone, time);
      else drawFloorZone(ctx, zone, time);
    }

    const pb = game.player.body;
    const cat = game.pet;
    const catX = cat ? lerp(cat.prevX, cat.x, alpha) : 0;
    const catY = cat ? lerp(cat.prevY, cat.y, alpha) : 0;
    this.drawRings();
    this.drawWalls(time);
    drawPowerRings(ctx, game, this.bx(pb), this.by(pb), catX, catY, time);
    this.drawShadows();
    this.drawEntities(time);
    drawPowerTags(ctx, game, this.bx(pb), this.by(pb), catX, catY, time);

    for (let i = 0; i < zones.length; i++) {
      const zone = zones[i]!;
      if (zone.alive) drawOverlayZone(ctx, zone, time);
    }

    this.drawParticles();
    if (game.state === 'playing') this.drawAim(time);
    this.drawHint(time);
    this.drawBursts();
    this.drawPopups();
    if (this.debug.hitboxes || this.debug.grid) this.drawDebug();

    // screen-space finish
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const w = this.canvas.width;
    const h = this.canvas.height;
    const player = game.player;
    // Red closes in from the edges when you are hit, and throbs when you are on your last plaster.
    const lastLegs = player.alive && player.hp === 1 && game.state === 'playing' ? 0.16 + 0.1 * Math.sin(time * 5.5) : 0;
    const danger = Math.max(player.hurtFlash * 0.6, lastLegs);
    if (danger > 0.02) {
      const edge = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
      edge.addColorStop(0, 'rgba(229, 56, 59, 0)');
      edge.addColorStop(1, `rgba(229, 56, 59, ${danger.toFixed(3)})`);
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, w, h);
    }
    drawRageVignette(ctx, game, w, h, time);
    const flash = game.fx.flashAlpha * game.camera.shakeScale;
    if (flash > 0.01) {
      ctx.globalAlpha = Math.min(1, flash);
      ctx.fillStyle = game.fx.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    game.cutscene.draw(ctx, w, h);
  }

  /** Interior partitions: flat on the floor under everything, like low room dividers. */
  private drawWalls(time: number): void {
    const walls = this.game.walls;
    if (walls.length === 0) return;
    const ctx = this.ctx;
    for (const wall of walls) {
      const { x, y, hw, hh } = wall;
      const sliding = wall.spec.slide !== undefined;
      // soft shadow on the floor
      ctx.fillStyle = 'rgba(34, 27, 54, 0.25)';
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 5, hw + 4, hh * 0.5 + 4, 0, 0, TAU);
      ctx.fill();
      // block face
      ctx.fillStyle = sliding ? '#4a3b2a' : '#3a3348';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(x - hw, y - hh, hw * 2, hh * 2);
      ctx.fill();
      ctx.stroke();
      // lighter top edge so it reads as something with height
      ctx.fillStyle = sliding ? '#c96f2e' : '#554d6e';
      ctx.fillRect(x - hw + 2, y - hh + 2, hw * 2 - 4, 5);
      if (sliding) {
        // hazard chevrons crawl along a moving wall; direction flips with travel
        const dir = Math.cos((wall.t / wall.spec.slide!.period) * Math.PI * 2) >= 0 ? 1 : -1;
        const off = ((time * 40 * dir) % 28 + 28) % 28;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - hw + 2, y + hh - 12, hw * 2 - 4, 8);
        ctx.clip();
        ctx.fillStyle = '#ffd23f';
        for (let sx = x - hw - 28 + off; sx < x + hw + 28; sx += 28) {
          ctx.beginPath();
          ctx.moveTo(sx, y + hh - 4);
          ctx.lineTo(sx + 9, y + hh - 12);
          ctx.lineTo(sx + 15, y + hh - 12);
          ctx.lineTo(sx + 6, y + hh - 4);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      } else {
        // rivets along a still partition
        ctx.fillStyle = 'rgba(251, 246, 233, 0.5)';
        const nx = Math.max(2, Math.floor(hw / 26));
        for (let i = 0; i < nx; i++) {
          const rx = nx === 1 ? x : x - hw + 14 + ((hw * 2 - 28) * i) / (nx - 1);
          ctx.beginPath();
          ctx.arc(rx, y, 2.2, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  /** Shockwaves, drawn flat on the floor under everything standing on it. */
  private drawRings(): void {
    const ctx = this.ctx;
    for (const ring of this.game.fx.rings) {
      const t = 1 - ring.life / ring.max;
      const eased = 1 - (1 - t) * (1 - t);
      const r = ring.from + (ring.to - ring.from) * eased;
      if (r <= 0.5) continue;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = Math.max(0.6, ring.width * (1 - t * 0.7));
      ctx.beginPath();
      ctx.ellipse(ring.x, ring.y, r, r * 0.78, 0, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Comic-book sound words: a spiky panel that punches in, hangs, and drops away. */
  private drawBursts(): void {
    const ctx = this.ctx;
    for (const b of this.game.fx.bursts) {
      const age = b.max - b.life;
      const pop = age < 0.08 ? 0.35 + (age / 0.08) * 0.95 : 1.3 - Math.min(0.3, (age - 0.08) * 2.6);
      const scale = b.size * pop;
      ctx.save();
      ctx.globalAlpha = Math.min(1, b.life / 0.16);
      ctx.translate(b.x, b.y - (age / b.max) * 12);
      ctx.rotate(b.tilt);
      ctx.scale(scale, scale);
      ctx.font = `italic 400 24px ${SHOUT_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const rx = ctx.measureText(b.word).width / 2 + 17;
      const ry = 21;
      const spikes = 15;
      const panel = (): void => {
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const a = (i / (spikes * 2)) * TAU;
          const r = i % 2 === 0 ? 1.02 + hash(b.seed + i) * 0.34 : 0.74;
          const px = Math.cos(a) * rx * r;
          const py = Math.sin(a) * ry * r * 1.2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
      };
      ctx.lineJoin = 'miter';
      ctx.translate(3, 4);
      panel();
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.translate(-3, -4);
      panel();
      ctx.fillStyle = b.color;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.stroke();
      const hot = b.color === '#ff5a4e';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = hot ? INK : '#ffffff';
      ctx.strokeText(b.word, 0, 1);
      ctx.fillStyle = hot ? '#ffffff' : INK;
      ctx.fillText(b.word, 0, 1);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawShadows(): void {
    const game = this.game;
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(34, 27, 54, 0.2)';
    for (const object of game.objects) {
      if (!object.alive) continue;
      const b = object.body;
      const z = lerp(b.prevZ, b.z, this.alpha);
      const shrink = 1 / (1 + z * 0.012);
      ctx.beginPath();
      ctx.ellipse(this.bx(b) + 3 + z * 0.15, this.by(b) + 4 + z * 0.1, (b.extX + 3) * shrink, (b.extY * 0.8 + 3) * shrink, 0, 0, TAU);
      ctx.fill();
    }
    for (const enemy of game.enemies) {
      const b = enemy.body;
      ctx.beginPath();
      ctx.ellipse(this.bx(b) + 2, this.by(b) + 4, b.boundR + 2, b.boundR * 0.6, 0, 0, TAU);
      ctx.fill();
    }
    const pb = game.player.body;
    ctx.beginPath();
    ctx.ellipse(this.bx(pb) + 2, this.by(pb) + 4, 16, 9, 0, 0, TAU);
    ctx.fill();
  }

  private push(key: number, entity: Drawable['entity']): void {
    let d = this.drawables[this.drawableCount];
    if (!d) {
      d = { key, entity };
      this.drawables.push(d);
    } else {
      d.key = key;
      d.entity = entity;
    }
    this.drawableCount++;
  }

  /** Painter's algorithm by floor position: whatever is lower on screen is nearer the camera. */
  private drawEntities(time: number): void {
    const game = this.game;
    const ctx = this.ctx;
    const player = game.player;
    this.drawableCount = 0;

    for (const object of game.objects) {
      if (!object.alive) continue;
      const b = object.body;
      let key = this.by(b);
      if (object.restingOn) key = this.by(object.restingOn.body) + 0.5 + key * 0.001;
      else if (object.held) key = this.by(player.body) + (player.aimY >= -0.25 ? 1 : -1);
      else if (object.def.surface) key -= b.extY * 0.35;
      this.push(key, object);
    }
    for (const enemy of game.enemies) this.push(this.by(enemy.body), enemy);
    this.push(this.by(player.body), player);
    if (game.pet) this.push(game.pet.depth, game.pet);

    const list = this.drawables;
    const count = this.drawableCount;
    // Insertion sort: the order barely changes between frames, so this is near O(n).
    for (let i = 1; i < count; i++) {
      const item = list[i]!;
      let j = i - 1;
      while (j >= 0 && list[j]!.key > item.key) {
        list[j + 1] = list[j]!;
        j--;
      }
      list[j + 1] = item;
    }

    for (let i = 0; i < count; i++) {
      const entity = list[i]!.entity;
      if (entity.kind === 'pet') {
        const a = this.alpha;
        drawPet(ctx, entity, lerp(entity.prevX, entity.x, a), lerp(entity.prevY, entity.y, a), lerp(entity.prevZ, entity.z, a), time);
        continue;
      }
      const b = entity.body;
      const x = this.bx(b);
      const y = this.by(b);
      if (entity.kind === 'object') {
        const z = lerp(b.prevZ, b.z, this.alpha);
        const angle = lerp(b.prevAngle, b.angle, this.alpha);
        if (entity === player.hover) {
          drawObjectHalo(ctx, entity, x, y, z, angle, '#ffffff', 4);
        } else if (entity.held) {
          drawObjectHalo(ctx, entity, x, y, z, angle, player.charge >= 1 ? PALETTE.coral : PALETTE.yellow, 1);
        } else if (game.state === 'playing' && entity === game.tutorial.focus && entity.alive) {
          // First-60-seconds nudge: the tutorial target pulses gently using the same
          // halo art as hover, so it reads as "grabbable" without a new UI element.
          const pulse = 2.5 + Math.sin(time * 5) * 1.2;
          drawObjectHalo(ctx, entity, x, y, z, angle, PALETTE.yellow, pulse);
        }
        if (!entity.held) {
          // speed streak behind anything really moving
          const speed = b.speed();
          if (speed > 430) {
            const ux = b.vx / speed;
            const uy = b.vy / speed;
            const len = Math.min(110, speed * 0.085);
            const half = b.boundR * 0.72;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
            ctx.beginPath();
            ctx.moveTo(x - uy * half, y - z + ux * half);
            ctx.lineTo(x + uy * half, y - z - ux * half);
            ctx.lineTo(x - ux * len, y - z - uy * len);
            ctx.closePath();
            ctx.fill();
          }
        }
        drawObject(ctx, entity, x, y, z, angle, time);
      } else if (entity.kind === 'enemy') {
        drawEnemy(ctx, entity, x, y, time);
      } else {
        drawPlayer(ctx, entity, x, y, time, game.hero);
      }
    }

    const hover = player.hover;
    if (hover && game.state === 'playing') {
      const b = hover.body;
      const x = this.bx(b);
      const top = this.by(b) - b.z - hover.def.height - (hover.standing ? 24 : 18) - Math.abs(Math.sin(time * 5)) * 4;
      // a little paper tag on a string, like something from a hardware shop
      ctx.font = `700 11px ${TYPE_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const w = ctx.measureText(hover.label).width + 16;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x, top + 12);
      ctx.quadraticCurveTo(x + 5, top + 5, x, top - 1);
      ctx.stroke();
      ctx.save();
      ctx.translate(x, top - 10);
      ctx.rotate(-0.05);
      ctx.fillStyle = 'rgba(34, 27, 54, 0.35)';
      ctx.fillRect(-w / 2 + 2, -8 + 3, w, 17);
      ctx.fillStyle = '#fbf6e9';
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 6, -9);
      ctx.lineTo(w / 2, -9);
      ctx.lineTo(w / 2, 9);
      ctx.lineTo(-w / 2 + 6, 9);
      ctx.lineTo(-w / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = INK;
      ctx.fillText(hover.label, 3, 0.5);
      ctx.restore();
      // what it is good for, pencilled on a scrap underneath
      const perk = hover.def.perk;
      if (perk) {
        ctx.font = `700 10.5px ${HAND_FONT}`;
        const pw = ctx.measureText(perk).width + 12;
        ctx.save();
        ctx.translate(x + 4, top - 31);
        ctx.rotate(0.035);
        ctx.fillStyle = 'rgba(34, 27, 54, 0.3)';
        ctx.fillRect(-pw / 2 + 2, -7 + 3, pw, 15);
        ctx.fillStyle = '#ffe36e';
        ctx.fillRect(-pw / 2, -8, pw, 15);
        ctx.fillStyle = INK;
        ctx.fillText(perk, 0, 0);
        ctx.restore();
      }
    }
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    const pool = this.game.particles.pool;
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i]!;
      if (!p.active) continue;
      const t = 1 - p.life / p.maxLife;
      const size = p.size * (1 + (p.grow - 1) * t);
      ctx.globalAlpha = p.alpha * Math.min(1, (p.life / p.maxLife) * 2.2);
      ctx.fillStyle = p.color;
      switch (p.shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(p.x, p.y, size, 0, TAU);
          ctx.fill();
          break;
        case 'line':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = size * 0.7;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
          ctx.stroke();
          break;
        case 'rect':
        case 'tri':
        case 'star': {
          const c = Math.cos(p.rotation);
          const s = Math.sin(p.rotation);
          ctx.beginPath();
          if (p.shape === 'rect') {
            const hw = size;
            const hh = size * 0.45;
            ctx.moveTo(p.x + c * hw - s * hh, p.y + s * hw + c * hh);
            ctx.lineTo(p.x - c * hw - s * hh, p.y - s * hw + c * hh);
            ctx.lineTo(p.x - c * hw + s * hh, p.y - s * hw - c * hh);
            ctx.lineTo(p.x + c * hw + s * hh, p.y + s * hw - c * hh);
          } else if (p.shape === 'tri') {
            ctx.moveTo(p.x + c * size, p.y + s * size);
            ctx.lineTo(p.x + Math.cos(p.rotation + 2.3) * size, p.y + Math.sin(p.rotation + 2.3) * size);
            ctx.lineTo(p.x + Math.cos(p.rotation + 4.1) * size * 0.7, p.y + Math.sin(p.rotation + 4.1) * size * 0.7);
          } else {
            for (let k = 0; k < 8; k++) {
              const a = p.rotation + (k * TAU) / 8;
              const r = k % 2 === 0 ? size : size * 0.4;
              if (k === 0) ctx.moveTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
              else ctx.lineTo(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r);
            }
          }
          ctx.closePath();
          ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Throw direction, an approximate trajectory and the charge ring. Deliberately understated. */
  private drawAim(time: number): void {
    const game = this.game;
    const ctx = this.ctx;
    const player = game.player;
    const held = player.held;
    if (!held || !player.alive) return;

    const ob = held.body;
    const ox = this.bx(ob);
    const oy = this.by(ob);
    const charge = player.charge;
    const charging = player.charging;

    let distance = 46;
    if (charging) {
      if (held.def.throwable) {
        const speed = player.throwSpeed(held, charge);
        const air = (2 * (90 + 190 * charge)) / (1500 * (1 - (held.def.glide ?? 0)));
        distance = Math.min(760, speed * air + (speed * speed) / (2 * ob.groundFriction) * 0.55);
      } else {
        distance = 40 + charge * 70;
      }
    }

    const reach = game.world.raycast(ox, oy, player.aimX, player.aimY, distance, Layer.Wall, rayNormal);
    const blocked = reach < distance - 1;
    const spacing = 17;
    const count = Math.floor(reach / spacing);
    const baseAlpha = charging ? 0.85 : 0.35;
    ctx.fillStyle = charge >= 1 ? PALETTE.coral : '#ffffff';
    for (let i = 1; i <= count; i++) {
      const t = i / Math.max(1, count);
      const d = i * spacing - ((time * 60) % spacing) * (charging ? 1 : 0);
      if (d < ob.boundR) continue;
      ctx.globalAlpha = baseAlpha * (1 - t * 0.75);
      ctx.beginPath();
      ctx.arc(ox + player.aimX * d, oy + player.aimY * d - 6, 3.2 - t * 1.6, 0, TAU);
      ctx.fill();
    }

    if (charging) {
      const ex = ox + player.aimX * reach;
      const ey = oy + player.aimY * reach;
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = charge >= 1 ? PALETTE.coral : '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 9, 6.5, 0, 0, TAU);
      ctx.stroke();
      if (blocked && held.def.throwable) {
        // hint of the bounce
        const dot = player.aimX * rayNormal.nx + player.aimY * rayNormal.ny;
        const rx = player.aimX - 2 * dot * rayNormal.nx;
        const ry = player.aimY - 2 * dot * rayNormal.ny;
        const rest = Math.min(90, (distance - reach) * 0.35);
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + rx * rest, ey + ry * rest);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // charge ring at the player's feet
      const px = this.bx(player.body);
      const py = this.by(player.body);
      ctx.globalAlpha = 0.9;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(34, 27, 54, 0.55)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.ellipse(px, py + 2, 25, 17, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = charge >= 1 ? PALETTE.coral : PALETTE.yellow;
      ctx.lineWidth = 3.5 + (charge >= 1 ? Math.sin(time * 22) * 1.2 : 0);
      ctx.beginPath();
      ctx.ellipse(px, py + 2, 25, 17, 0, -Math.PI / 2, -Math.PI / 2 + TAU * charge);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }
    ctx.globalAlpha = 1;
  }

  /** Tutorial nudge: a sticky note with a hand-drawn arrow. */
  private drawHint(time: number): void {
    const hint = this.game.tutorial.hint;
    if (!hint || this.game.state !== 'playing') return;
    const ctx = this.ctx;
    const y = hint.y - Math.abs(Math.sin(time * 4)) * 5;
    ctx.font = `700 13px ${HAND_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(hint.text).width + 22;
    ctx.save();
    ctx.translate(hint.x, y);
    ctx.rotate(-0.04 + Math.sin(time * 2) * 0.015);
    ctx.fillStyle = 'rgba(34, 27, 54, 0.3)';
    ctx.fillRect(-w / 2 + 3, -13 + 4, w, 28);
    ctx.fillStyle = '#ffe36e';
    ctx.beginPath();
    ctx.moveTo(-w / 2, -14);
    ctx.lineTo(w / 2, -14);
    ctx.lineTo(w / 2, 8);
    ctx.lineTo(w / 2 - 7, 15);
    ctx.lineTo(-w / 2, 15);
    ctx.closePath();
    ctx.fill();
    // curled corner
    ctx.fillStyle = '#e2c33f';
    ctx.beginPath();
    ctx.moveTo(w / 2, 8);
    ctx.lineTo(w / 2 - 7, 8);
    ctx.lineTo(w / 2 - 7, 15);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillText(hint.text, 0, 0);
    ctx.restore();
    // doodled arrow
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hint.x - 3, y + 19);
    ctx.quadraticCurveTo(hint.x + 5, y + 25, hint.x, y + 32);
    ctx.moveTo(hint.x - 5, y + 27);
    ctx.lineTo(hint.x, y + 33);
    ctx.lineTo(hint.x + 5.5, y + 28);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  /** Floating words are scraps of paper: receipts for points, sticky notes for wisecracks. */
  private drawPopups(): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of this.game.popups) {
      const age = p.maxLife - p.life;
      const pop = age < 0.1 ? 0.5 + (age / 0.1) * 0.65 : 1 + Math.max(0, 0.15 - (age - 0.1)) * 1;
      const points = p.text.charCodeAt(0) === 43; // "+"
      const shout = !points && p.text === p.text.toUpperCase();
      const size = p.size * (points ? 0.95 : shout ? 0.9 : 0.82);
      ctx.font = points ? `700 ${size}px ${TYPE_FONT}` : shout ? `italic 400 ${size}px ${SHOUT_FONT}` : `700 ${size}px ${HAND_FONT}`;
      const w = ctx.measureText(p.text).width + 14;
      const h = size * 1.45;
      const jag = p.tilt * 14;
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / 0.3);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tilt);
      ctx.scale(pop, pop);
      const scrap = (): void => {
        ctx.beginPath();
        ctx.moveTo(-w / 2, -h / 2 + jag * 0.3);
        ctx.lineTo(w / 2 - 2, -h / 2);
        ctx.lineTo(w / 2, h / 2 - jag * 0.4);
        ctx.lineTo(-w / 2 + 3, h / 2);
        ctx.closePath();
      };
      ctx.translate(2, 3);
      scrap();
      ctx.fillStyle = 'rgba(34, 27, 54, 0.35)';
      ctx.fill();
      ctx.translate(-2, -3);
      scrap();
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.fillStyle = INK;
      ctx.fillText(p.text, 0, 1);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawDebug(): void {
    const game = this.game;
    const ctx = this.ctx;
    ctx.lineWidth = 1;

    if (this.debug.grid) {
      ctx.fillStyle = 'rgba(255, 90, 78, 0.25)';
      game.nav.forEachBlocked((x, y, size) => ctx.fillRect(x, y, size, size));
      ctx.strokeStyle = 'rgba(34, 27, 54, 0.18)';
      ctx.beginPath();
      for (let x = 0; x <= game.room.def.width; x += 72) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, game.room.def.height);
      }
      for (let y = 0; y <= game.room.def.height; y += 72) {
        ctx.moveTo(0, y);
        ctx.lineTo(game.room.def.width, y);
      }
      ctx.stroke();
    }

    if (!this.debug.hitboxes) return;
    for (const b of game.world.bodies) {
      ctx.strokeStyle = b.type === 'static' ? '#8888ff' : b.sleeping ? '#888888' : '#00ff88';
      ctx.beginPath();
      const s = b.shape;
      if (s.kind === 'circle') {
        ctx.arc(b.x, b.y, s.r, 0, TAU);
      } else {
        const c = Math.cos(b.angle);
        const sn = Math.sin(b.angle);
        ctx.moveTo(b.x + c * s.hw - sn * s.hh, b.y + sn * s.hw + c * s.hh);
        ctx.lineTo(b.x - c * s.hw - sn * s.hh, b.y - sn * s.hw + c * s.hh);
        ctx.lineTo(b.x - c * s.hw + sn * s.hh, b.y - sn * s.hw - c * s.hh);
        ctx.lineTo(b.x + c * s.hw + sn * s.hh, b.y + sn * s.hw - c * s.hh);
        ctx.closePath();
      }
      ctx.stroke();
      if (b.type !== 'dynamic') continue;
      // centre of mass + velocity
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(b.x - 1.5, b.y - 1.5, 3, 3);
      ctx.strokeStyle = '#ffff00';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x + b.vx * 0.1, b.y + b.vy * 0.1);
      ctx.stroke();
    }
    for (const zone of game.zones.zones) {
      ctx.strokeStyle = zone.energized ? '#ffff00' : '#ff8800';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.r, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `700 9px ${TYPE_FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(zone.zone + (zone.level ? ` L${zone.level}` : ''), zone.x, zone.y);
    }
    const p = game.player;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(p.body.x, p.body.y, 100, 0, TAU);
    ctx.stroke();
  }
}
