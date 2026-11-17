import { ARENA, COMBAT, PHYSICS, SLIME } from '../config';
import { EnemyAI } from '../ai/EnemyAI';
import { previewPath, type Vec2 } from '../ai/ballistics';
import { InputManager, type PointerPoint } from '../input/InputManager';
import { PhysicsManager } from '../physics/PhysicsManager';
import { Projectile } from '../physics/Projectile';
import { Ragdoll, type Team } from '../physics/Ragdoll';
import { SlimeSystem } from '../physics/SlimeSystem';
import { Camera, type WorldPoint } from '../render/Camera';
import { Effects } from '../render/Effects';
import { Renderer, type AimView, type Scene } from '../render/Renderer';
import { UIManager } from '../ui/UIManager';
import { clamp, randRange } from '../util/math';
import type { PhysicsObject } from '../physics/PhysicsObject';
import { Arena } from './Arena';
import { CombatSystem, type CombatContext } from './Combat';
import { Progression, type UpgradeId } from './Progression';

type Phase = 'playing' | 'clearing' | 'upgrade' | 'dying' | 'gameover';

const PLAYER_ID = 1;
const PLAYER_SHOT = '#8dff5a';
const ENEMY_SHOT = '#c77dff';
/** Drag below this many CSS pixels is a tap, not a shot. */
const DEAD_ZONE_PX = 10;

interface Drag {
  anchorX: number;
  anchorY: number;
  curX: number;
  curY: number;
}

/** Aim arc limits for the front arm, in radians (see Ragdoll joint limits). */
const AIM_MIN = -1.5;
const AIM_MAX = 3.3;

/**
 * Owns the game loop. It runs the fixed physics step with an accumulator,
 * renders with interpolation between the last two physics states, and drives
 * the wave, aim, combat and UI flow.
 */
export class GameController {
  private readonly canvas: HTMLCanvasElement;
  private readonly camera = new Camera();
  private readonly renderer: Renderer;
  private readonly ui: UIManager;
  private readonly progression = new Progression();

  private physics!: PhysicsManager;
  private arena!: Arena;
  private effects!: Effects;
  private slime!: SlimeSystem;
  private combat!: CombatSystem;

  private player!: Ragdoll;
  private enemies: Ragdoll[] = [];
  private ais = new Map<Ragdoll, EnemyAI>();
  private projectiles: Projectile[] = [];
  private nextId = 1;

  private phase: Phase = 'playing';
  private phaseTimer = 0;
  private accumulator = 0;
  private lastFrame: number | null = null;
  private time = 0;
  private shotCooldown = 0;
  private aimHold = 0;
  private lastAimPhi: number | null = null;

  private drag: Drag | null = null;
  private aimDir: Vec2 | null = null;
  private aimPower = 0;
  private aimActive = false;
  private readonly aimView: AimView = { active: false, power: 0, anchor: null, pointer: null, path: [], landing: null };
  private hintShown = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas, this.camera);
    this.ui = new UIManager({
      onRestart: () => this.restart(),
      onUpgrade: (id) => this.pickUpgrade(id),
    });
    new InputManager(canvas, {
      onDown: (p) => this.pointerDown(p),
      onMove: (p) => this.pointerMove(p),
      onUp: (p) => this.pointerUp(p),
      onCancel: () => {
        this.drag = null;
      },
    });
    window.addEventListener('resize', () => this.renderer.resize());
    this.renderer.resize();
    this.restart();
  }

  start(): void {
    const loop = (now: number): void => {
      this.frame(now);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  /** Begin a fresh run: new physics world, arena, player, wave 1. */
  restart(): void {
    this.progression.reset();
    this.physics = new PhysicsManager();
    this.effects = new Effects();
    this.slime = new SlimeSystem(this.effects);
    this.combat = new CombatSystem(this.physics, this.slime, this.effects);
    this.arena = new Arena(this.physics);
    this.projectiles = [];
    this.enemies = [];
    this.ais.clear();
    this.nextId = PLAYER_ID;
    this.player = this.spawnRagdoll('player', 1, ARENA.playerSpawnX, COMBAT.playerMaxHp);
    this.drag = null;
    this.shotCooldown = 0;
    this.aimHold = 0;
    this.lastAimPhi = null;
    this.phase = 'playing';
    this.phaseTimer = 0;
    this.accumulator = 0;
    this.lastFrame = null;
    this.ui.hideUpgrades();
    this.ui.hideGameOver();
    this.hintShown = true;
    this.ui.showHint();
    this.startWave();
  }

  // ---- Frame loop -------------------------------------------------------

  private frame(now: number): void {
    const dtReal = this.lastFrame === null ? 0 : Math.min(PHYSICS.maxFrameDt, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.time += dtReal;

    this.accumulator += dtReal;
    while (this.accumulator >= PHYSICS.fixedDt) {
      this.snapshotAll();
      this.fixedUpdate(PHYSICS.fixedDt);
      this.accumulator -= PHYSICS.fixedDt;
    }
    const alpha = this.accumulator / PHYSICS.fixedDt;

    this.updateAim();
    this.camera.addTrauma(this.combat.trauma);
    this.combat.trauma = 0;
    this.camera.frame(dtReal, this.cameraTargets());

    this.renderer.draw(this.scene(alpha));
    this.ui.setHud({
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      wave: this.progression.wave,
      score: this.progression.score,
      levels: this.progression.levels,
    });
  }

  private snapshotAll(): void {
    for (const r of this.allRagdolls()) r.snapshot();
    for (const o of this.arena.objects) o.snapshot();
    for (const p of this.projectiles) p.snapshot();
  }

  /** One fixed physics step, plus the game logic that runs with it. */
  private fixedUpdate(dt: number): void {
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    this.aimHold = Math.max(0, this.aimHold - dt);

    // Player arm: follow the aim while dragging, hold briefly after a shot.
    if (this.aimActive && this.aimDir) this.player.setAim(aimBodyAngle(this.aimDir));
    else if (this.aimHold > 0) this.player.setAim(this.lastAimPhi);
    else this.player.setAim(null);

    // Enemy AI only acts while a wave is live.
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (this.phase === 'playing') {
        this.ais.get(e)?.update(dt, this.player, this.progression.wave, (o, m, d, s) => this.spawnProjectile(o, m, d, s));
      } else {
        e.setAim(null);
      }
    }

    for (const r of this.allRagdolls()) r.update(dt);
    for (const p of this.projectiles) p.update(dt);
    for (const o of this.arena.objects) o.update(dt);
    this.slime.update(dt);

    this.physics.step(dt);

    const { hits, impacts } = this.physics.drain();
    const ctx = this.combatContext();
    for (const h of hits) this.combat.onProjectileHit(h, ctx);
    for (const imp of impacts) this.combat.onImpact(imp);

    this.resolveDeaths();
    this.cleanup();
    this.physics.flush();
    this.effects.update(dt);
    this.advancePhase(dt);
  }

  private resolveDeaths(): void {
    const killY = ARENA.killY;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.hp <= 0 || e.torsoPosition().y < killY) {
        e.kill(4);
        const reward = this.progression.killReward();
        this.progression.score += reward;
        this.progression.kills++;
        const t = e.torsoPosition();
        this.effects.text(t.x, t.y + 0.6, `KO +${reward}`, '#ffe066');
      }
    }
    if (this.player.alive && (this.player.hp <= 0 || this.player.torsoPosition().y < killY)) {
      this.player.kill(2.5);
      this.ui.hideUpgrades();
      this.phase = 'dying';
      this.phaseTimer = 1.6;
    }
  }

  private cleanup(): void {
    for (const p of this.projectiles) {
      if (!p.alive) continue;
      const pos = p.position;
      if (p.life <= 0 || Math.abs(pos.x) > ARENA.halfWidth + 30 || pos.y < -20 || pos.y > 60) p.destroy(this.physics);
    }
    this.projectiles = this.projectiles.filter((p) => p.alive);

    for (const e of this.enemies.slice()) {
      if (e.state === 'dead' && e.corpseTimer <= 0) {
        e.destroy(this.physics);
        this.combat.forget(e);
        this.ais.delete(e);
        this.enemies.splice(this.enemies.indexOf(e), 1);
      }
    }

    // Loose objects that roll off the edge are removed.
    const objects: PhysicsObject[] = this.arena.objects;
    for (let i = objects.length - 1; i >= 0; i--) {
      if (objects[i].body.getPosition().y < -12) {
        objects[i].destroy(this.physics);
        objects.splice(i, 1);
      }
    }
  }

  private advancePhase(dt: number): void {
    switch (this.phase) {
      case 'playing':
        if (this.enemies.length > 0 && this.enemies.every((e) => !e.alive)) {
          this.phase = 'clearing';
          this.phaseTimer = 1.4;
        }
        break;
      case 'clearing':
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.phase = 'upgrade';
          this.ui.showUpgrades(this.progression.levels, this.progression.wave);
        }
        break;
      case 'dying':
        this.phaseTimer -= dt;
        if (this.phaseTimer <= 0) {
          this.phase = 'gameover';
          this.ui.showGameOver(
            `Reached wave ${this.progression.wave} · Score ${this.progression.score} · ${this.progression.kills} KO`,
          );
        }
        break;
      default:
        break;
    }
  }

  // ---- Waves and upgrades ----------------------------------------------

  private startWave(): void {
    const count = this.progression.enemyCount();
    const hp = this.progression.enemyHp();
    for (let i = 0; i < count; i++) {
      const x = ARENA.enemySpawnXs[i] + randRange(-0.25, 0.25);
      const e = this.spawnRagdoll('enemy', -1, x, hp);
      this.enemies.push(e);
      this.ais.set(e, new EnemyAI(e, this.arena, 1.6 + i * 0.5 + Math.random() * 0.6));
    }
    this.phase = 'playing';
    this.effects.text(ARENA.playerSpawnX, 3.2, `WAVE ${this.progression.wave}`, '#ffffff');
  }

  private pickUpgrade(id: UpgradeId): void {
    if (this.phase !== 'upgrade') return;
    this.progression.upgrade(id);
    this.progression.wave++;
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + COMBAT.healOnWaveClear);
    this.ui.hideUpgrades();
    this.startWave();
  }

  // ---- Characters and projectiles --------------------------------------

  private spawnRagdoll(team: Team, facing: 1 | -1, x: number, maxHp: number): Ragdoll {
    const id = this.nextId++;
    return new Ragdoll(this.physics, { id, team, facing, x, groundY: 0, maxHp });
  }

  private spawnProjectile(owner: Ragdoll, muzzle: Vec2, dir: Vec2, speed: number): void {
    const color = owner.team === 'player' ? PLAYER_SHOT : ENEMY_SHOT;
    const p = new Projectile(this.physics, owner.id, muzzle, { x: dir.x * speed, y: dir.y * speed }, color);
    this.projectiles.push(p);
  }

  private allRagdolls(): Ragdoll[] {
    return [this.player, ...this.enemies];
  }

  private combatContext(): CombatContext {
    return {
      ragdolls: this.allRagdolls(),
      objects: this.arena.objects,
      coatDuration: this.progression.coatDuration,
      splatRadius: this.progression.splatRadius,
      puddleLife: this.progression.puddleLife,
    };
  }

  // ---- Input and aiming ------------------------------------------------

  private dragMaxPx(): number {
    return clamp(Math.min(this.canvas.clientWidth, this.canvas.clientHeight) * 0.45, 110, 280);
  }

  private pointerDown(p: PointerPoint): void {
    if (this.phase !== 'playing' || !this.player.alive) return;
    this.drag = { anchorX: p.x, anchorY: p.y, curX: p.x, curY: p.y };
  }

  private pointerMove(p: PointerPoint): void {
    if (!this.drag) return;
    this.drag.curX = p.x;
    this.drag.curY = p.y;
  }

  private pointerUp(p: PointerPoint): void {
    if (!this.drag) return;
    this.drag.curX = p.x;
    this.drag.curY = p.y;
    const shot = this.computeAim();
    this.drag = null;
    if (shot && shot.power > 0) this.fire(shot.dir, shot.power);
  }

  /** Aim = drag backwards from the anchor. Power = drag length, clamped to 0..1. */
  private computeAim(): { dir: Vec2; power: number } | null {
    if (!this.drag) return null;
    const dx = this.drag.anchorX - this.drag.curX;
    const dy = this.drag.anchorY - this.drag.curY;
    const len = Math.hypot(dx, dy);
    if (len < 1e-3) return null;
    const power = len < DEAD_ZONE_PX ? 0 : clamp((len - DEAD_ZONE_PX) / (this.dragMaxPx() - DEAD_ZONE_PX), 0, 1);
    const raw = { x: dx / len, y: -dy / len };
    // Keep the aim inside the arm's reachable arc.
    const phi = clamp(aimBodyAngle(raw), AIM_MIN, AIM_MAX);
    return { dir: { x: Math.sin(phi), y: -Math.cos(phi) }, power };
  }

  private fire(dir: Vec2, power: number): void {
    if (this.phase !== 'playing' || !this.player.alive || this.shotCooldown > 0) return;
    const speed = this.launchSpeed(power);
    const muzzle = this.player.muzzle(dir);
    this.spawnProjectile(this.player, muzzle, dir, speed);
    this.shotCooldown = 0.42;
    this.aimHold = 0.35;
    this.lastAimPhi = aimBodyAngle(dir);
    if (this.hintShown) {
      this.hintShown = false;
      this.ui.hideHint();
    }
  }

  private launchSpeed(power: number): number {
    return (SLIME.launchMin + (SLIME.launchMax - SLIME.launchMin) * power) * this.progression.launchMultiplier;
  }

  /** Refresh the drag and trajectory preview for this frame. */
  private updateAim(): void {
    const shot = this.computeAim();
    const live = this.phase === 'playing' && this.player.alive;
    this.aimPower = shot?.power ?? 0;
    this.aimActive = !!shot && shot.power > 0.02 && live;
    this.aimDir = shot ? shot.dir : null;

    this.aimView.active = this.aimActive;
    this.aimView.power = this.aimPower;
    this.aimView.anchor = this.drag ? { x: this.drag.anchorX, y: this.drag.anchorY } : null;
    this.aimView.pointer = this.drag ? { x: this.drag.curX, y: this.drag.curY } : null;
    this.aimView.path = [];
    this.aimView.landing = null;

    if (this.aimActive && shot) {
      const muzzle = this.player.muzzle(shot.dir);
      const speed = this.launchSpeed(shot.power);
      const v = { x: shot.dir.x * speed, y: shot.dir.y * speed };
      const preview = previewPath(this.arena, muzzle, v);
      this.aimView.path = preview.points;
      this.aimView.landing = preview.landing;
    }
  }

  private cameraTargets(): WorldPoint[] {
    const pts: WorldPoint[] = [];
    if (this.player.alive) pts.push(this.player.torsoPosition());
    for (const e of this.enemies) if (e.alive) pts.push(e.torsoPosition());
    for (const p of this.projectiles) if (p.alive) pts.push(p.position);
    return pts;
  }

  private scene(alpha: number): Scene {
    return {
      arena: this.arena,
      slime: this.slime,
      effects: this.effects,
      camera: this.camera,
      player: this.player,
      enemies: this.enemies,
      projectiles: this.projectiles,
      objects: this.arena.objects,
      aim: this.aimView,
      time: this.time,
      alpha,
    };
  }
}

/** Body angle that points the front arm along a world direction (zero = straight down). */
function aimBodyAngle(dir: Vec2): number {
  return Math.atan2(dir.x, -dir.y);
}
