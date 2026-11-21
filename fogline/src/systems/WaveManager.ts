import { ECONOMY, WAVE_TIMING } from '../game/config';
import { WAVES, WaveDef, scheduledCount } from '../data/waves';
import { Emitter } from './Emitter';

export type WavePhase = 'idle' | 'countdown' | 'active' | 'cleared' | 'victory' | 'defeat';

export interface SpawnRequest {
  enemy: string;
  healthMul: number;
  speedMul: number;
}

interface WaveEvents extends Record<string, unknown> {
  countdown: { wave: number; seconds: number };
  start: { wave: number; def: WaveDef };
  cleared: { wave: number; reward: number };
  victory: { wave: number };
}

interface PendingGroup {
  enemy: string;
  left: number;
  next: number;
  interval: number;
  burst: number;
}

/**
 * Wave state machine. The game reports spawns and deaths; the manager decides
 * when a wave is finished and pays the completion bonus exactly once.
 */
export class WaveManager {
  readonly events = new Emitter<WaveEvents>();
  phase: WavePhase = 'idle';
  /** 1-based index of the current/last wave. 0 before the first. */
  wave = 0;
  countdownLeft = 0;
  elapsed = 0;
  private groups: PendingGroup[] = [];
  /** Enemies alive on the field (including burst spawns). */
  alive = 0;
  /** Enemies still to be spawned from the schedule. */
  pending = 0;
  private rewardPaid = new Set<number>();

  constructor(private readonly waves: WaveDef[] = WAVES) {}

  get totalWaves(): number {
    return this.waves.length;
  }
  get current(): WaveDef | undefined {
    return this.waves[this.wave - 1];
  }
  get remaining(): number {
    return this.alive + this.pending;
  }
  get isLastWave(): boolean {
    return this.wave >= this.waves.length;
  }
  get canStartNext(): boolean {
    return (this.phase === 'idle' || this.phase === 'cleared') && this.wave < this.waves.length;
  }

  waveReward(wave: number): number {
    return ECONOMY.waveBonusBase + ECONOMY.waveBonusPerWave * wave;
  }

  /** Begin the countdown for the next wave. Refused while enemies remain. */
  startNext(): boolean {
    if (!this.canStartNext || this.remaining > 0) return false;
    this.wave += 1;
    const def = this.current!;
    this.phase = 'countdown';
    this.countdownLeft = WAVE_TIMING.countdown;
    this.elapsed = 0;
    this.groups = def.groups.map((g) => ({
      enemy: g.enemy,
      left: g.count,
      next: g.delay,
      interval: g.interval,
      burst: Math.max(1, g.burst ?? 1),
    }));
    this.pending = scheduledCount(def);
    this.events.emit('countdown', { wave: this.wave, seconds: this.countdownLeft });
    return true;
  }

  /** Advance time; returns enemies to spawn this tick. */
  update(dt: number): SpawnRequest[] {
    const out: SpawnRequest[] = [];
    if (this.phase === 'countdown') {
      this.countdownLeft -= dt;
      if (this.countdownLeft <= 0) {
        this.countdownLeft = 0;
        this.phase = 'active';
        this.events.emit('start', { wave: this.wave, def: this.current! });
      }
      return out;
    }
    if (this.phase !== 'active') return out;
    const def = this.current!;
    this.elapsed += dt;
    for (const g of this.groups) {
      while (g.left > 0 && this.elapsed >= g.next) {
        const n = Math.min(g.burst, g.left);
        for (let i = 0; i < n; i++) out.push({ enemy: g.enemy, healthMul: def.healthMul, speedMul: def.speedMul });
        g.left -= n;
        this.pending -= n;
        g.next += g.interval;
      }
    }
    return out;
  }

  notifySpawned(count = 1): void {
    this.alive += count;
  }

  /** Extra enemies that were not part of the schedule (e.g. Crawler bursts). */
  notifyExtraSpawned(count: number): void {
    this.alive += count;
  }

  notifyRemoved(count = 1): void {
    this.alive = Math.max(0, this.alive - count);
    this.checkCleared();
  }

  defeat(): void {
    this.phase = 'defeat';
  }

  private checkCleared(): void {
    if (this.phase !== 'active' || this.remaining > 0) return;
    const reward = this.rewardPaid.has(this.wave) ? 0 : this.waveReward(this.wave);
    this.rewardPaid.add(this.wave);
    if (this.isLastWave) {
      this.phase = 'victory';
      this.events.emit('cleared', { wave: this.wave, reward });
      this.events.emit('victory', { wave: this.wave });
    } else {
      this.phase = 'cleared';
      this.events.emit('cleared', { wave: this.wave, reward });
    }
  }
}
