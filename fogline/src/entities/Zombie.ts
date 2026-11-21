import Phaser from 'phaser';
import { EnemyDef, HitZone, RigStyle } from '../data/enemies';
import { FIELD } from '../game/config';
import { project, Projected } from '../game/perspective';
import { LEN, PART, ZOMBIE_ATLAS } from '../rendering/ZombieArt';

export type ZombieState = 'emerge' | 'walk' | 'attack' | 'dying' | 'dead';
type DeathStyle = 'side' | 'back' | 'crumple';

const RIG_HEIGHT: Record<RigStyle, number> = { shamble: 424, run: 424, heavy: 424, bloat: 446, crawl: 168 };
const STRIDE: Record<RigStyle, number> = { shamble: 0.95, run: 1.7, heavy: 0.9, bloat: 0.8, crawl: 0.55 };

interface Seg { ax: number; ay: number; bx: number; by: number; r: number; zone: HitZone }

export function depthForZ(z: number): number {
  return 2000 - z * 10;
}

const tmpP: Projected = { sx: 0, sy: 0, ppm: 0 };
const TAU = Math.PI * 2;

/**
 * One enemy: logic state plus an articulated, camera-facing rig built from
 * atlas parts. Pooled by EnemyManager — reset() reinitialises everything.
 */
export class Zombie {
  readonly root: Phaser.GameObjects.Container;
  private shadow: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private ua: Phaser.GameObjects.Image[];
  private fa: Phaser.GameObjects.Image[];
  private hand: Phaser.GameObjects.Image[];
  private thigh: Phaser.GameObjects.Image[];
  private shin: Phaser.GameObjects.Image[];

  def!: EnemyDef;
  look = '';
  state: ZombieState = 'dead';
  active = false;
  hp = 0;
  maxHp = 0;
  x = 0;
  z = 0;
  spawnX = 0;
  targetX = 0;
  stopZ = 0;
  speed = 0;
  /** Screen-space info refreshed every frame. */
  sx = 0;
  sy = 0;
  scale = 0;
  ppm = 0;

  private phase = 0;
  private time = 0;
  private emergeLeft = 0;
  private wanderSeed = 0;
  private lean = 0;
  private headTilt = 0;
  private reachSide = 1;
  private limp = 1;
  flinch = 0;
  private flinchDir = 1;
  staggerLeft = 0;
  burnLeft = 0;
  slowLeft = 0;
  private attackT = 0;
  private struck = false;
  private deathT = 0;
  private deathStyle: DeathStyle = 'side';
  private deathDir = 1;
  lieLeft = 0;
  headless = false;
  killedByHeadshot = false;
  /** Set once the kill has been paid and counted. */
  resolved = false;
  groanLeft = 0;
  private hitFlash = 0;
  private flashColor = 0xffffff;
  private baseTint = 0xffffff;
  private segs: Seg[] = [];
  private headC = { x: 0, y: 0, r: 0 };

  constructor(scene: Phaser.Scene) {
    const img = (ox: number, oy: number) => scene.add.image(0, 0, ZOMBIE_ATLAS, 'shadow').setOrigin(ox, oy);
    this.shadow = scene.add.image(0, 0, ZOMBIE_ATLAS, 'shadow').setOrigin(0.5, 0.5);
    this.thigh = [img(PART.thigh.ox, PART.thigh.oy), img(PART.thigh.ox, PART.thigh.oy)];
    this.shin = [img(PART.shin.ox, PART.shin.oy), img(PART.shin.ox, PART.shin.oy)];
    this.torso = img(PART.torso.ox, PART.torso.oy);
    this.head = img(PART.head.ox, PART.head.oy);
    this.ua = [img(PART.upperArm.ox, PART.upperArm.oy), img(PART.upperArm.ox, PART.upperArm.oy)];
    this.fa = [img(PART.foreArm.ox, PART.foreArm.oy), img(PART.foreArm.ox, PART.foreArm.oy)];
    this.hand = [img(PART.hand.ox, PART.hand.oy), img(PART.hand.ox, PART.hand.oy)];
    this.thigh[0].setFlipX(true);
    this.shin[0].setFlipX(true);
    this.ua[0].setFlipX(true);
    this.fa[0].setFlipX(true);
    this.hand[0].setFlipX(true);
    this.root = scene.add.container(0, 0, [
      this.shadow, this.shin[0], this.shin[1], this.thigh[0], this.thigh[1], this.torso, this.head,
      this.ua[0], this.fa[0], this.hand[0], this.ua[1], this.fa[1], this.hand[1],
    ]);
    this.root.setVisible(false);
    for (let i = 0; i < 7; i++) this.segs.push({ ax: 0, ay: 0, bx: 0, by: 0, r: 0, zone: 'torso' });
  }

  reset(def: EnemyDef, healthMul: number, speedMul: number, x: number, z: number, rng: () => number): void {
    this.def = def;
    this.look = `${def.look}_${Math.floor(rng() * def.looks)}`;
    const L = this.look;
    this.torso.setFrame(`${L}_torso`);
    this.torso.setOrigin(PART.torso.ox, PART.torso.oy);
    this.head.setFrame(`${L}_head`);
    for (let i = 0; i < 2; i++) {
      this.ua[i].setFrame(`${L}_upperArm`);
      this.fa[i].setFrame(`${L}_foreArm`);
      this.hand[i].setFrame(`${L}_hand`);
      this.thigh[i].setFrame(`${L}_thigh`);
      this.shin[i].setFrame(`${L}_shin`);
    }
    const crawl = def.rig === 'crawl';
    for (const p of [...this.thigh, ...this.shin]) p.setVisible(!crawl);
    this.head.setVisible(true);
    this.maxHp = this.hp = def.health * healthMul;
    this.speed = def.speed * speedMul * (1 + (rng() * 2 - 1) * (def.speedJitter / def.speed));
    this.x = this.spawnX = x;
    this.z = z;
    this.targetX = (rng() * 2 - 1) * FIELD.attackHalfWidth;
    this.stopZ = FIELD.attackZ + rng() * 1.3;
    this.state = 'emerge';
    this.emergeLeft = 0.5 + rng() * 1.2;
    this.phase = rng() * TAU;
    this.time = rng() * 10;
    this.wanderSeed = rng() * 100;
    this.lean = (rng() * 2 - 1) * 0.06;
    this.headTilt = (rng() * 2 - 1) * 0.28;
    this.reachSide = rng() < 0.5 ? -1 : 1;
    this.limp = 0.45 + rng() * 0.55;
    this.flinch = 0;
    this.staggerLeft = 0;
    this.burnLeft = 0;
    this.slowLeft = 0;
    this.attackT = rng() * 0.5;
    this.struck = false;
    this.deathT = 0;
    this.lieLeft = 0;
    this.headless = false;
    this.killedByHeadshot = false;
    this.resolved = false;
    this.hitFlash = 0;
    this.groanLeft = def.groanInterval[0] * rng() + 1;
    this.active = true;
    this.root.setVisible(true);
    this.root.setAlpha(0);
    this.root.setRotation(0);
    this.root.setScale(1);
    this.shadow.setAlpha(1);
    this.updateScreen();
  }

  get alive(): boolean {
    return this.active && (this.state === 'emerge' || this.state === 'walk' || this.state === 'attack');
  }

  get slowFactor(): number {
    return this.slowLeft > 0 ? 0.45 : 1;
  }

  /** Returns true when an attack strike lands this frame. */
  update(dt: number): boolean {
    this.time += dt;
    let strike = false;
    this.flinch = Math.max(0, this.flinch - dt * 5);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.burnLeft > 0) this.burnLeft = Math.max(0, this.burnLeft - dt);
    if (this.slowLeft > 0) this.slowLeft = Math.max(0, this.slowLeft - dt);
    const slow = this.slowFactor;

    switch (this.state) {
      case 'emerge':
        this.emergeLeft -= dt;
        this.phase += dt * 1.5;
        if (this.emergeLeft <= 0) this.state = 'walk';
        break;
      case 'walk': {
        if (this.staggerLeft > 0) {
          this.staggerLeft -= dt;
          this.z = Math.min(FIELD.spawnZ, this.z + dt * 0.9);
          this.phase += dt * 3;
        } else {
          const v = this.speed * slow;
          this.z -= v * dt;
          this.phase += (v / STRIDE[this.def.rig]) * Math.PI * dt;
        }
        if (this.z <= this.stopZ) {
          this.z = this.stopZ;
          this.state = 'attack';
          this.attackT = 0;
          this.struck = false;
        }
        break;
      }
      case 'attack': {
        if (this.staggerLeft > 0) {
          this.staggerLeft -= dt;
          break;
        }
        this.attackT += (dt * slow) / this.def.attackInterval;
        if (!this.struck && this.attackT >= 0.68) {
          this.struck = true;
          strike = true;
        }
        if (this.attackT >= 1) {
          this.attackT -= 1;
          this.struck = false;
        }
        this.phase += dt * 2;
        break;
      }
      case 'dying':
        this.deathT += dt / (this.deathStyle === 'crumple' ? 0.95 : 0.62);
        if (this.deathT >= 1) {
          this.deathT = 1;
          this.state = 'dead';
          this.lieLeft = 2.6;
        }
        break;
      case 'dead':
        this.lieLeft -= dt;
        if (this.lieLeft <= 0) this.active = false;
        break;
    }

    // Lateral path: converge from spawn lane to a slot on the bunker line, with a drifting wander.
    if (this.state !== 'dying' && this.state !== 'dead') {
      const t = Phaser.Math.Clamp((this.z - FIELD.attackZ) / (FIELD.spawnZ - FIELD.attackZ), 0, 1);
      const wander = Math.sin(this.time * 0.35 + this.wanderSeed) * 1.6 * t;
      const desired = this.targetX + (this.spawnX - this.targetX) * t + wander;
      this.x += (desired - this.x) * Math.min(1, dt * 2);
    }

    this.updateScreen();
    this.pose();
    if (!this.active) this.root.setVisible(false);
    return strike;
  }

  /** Nudge sideways (used by crowd separation). */
  push(dx: number): void {
    this.x += dx;
    this.spawnX += dx;
    this.targetX = Phaser.Math.Clamp(this.targetX + dx, -FIELD.attackHalfWidth * 1.15, FIELD.attackHalfWidth * 1.15);
  }

  hitReact(dir: number, strength: number, headshot: boolean, color = 0xffffff): void {
    this.flinchDir = dir;
    this.flinch = Math.min(1.4, this.flinch + strength * (headshot ? 1.4 : 1));
    this.hitFlash = 0.07;
    this.flashColor = color;
  }

  stagger(seconds: number): void {
    this.staggerLeft = Math.max(this.staggerLeft, seconds);
  }

  kill(style: 'bullet' | 'headshot' | 'blast', dir: number): void {
    this.state = 'dying';
    this.deathT = 0;
    this.deathDir = dir || (Math.random() < 0.5 ? -1 : 1);
    if (style === 'headshot') {
      this.deathStyle = 'crumple';
      this.headless = true;
      this.head.setVisible(false);
    } else if (style === 'blast') {
      this.deathStyle = 'back';
    } else {
      this.deathStyle = Math.random() < 0.6 ? 'side' : Math.random() < 0.5 ? 'back' : 'crumple';
    }
    if (this.def.rig === 'crawl') this.deathStyle = 'back';
  }

  /** Instantly hide (e.g. a Bloater that detonated on the wall). */
  vanish(): void {
    this.state = 'dead';
    this.active = false;
    this.root.setVisible(false);
  }

  release(): void {
    this.active = false;
    this.state = 'dead';
    this.root.setVisible(false);
  }

  private updateScreen(): void {
    project(this.x, this.z, tmpP);
    this.sx = tmpP.sx;
    this.sy = tmpP.sy;
    this.ppm = tmpP.ppm;
    this.scale = (tmpP.ppm * this.def.height) / RIG_HEIGHT[this.def.rig];
    this.root.setPosition(this.sx, this.sy);
    this.root.setDepth(depthForZ(this.z));
  }

  // ------------------------------------------------------------ posing

  private pose(): void {
    const style = this.def.rig;
    const t = this.phase;
    const s0 = -1, s1 = 1;
    let rootX = 0, rootY = -(LEN.thigh + LEN.shin - 6), torsoRot = this.lean, torsoSY = 1, torsoSX = 1;
    let headRot = this.headTilt + Math.sin(this.time * 0.9 + this.wanderSeed) * 0.07;
    const legs = [{ th: 0, thSY: 1, sh: 0, shSY: 1 }, { th: 0, thSY: 1, sh: 0, shSY: 1 }];
    const arms = [{ ua: 0, uaSY: 1, fa: 0, faSY: 1, hs: 1 }, { ua: 0, uaSY: 1, fa: 0, faSY: 1, hs: 1 }];
    const attacking = this.state === 'attack';
    const emerging = this.state === 'emerge';

    if (style === 'crawl') {
      rootY = -16;
      torsoSY = 0.5;
      const pull = Math.sin(t);
      rootX = pull * 5;
      torsoRot = pull * 0.08;
      headRot = this.headTilt * 0.5 + pull * 0.12;
      for (let i = 0; i < 2; i++) {
        const s = i === 0 ? s0 : s1;
        const ph = Math.sin(t + (i ? Math.PI : 0));
        const reach = attacking ? Math.max(0, Math.sin(this.attackT * TAU + i * Math.PI)) : Math.max(0, ph);
        arms[i].ua = -s * (1.15 + 0.35 * reach);
        arms[i].uaSY = 0.85;
        arms[i].fa = -s * (0.25 - 0.4 * reach);
        arms[i].faSY = 0.8 - 0.25 * reach;
        arms[i].hs = 1;
      }
    } else {
      // legs
      for (let i = 0; i < 2; i++) {
        const s = i === 0 ? s0 : s1;
        const ph = t + (i ? Math.PI : 0);
        let lift = emerging || attacking ? 0 : Math.max(0, Math.sin(ph));
        if (style === 'shamble' && i === 1) lift *= this.limp;
        if (attacking) lift = Math.max(0, Math.sin(this.time * 3 + i * Math.PI)) * 0.15;
        const L = legs[i];
        const spread = style === 'bloat' ? 0.16 : style === 'heavy' ? 0.08 : 0.05;
        if (style === 'run') {
          L.th = -s * spread + s * 0.08 * lift;
          L.thSY = 1 - 0.5 * lift;
          L.sh = L.th - s * 0.35 * lift;
          L.shSY = 1 - 0.42 * lift;
        } else {
          L.th = -s * spread + s * 0.05 * lift;
          L.thSY = 1 - 0.3 * lift;
          L.sh = L.th + s * 0.1 * lift;
          L.shSY = 1 - 0.14 * lift;
        }
      }
      const liftMax = Math.max(Math.abs(Math.sin(t)), 0);
      if (!emerging && !attacking) {
        const bob = style === 'run' ? 10 : style === 'bloat' ? 3 : 5;
        rootY -= bob * liftMax;
        const sway = style === 'bloat' ? 12 : style === 'run' ? 4 : 7;
        rootX = Math.sin(t) * sway;
        torsoRot += Math.sin(t) * (style === 'bloat' ? 0.09 : style === 'run' ? 0.04 : 0.06);
      } else if (emerging) {
        rootX = Math.sin(this.time * 1.3 + this.wanderSeed) * 4;
        torsoRot += Math.sin(this.time * 1.1) * 0.05;
      }
      if (style === 'run') {
        torsoSY = 0.9;
        headRot *= 0.5;
      }
      if (style === 'bloat') torsoSX = 1 + Math.sin(this.time * 2.6) * 0.035;

      // arms
      for (let i = 0; i < 2; i++) {
        const s = i === 0 ? s0 : s1;
        const A = arms[i];
        const ph = t + (i ? 0 : Math.PI);
        if (attacking) {
          const a = (this.attackT + (style === 'run' ? i * 0.5 : 0)) % 1;
          const raise = a < 0.6 ? Math.sin((a / 0.6) * Math.PI * 0.5) : a < 0.72 ? 1 - (a - 0.6) / 0.12 : 0;
          A.ua = -s * (0.35 + 2.0 * raise);
          A.uaSY = 0.85;
          A.fa = A.ua - s * (0.3 + 0.5 * raise);
          A.faSY = 0.85;
          A.hs = 1.1;
        } else if (style === 'run') {
          const pump = Math.sin(ph);
          A.ua = -s * 0.38;
          A.uaSY = 0.8 - 0.3 * pump;
          A.fa = s * (Math.PI - 0.75);
          A.faSY = 0.6 + 0.3 * pump;
        } else if (style === 'shamble' && s === this.reachSide) {
          A.ua = -s * 0.28 + Math.sin(ph) * 0.05;
          A.uaSY = 0.42;
          A.fa = -s * 0.12 + Math.sin(ph + 1) * 0.08;
          A.faSY = 0.42;
          A.hs = 1.18;
        } else if (style === 'bloat') {
          A.ua = -s * 0.62 + Math.sin(ph) * 0.06;
          A.uaSY = 0.95;
          A.fa = -s * 0.28;
          A.faSY = 0.92;
        } else {
          const swing = Math.sin(ph) * (style === 'heavy' ? 0.1 : 0.14);
          A.ua = -s * (style === 'heavy' ? 0.2 : 0.12) + swing * 0.4;
          A.uaSY = 0.96 - 0.12 * Math.max(0, Math.sin(ph));
          A.fa = A.ua - s * 0.1;
          A.faSY = 0.95 - 0.25 * Math.max(0, Math.sin(ph));
        }
      }
    }

    // hit reaction and stagger wobble
    torsoRot += this.flinchDir * 0.22 * this.flinch;
    headRot += this.flinchDir * 0.45 * this.flinch;
    rootX += this.flinchDir * 9 * this.flinch;
    if (this.staggerLeft > 0) torsoRot += Math.sin(this.time * 16) * 0.12;
    if (attacking && !this.struck && this.attackT > 0.6) rootY += 6;

    // death
    let rootRot = 0, rootSY = 1;
    if (this.state === 'dying' || this.state === 'dead') {
      const d = this.deathT;
      if (this.deathStyle === 'crumple') {
        const buckle = Math.min(1, d / 0.45);
        for (const L of legs) {
          L.thSY = 1 - 0.55 * buckle;
          L.shSY = 1 - 0.35 * buckle;
        }
        rootY *= 1 - 0.45 * buckle;
        const fall = Math.max(0, (d - 0.4) / 0.6);
        rootRot = this.deathDir * 1.5 * fall * fall;
        torsoRot += this.deathDir * 0.3 * buckle;
      } else if (this.deathStyle === 'side') {
        const e = d * d;
        rootRot = this.deathDir * (1.52 * e - (d > 0.85 ? Math.sin((d - 0.85) / 0.15 * Math.PI) * 0.06 : 0));
        torsoRot += this.deathDir * 0.2 * d;
      } else {
        rootSY = 1 - 0.74 * (d * d);
        rootRot = this.deathDir * 0.18 * d;
        torsoRot += this.deathDir * 0.1;
      }
      for (const A of arms) {
        A.ua *= 1 + d * 0.8;
        A.uaSY = Math.max(A.uaSY, 0.8);
        A.faSY = Math.max(A.faSY, 0.8);
      }
      headRot += this.deathDir * 0.5 * d;
    }

    // ---- forward kinematics
    const tl = style === 'bloat' ? LEN.bloatTorso : LEN.torso;
    const cos = Math.cos, sin = Math.sin;
    const px = rootX, py = rootY;
    this.torso.setPosition(px, py).setRotation(torsoRot).setScale(torsoSX, torsoSY);
    // hunched: the head sinks into the shoulders and hangs forward
    const sink = style === 'run' ? 4 : style === 'crawl' ? 0 : 10;
    const nx = px + sin(torsoRot) * (tl * torsoSY - sink), ny = py - cos(torsoRot) * (tl * torsoSY - sink);
    this.head.setPosition(nx, ny).setRotation(torsoRot * 0.5 + headRot);
    const shoulderX = (style === 'bloat' ? 56 : 33) * torsoSX;
    const shoulderDown = 14;
    const hipX = style === 'bloat' ? 26 : 17;
    const segs = this.segs;
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? -1 : 1;
      // shoulder in torso space (x, -(tl*tsy - down))
      const lx = s * shoulderX, ly = -(tl * torsoSY - shoulderDown);
      const sxp = px + lx * cos(torsoRot) - ly * sin(torsoRot);
      const syp = py + lx * sin(torsoRot) + ly * cos(torsoRot);
      const A = arms[i];
      this.ua[i].setPosition(sxp, syp).setRotation(A.ua).setScale(1, A.uaSY);
      const ex = sxp - sin(A.ua) * LEN.upperArm * A.uaSY, ey = syp + cos(A.ua) * LEN.upperArm * A.uaSY;
      this.fa[i].setPosition(ex, ey).setRotation(A.fa).setScale(1, A.faSY);
      const wx = ex - sin(A.fa) * LEN.foreArm * A.faSY, wy = ey + cos(A.fa) * LEN.foreArm * A.faSY;
      this.hand[i].setPosition(wx, wy).setRotation(A.fa).setScale(A.hs);
      const sa = segs[i];
      sa.ax = sxp; sa.ay = syp; sa.bx = wx; sa.by = wy; sa.r = 13; sa.zone = 'torso';

      const L = legs[i];
      const hx = px + s * hipX * cos(torsoRot * 0.4), hy = py + s * hipX * sin(torsoRot * 0.4) - 4;
      this.thigh[i].setPosition(hx, hy).setRotation(L.th).setScale(1, L.thSY);
      const kx = hx - sin(L.th) * LEN.thigh * L.thSY, ky = hy + cos(L.th) * LEN.thigh * L.thSY;
      this.shin[i].setPosition(kx, ky).setRotation(L.sh).setScale(1, L.shSY);
      const fx = kx - sin(L.sh) * LEN.shin * L.shSY, fy = ky + cos(L.sh) * LEN.shin * L.shSY;
      const sl = segs[2 + i];
      sl.ax = hx; sl.ay = hy; sl.bx = fx; sl.by = fy; sl.r = style === 'crawl' ? 0 : 19; sl.zone = 'legs';
    }
    const st = segs[4];
    const halfW = style === 'bloat' ? 70 : style === 'heavy' ? 46 : 41;
    st.ax = px; st.ay = py - 10 * torsoSY; st.bx = nx; st.by = ny + 18 * torsoSY; st.r = halfW * torsoSX; st.zone = 'torso';
    segs[5].r = 0;
    segs[6].r = 0;
    const hr = torsoRot * 0.5 + headRot;
    const headLen = style === 'bloat' ? 30 : 34;
    this.headC.x = nx + sin(hr) * headLen;
    this.headC.y = ny - cos(hr) * headLen;
    this.headC.r = style === 'bloat' ? 22 : 25;

    // ---- container transform, fade, tint
    this.root.setScale(this.scale, this.scale * rootSY);
    this.root.setRotation(rootRot);
    let alpha = 1;
    if (this.state === 'emerge' || this.z > FIELD.spawnZ - 6) alpha = Math.min(alpha, Phaser.Math.Clamp((FIELD.spawnZ + 0.5 - this.z) / 5, 0.15, 1));
    if (this.state === 'emerge') alpha = Math.min(alpha, 1 - this.emergeLeft / 1.7);
    if (this.state === 'dead' && this.lieLeft < 0.8) alpha = Math.max(0, this.lieLeft / 0.8);
    this.root.setAlpha(alpha);
    this.shadow.setPosition(0, -2).setScale(style === 'bloat' ? 1.6 : style === 'crawl' ? 1.4 : 1.1, 1);
    this.shadow.setAlpha(this.state === 'dying' || this.state === 'dead' ? 0.4 : 0.9);

    // Distant enemies read as darker, desaturated silhouettes in the haze.
    const dist = Phaser.Math.Clamp((this.z - 8) / 70, 0, 1);
    const g = Math.round(212 - dist * 100);
    let tint = (g << 16) | (Math.round(g * 1.0) << 8) | Math.min(255, Math.round(g * 1.04));
    if (this.slowLeft > 0) tint = 0x9fd4ff;
    else if (this.burnLeft > 0) tint = Phaser.Display.Color.GetColor(255, Math.round(g * 0.75), Math.round(g * 0.55));
    if (this.hitFlash > 0) tint = this.flashColor;
    if (tint !== this.baseTint) {
      this.baseTint = tint;
      for (const c of this.root.list as Phaser.GameObjects.Image[]) if (c !== this.shadow) c.setTint(tint);
    }
  }

  // ------------------------------------------------------------ hit testing

  /** Returns the zone hit by a screen point, or null. Head is tested first. */
  hitTest(px: number, py: number): HitZone | null {
    if (!this.alive) return null;
    const s = this.scale;
    if (s <= 0) return null;
    // quick reject by bounding radius
    const top = this.sy - RIG_HEIGHT[this.def.rig] * s * 1.05;
    const halfW = (this.def.rig === 'bloat' ? 120 : 95) * s + 4;
    if (py < top - 4 || py > this.sy + 6 || px < this.sx - halfW || px > this.sx + halfW) return null;
    const rot = this.root.rotation;
    const dx = px - this.sx, dy = py - this.sy;
    const c = Math.cos(-rot), sn = Math.sin(-rot);
    const lx = (dx * c - dy * sn) / s;
    const ly = (dx * sn + dy * c) / (s * this.root.scaleY / this.root.scaleX);
    // Tiny distant targets get a small minimum radius so they remain hittable.
    const slack = Math.max(0, 3 / s - 4);
    if (!this.headless) {
      const hx = lx - this.headC.x, hy = ly - this.headC.y;
      const r = this.headC.r + slack * 0.6;
      if (hx * hx + hy * hy <= r * r) return 'head';
    }
    let best: HitZone | null = null;
    for (const seg of this.segs) {
      if (seg.r <= 0) continue;
      if (distToSeg(lx, ly, seg) <= seg.r + slack) {
        if (seg.zone === 'torso') return 'torso';
        best = seg.zone;
      }
    }
    return best;
  }

  /** Screen position of the head centre (for gore effects). */
  headScreen(out: { x: number; y: number }): { x: number; y: number } {
    return this.localToScreen(this.headC.x, this.headC.y, out);
  }

  /** Screen position of the chest (for fire/impact effects). */
  chestScreen(out: { x: number; y: number }): { x: number; y: number } {
    const st = this.segs[4];
    return this.localToScreen((st.ax + st.bx) / 2, st.ay * 0.35 + st.by * 0.65, out);
  }

  private localToScreen(lx: number, ly: number, out: { x: number; y: number }): { x: number; y: number } {
    const r = this.root.rotation;
    const sx = this.root.scaleX, sy = this.root.scaleY;
    const x = lx * sx, y = ly * sy;
    out.x = this.sx + x * Math.cos(r) - y * Math.sin(r);
    out.y = this.sy + x * Math.sin(r) + y * Math.cos(r);
    return out;
  }
}

function distToSeg(px: number, py: number, s: Seg): number {
  const vx = s.bx - s.ax, vy = s.by - s.ay;
  const len2 = vx * vx + vy * vy || 1;
  let t = ((px - s.ax) * vx + (py - s.ay) * vy) / len2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (s.ax + vx * t), dy = py - (s.ay + vy * t);
  return Math.sqrt(dx * dx + dy * dy);
}
