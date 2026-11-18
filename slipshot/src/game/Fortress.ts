import * as planck from 'planck';
import { FORTRESS } from '../config';
import type { PhysicsManager } from '../physics/PhysicsManager';
import type { Tag } from '../physics/tags';
import { randRange } from '../util/math';
import type { Arena } from './Arena';
import { fortressItem, pieceSize, type FortressItemDef, type FortressItemId, type PlacedPiece } from './fortressItems';

/** One piece of the fortress: standing on the home island, or fallen and tumbling. */
export interface FortressPiece {
  def: FortressItemDef;
  /** The entry in the saved layout while the piece stands. */
  saved: PlacedPiece;
  /** Centre and size while standing (rotation already applied to w and h). */
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  body: planck.Body;
  falling: boolean;
  /** Seconds left before a fallen piece is removed. */
  life: number;
  /** Seconds since the piece was placed, for its pop-in. */
  age: number;
  /** Seconds of white hit flash left. */
  flash: number;
  /** Cannons: seconds until the next shot, barrel angle (world radians) and recoil 0..1. */
  reload: number;
  aim: number;
  recoil: number;
  prevX: number;
  prevY: number;
  prevA: number;
}

/** Where a piece would go if dropped at a pointer x: snapped, resting on whatever is below. */
export interface Footprint {
  item: FortressItemId;
  rot: 0 | 1;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Inside the build zone and under the height limit. Ragdoll overlap is checked by the caller. */
  ok: boolean;
}

/** Fallen pieces hit terrain like the islands do: shots splat on them, and they are not targets. */
const DEBRIS_TAG: Tag = { kind: 'platform' };
const VOID_Y = -12;
/** Touching tolerance for "rests on" checks, in metres. */
const EPS = 0.03;

/**
 * The player's fortress on the home island. Pieces are static boxes placed by
 * drag and drop. Every piece must rest on the island or on another piece; when
 * a piece breaks, whatever loses its support falls as physics debris and is
 * lost. Health is full at the start of each run; the saved layout is kept by
 * Progression.
 */
export class Fortress {
  readonly standing: FortressPiece[] = [];
  readonly debris: FortressPiece[] = [];
  /** The build zone: the top of the home island. */
  readonly zone: { minX: number; maxX: number; topY: number };
  /** Saved pieces that could not stand when the fortress was rebuilt (bad or old data). */
  readonly rejected: PlacedPiece[] = [];

  constructor(
    private readonly physics: PhysicsManager,
    arena: Arena,
    layout: readonly PlacedPiece[],
  ) {
    const home = arena.islands.find((i) => i.home === 'player') ?? arena.islands[0];
    this.zone = { minX: home.minX, maxX: home.maxX, topY: home.topY };
    // Rebuild bottom-up, so every support exists before what rests on it.
    const ordered = [...layout].sort((a, b) => bottomOf(a) - bottomOf(b));
    for (const saved of ordered) {
      const piece = this.add(saved);
      piece.age = 10; // no pop-in for a rebuild
    }
    for (let bad = this.unsupported(); bad.length > 0; bad = this.unsupported()) {
      for (const p of bad) {
        this.destroyNow(p);
        this.rejected.push(p.saved);
      }
    }
  }

  /** Put a piece in the world as a static body. Call outside the physics step. */
  add(saved: PlacedPiece): FortressPiece {
    const def = fortressItem(saved.item);
    const { w, h } = pieceSize(saved.item, saved.rot);
    const body = this.physics.world.createBody({ type: 'static', position: { x: saved.x, y: saved.y } });
    const piece: FortressPiece = {
      def,
      saved,
      x: saved.x,
      y: saved.y,
      w,
      h,
      hp: def.hp,
      body,
      falling: false,
      life: 0,
      age: 0,
      flash: 0,
      reload: FORTRESS.cannonReload * randRange(0.4, 1),
      aim: Math.PI / 4,
      recoil: 0,
      prevX: saved.x,
      prevY: saved.y,
      prevA: 0,
    };
    const tag: Tag = { kind: 'block', piece };
    body.createFixture(new planck.Box(w / 2, h / 2), {
      friction: 0.8,
      restitution: def.id === 'jelly' ? 0.95 : 0.05,
      userData: tag,
    });
    this.standing.push(piece);
    return piece;
  }

  /** True when another standing piece rests on this one, so it cannot be picked up. */
  isLoadBearing(piece: FortressPiece): boolean {
    const top = piece.y + piece.h / 2;
    return this.standing.some((q) => q !== piece && Math.abs(q.y - q.h / 2 - top) < EPS && overlapX(piece, q) > 0.05);
  }

  /** Take a standing piece out of the world (build mode pick-up). Call outside the physics step. */
  pickUp(piece: FortressPiece): void {
    this.destroyNow(piece);
  }

  /**
   * Damage a standing piece by an enemy shot. Returns every piece lost when it
   * breaks (the piece itself, then everything that loses its support), or null
   * while it still stands.
   */
  hit(piece: FortressPiece, amount: number): FortressPiece[] | null {
    if (piece.falling || !this.standing.includes(piece)) return null;
    piece.hp -= amount * piece.def.damageTaken;
    piece.flash = 0.12;
    if (piece.hp > 0) return null;
    this.physics.removeBody(piece.body);
    this.standing.splice(this.standing.indexOf(piece), 1);
    const lost = [piece];
    // Knock-on collapse: keep dropping pieces until everything left is supported.
    for (let fallen = this.unsupported(); fallen.length > 0; fallen = this.unsupported()) {
      for (const p of fallen) {
        this.drop(p);
        lost.push(p);
      }
    }
    return lost;
  }

  /** Where a piece would land if dropped at pointer x: snapped to the grid, resting on the highest thing below. */
  footprint(item: FortressItemId, rot: 0 | 1, pointerX: number, ignore: FortressPiece | null = null): Footprint {
    const { w, h } = pieceSize(item, rot);
    const g = FORTRESS.grid;
    let left = Math.round((pointerX - w / 2 - this.zone.minX) / g) * g + this.zone.minX;
    left = Math.max(this.zone.minX, Math.min(this.zone.maxX - w, left));
    const x = left + w / 2;
    let base = this.zone.topY;
    for (const q of this.standing) {
      if (q === ignore) continue;
      const ov = Math.min(left + w, q.x + q.w / 2) - Math.max(left, q.x - q.w / 2);
      if (ov > 0.02) base = Math.max(base, q.y + q.h / 2);
    }
    const y = base + h / 2;
    return { item, rot, x, y, w, h, ok: y + h / 2 <= FORTRESS.maxHeight + 1e-6 };
  }

  /** The topmost standing piece under a world point, if any. */
  pieceAt(x: number, y: number): FortressPiece | null {
    for (let i = this.standing.length - 1; i >= 0; i--) {
      const p = this.standing[i];
      if (Math.abs(x - p.x) <= p.w / 2 + 0.08 && Math.abs(y - p.y) <= p.h / 2 + 0.08) return p;
    }
    return null;
  }

  /** Tops of standing pieces: surfaces a character can stand on. */
  surfaces(): { minX: number; maxX: number; topY: number }[] {
    return this.standing.map((p) => ({ minX: p.x - p.w / 2, maxX: p.x + p.w / 2, topY: p.y + p.h / 2 }));
  }

  count(id: FortressItemId): number {
    return this.standing.filter((p) => p.def.id === id).length;
  }

  /** Visual timers only: pop-ins, hit flashes and cannon recoil. Safe to run while the world is paused. */
  animate(dt: number): void {
    for (const p of this.standing) {
      p.age += dt;
      p.flash = Math.max(0, p.flash - dt);
      p.recoil = Math.max(0, p.recoil - dt * 4);
    }
  }

  /** Advance timers and fallen pieces. Runs with the physics step. */
  update(dt: number): void {
    this.animate(dt);
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const p = this.debris[i];
      p.life -= dt;
      p.flash = Math.max(0, p.flash - dt);
      if (p.life <= 0 || p.body.getPosition().y < VOID_Y) {
        this.physics.removeBody(p.body);
        this.debris.splice(i, 1);
      }
    }
  }

  /** Remember each piece's pose, so the renderer can blend between physics steps. */
  snapshot(): void {
    for (const p of [...this.standing, ...this.debris]) {
      const pos = p.body.getPosition();
      p.prevX = pos.x;
      p.prevY = pos.y;
      p.prevA = p.body.getAngle();
    }
  }

  private supported(p: FortressPiece): boolean {
    const bottom = p.y - p.h / 2;
    if (Math.abs(bottom - this.zone.topY) < EPS && p.x + p.w / 2 > this.zone.minX && p.x - p.w / 2 < this.zone.maxX) return true;
    return this.standing.some((q) => q !== p && Math.abs(q.y + q.h / 2 - bottom) < EPS && overlapX(p, q) > 0.05);
  }

  private unsupported(): FortressPiece[] {
    return this.standing.filter((p) => !this.supported(p));
  }

  /** Swap a standing piece's static body for a dynamic one, so it falls under gravity. */
  private drop(p: FortressPiece): void {
    this.standing.splice(this.standing.indexOf(p), 1);
    this.physics.removeBody(p.body);
    const body = this.physics.world.createBody({
      type: 'dynamic',
      position: { x: p.x, y: p.y },
      linearDamping: 0.02,
      angularDamping: 0.1,
    });
    body.createFixture(new planck.Box(p.w / 2, p.h / 2), { density: 1.5, friction: 0.8, restitution: 0.1, userData: DEBRIS_TAG });
    body.setLinearVelocity({ x: randRange(-1.6, 1.6), y: randRange(0, 1.5) });
    body.setAngularVelocity(randRange(-2.5, 2.5));
    p.body = body;
    p.falling = true;
    p.life = FORTRESS.debrisLife;
    this.debris.push(p);
  }

  /** Remove a standing piece's body right away. Only safe while the world is not stepping. */
  private destroyNow(p: FortressPiece): void {
    const i = this.standing.indexOf(p);
    if (i >= 0) this.standing.splice(i, 1);
    this.physics.world.destroyBody(p.body);
  }
}

function overlapX(a: { x: number; w: number }, b: { x: number; w: number }): number {
  return Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2);
}

function bottomOf(p: PlacedPiece): number {
  return p.y - pieceSize(p.item, p.rot).h / 2;
}
