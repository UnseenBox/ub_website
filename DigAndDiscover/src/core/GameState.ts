import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { LAYERS } from '../data/layers';
import { STARTER_TOOL, type ToolDef } from '../data/tools';
import type { ClockConfig } from '../systems/ClockSystem';
import { DayCycleSystem, type DayPhase, type DaySummary } from '../systems/DayCycleSystem';
import { DiscoverySystem } from '../systems/DiscoverySystem';
import { EconomySystem } from '../systems/EconomySystem';
import { ExcavationSystem } from '../systems/ExcavationSystem';
import { InventorySystem } from '../systems/InventorySystem';
import { StaminaSystem } from '../systems/StaminaSystem';
import type { GameMode, Rock } from './types';

/** Names of every cross-scene event on the state bus. */
export const EVT = {
  inventoryChanged: 'inventory-changed',
  moneyChanged: 'money-changed',
  statsChanged: 'stats-changed',
  modeChanged: 'mode-changed',
  busyChanged: 'busy-changed',
  /** (rock, screenX, screenY, displayScale) a rock popped out of the dirt. */
  rockCollected: 'rock-collected',
  /** (rockId) player tapped an inventory slot while in the workshop. */
  slotSelected: 'slot-selected',
  /** (rockId | null) rock currently sitting on the cutting bench. */
  placedChanged: 'placed-changed',
  /** (amount, screenX, screenY, tier) */
  sale: 'sale',
  /** (message) */
  toast: 'toast',
  staminaDenied: 'stamina-denied',
  /** (layerIndex) the shaft reached a deeper geological layer for the first time. */
  layerEntered: 'layer-entered',
  /** (phase) 'working' | 'closing' | 'summary' */
  dayPhaseChanged: 'day-phase-changed',
  /** (summary) the end-of-day screen should open. */
  daySummary: 'day-summary',
  /** (dayNumber) a fresh working day just began. */
  dayStarted: 'day-started',
} as const;

/**
 * Shared game state for all scenes: the gameplay systems plus a small event
 * bus. Systems stay framework-free; only the bus uses Phaser's emitter.
 */
export class GameState {
  readonly bus = new Phaser.Events.EventEmitter();
  readonly stamina = new StaminaSystem(GAME_CONFIG.stamina);
  readonly inventory = new InventorySystem(GAME_CONFIG.inventory.slots, () => this.bus.emit(EVT.inventoryChanged));
  readonly economy = new EconomySystem(GAME_CONFIG.economy.startingMoney, (money, delta) => {
    if (delta > 0) this.day.today.earned += delta;
    this.bus.emit(EVT.moneyChanged, money, delta);
  });
  readonly layers = LAYERS;
  readonly dig = new ExcavationSystem(GAME_CONFIG.world, LAYERS, (index) => this.bus.emit(EVT.layerEntered, index));
  readonly discovery = new DiscoverySystem();
  readonly day = new DayCycleSystem(clockConfig(), GAME_CONFIG.day, {
    onPhase: (phase) => this.bus.emit(EVT.dayPhaseChanged, phase),
  });
  /** Equipped tool. Swapping it (a future shop feature) is all the dig code needs. */
  tool: ToolDef = STARTER_TOOL;
  readonly stats = { found: 0, cut: 0, best: null as Rock | null };

  private currentMode: GameMode = 'dig';
  private workshopBusy = false;
  private activity = 0;

  get mode(): GameMode {
    return this.currentMode;
  }

  get busy(): boolean {
    return this.workshopBusy;
  }

  /** New digging may start (the working day is still on). */
  get canWork(): boolean {
    return this.day.canWork;
  }

  /** Rocks may be cut and sold: all day, and after closing time until the bag is empty. */
  get canCut(): boolean {
    return this.day.canCut;
  }

  /** Rocks still in the bag. After closing time every one of them must be cut and sold before the day ends. */
  get rocksLeft(): number {
    return this.inventory.count;
  }

  /** Enough uncut rocks to make a trip to the workshop worthwhile. */
  get workshopReady(): boolean {
    const uncut = this.inventory.uncutCount;
    return uncut >= GAME_CONFIG.inventory.rocksToUnlockWorkshop || (uncut > 0 && this.inventory.isFull);
  }

  setMode(mode: GameMode): void {
    if (mode === this.currentMode) return;
    this.currentMode = mode;
    this.bus.emit(EVT.modeChanged, mode);
  }

  setBusy(busy: boolean): void {
    if (busy === this.workshopBusy) return;
    this.workshopBusy = busy;
    this.bus.emit(EVT.busyChanged, busy);
  }

  /** Scenes mark short animations (a rock popping out, ...) so closing time waits for them. */
  beginActivity(): void {
    this.activity++;
  }

  endActivity(): void {
    this.activity = Math.max(0, this.activity - 1);
  }

  get somethingRunning(): boolean {
    // Only a cut that is actually under way in the workshop counts; the bag itself is checked through rocksLeft.
    return (this.workshopBusy && this.currentMode === 'workshop') || this.activity > 0;
  }

  recordFind(): void {
    this.stats.found++;
    this.day.today.found++;
    this.bus.emit(EVT.statsChanged);
  }

  recordCut(rock: Rock): void {
    this.stats.cut++;
    this.day.today.processed++;
    if (!this.stats.best || rock.value > this.stats.best.value) this.stats.best = rock;
    this.bus.emit(EVT.statsChanged);
  }

  /** Advance every time-based system. Called once per frame with the (clamped) frame time. */
  tick(deltaMs: number): void {
    this.stamina.update(deltaMs);
    this.day.tick(deltaMs, this.rocksLeft);
    if (this.day.readyForSummary(this.somethingRunning, this.rocksLeft)) {
      this.day.openSummary();
      this.bus.emit(EVT.daySummary, this.buildSummary());
    }
  }

  buildSummary(): DaySummary {
    const clock = this.day.clock;
    const { startHour, endHour } = GAME_CONFIG.clock;
    return {
      day: this.day.day,
      hoursWorked: Math.round(clock.hoursWorked * 10) / 10,
      startLabel: hourLabel(startHour),
      endLabel: hourLabel(endHour),
      rocksDiscovered: this.day.today.found,
      rocksProcessed: this.day.today.processed,
      moneyEarned: this.day.today.earned,
      totalMoney: this.economy.money,
      totalDiscoveries: this.stats.found,
      depthMeters: this.dig.focusMeters,
      maxDepthMeters: this.dig.deepestMeters,
      depthFraction: this.dig.progress,
      layerName: LAYERS[this.dig.deepestLayerIndex].name,
      layerIndex: this.dig.deepestLayerIndex + 1,
      layerCount: LAYERS.length,
    };
  }

  /**
   * Called by the end-of-day screen. Money, rocks and excavation progress stay
   * as they are; only the clock, the day counter and stamina reset.
   */
  startNextDay(): void {
    if (this.day.phase !== 'summary') return;
    this.stamina.reset();
    this.day.startNextDay();
    this.bus.emit(EVT.dayStarted, this.day.day);
  }
}

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 === 0 ? 12 : hour % 12}:00 ${suffix}`;
}

/** The clock config, with an optional ?secondsPerHour=N override for quick testing. */
function clockConfig(): ClockConfig {
  try {
    const raw = new URLSearchParams(window.location.search).get('secondsPerHour');
    const n = raw === null ? NaN : Number(raw);
    if (Number.isFinite(n) && n > 0) return { ...GAME_CONFIG.clock, secondsPerHour: n };
  } catch {
    /* no window or blocked access: use the default */
  }
  return GAME_CONFIG.clock;
}

export const state = new GameState();

export type { DayPhase, DaySummary };

/** Subscribes a scene to the bus and unsubscribes automatically on shutdown. */
export function subscribe(scene: Phaser.Scene, event: string, fn: (...args: any[]) => void): void {
  state.bus.on(event, fn, scene);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => state.bus.off(event, fn, scene));
}
