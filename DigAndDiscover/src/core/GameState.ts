import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { LAYERS } from '../data/layers';
import { SCANNERS, TOOL_DEFS, UPGRADE_EFFECTS, type ToolDef } from '../data/tools';
import { ALL_TOOLS, ALL_UPGRADES, upgradePrice, type ToolItem, type UpgradeItem } from '../data/store';
import { hardnessMult, powerMult, relocationBonus, valueMult } from '../data/deposits';
import { ProgressSystem, ROCK_XP, clearSave, readSave, writeSave, type Goal } from '../systems/ProgressSystem';
import { FinanceSystem, type DaySettlement, type FinanceDaySummary, type LedgerView } from '../systems/FinanceSystem';
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
  /** Level, XP, goals, owned tools or upgrades changed. */
  progressChanged: 'progress-changed',
  /** (level, bonusCash) */
  levelUp: 'level-up',
  /** (goal) a goal was finished and paid out. */
  goalDone: 'goal-done',
  /** The tool in the player's hands changed. */
  toolChanged: 'tool-changed',
  /** The digger struck bedrock: time to offer a new deposit. */
  bedrock: 'bedrock',
  /** (newDepositNumber, bonusCash) the digger moved to a fresh deposit. */
  relocated: 'relocated',
  /** The household bill, the debt or the payment schedule changed. */
  financeChanged: 'finance-changed',
  /** (reason) the run ended: the monthly deadline was missed. */
  gameOver: 'game-over',
  /** The whole run was restarted from scratch. */
  runReset: 'run-reset',
} as const;

export type BuyResult = 'ok' | 'poor' | 'locked' | 'owned' | 'maxed' | 'weaker' | 'unavailable';

/**
 * Shared game state for all scenes: the gameplay systems plus a small event
 * bus. Systems stay framework-free; only the bus uses Phaser's emitter.
 */
export class GameState {
  readonly bus = new Phaser.Events.EventEmitter();
  readonly stamina = new StaminaSystem(GAME_CONFIG.stamina);
  readonly inventory = new InventorySystem(GAME_CONFIG.inventory.slots, () => this.bus.emit(EVT.inventoryChanged));
  readonly economy = new EconomySystem(GAME_CONFIG.economy.startingMoney, (money, delta, earned) => {
    if (earned) {
      this.day.today.earned += delta;
      this.progress.note('earn', delta);
    }
    this.bus.emit(EVT.moneyChanged, money, delta, earned);
    this.save();
  });
  readonly progress: ProgressSystem = new ProgressSystem({
    changed: () => {
      this.applyUpgrades();
      this.bus.emit(EVT.progressChanged);
      this.save();
    },
    levelUp: (level, bonus) => this.bus.emit(EVT.levelUp, level, bonus),
    goalDone: (goal: Goal) => this.bus.emit(EVT.goalDone, goal),
    grant: (cash) => this.economy.grant(cash),
  });
  readonly layers = LAYERS;
  readonly dig = new ExcavationSystem(GAME_CONFIG.world, LAYERS, (index) => {
    this.bus.emit(EVT.layerEntered, index);
    // A new layer is a milestone (paid once per deposit, so reloading cannot farm it).
    if (index > 0 && this.progress.claimLayer(index)) this.progress.addXp(25 * index);
  });
  readonly discovery = new DiscoverySystem();
  readonly finance = new FinanceSystem();
  readonly day = new DayCycleSystem(clockConfig(), GAME_CONFIG.day, {
    onPhase: (phase) => this.bus.emit(EVT.dayPhaseChanged, phase),
  });
  private toolCache: ToolDef | null = null;
  private lastToolId = 'tool-old-shovel';
  readonly stats = { found: 0, cut: 0, best: null as Rock | null };
  /** The bill of the day that just ended (used by the end-of-day screen). */
  private financeSettlement: DaySettlement | null = null;
  /** True once the bill of the current day was settled. */
  private settlementDone = false;
  /** True once the game over event was sent out. */
  private gameOverAnnounced = false;

  constructor() {
    this.progress.setTotalDepth(this.dig.totalMeters);
    const save = readSave();
    if (save) {
      this.progress.restore(save);
      this.economy.load(save.money);
      this.day.day = Math.max(1, save.day | 0);
      this.stats.found = save.found | 0;
      this.stats.cut = save.cut | 0;
      this.finance.restore(save.finance);
      if (!this.finance.gameOver && typeof save.gameOver === 'string') this.finance.gameOver = save.gameOver;
    }
    this.progress.ensureGoals();
    this.applyUpgrades();
    this.lastToolId = this.progress.equippedToolId;
  }

  /** The tool in the player's hands, with the store's digging upgrades applied. */
  get tool(): ToolDef {
    if (!this.toolCache) {
      const base = TOOL_DEFS[this.progress.equippedToolId];
      const experience = powerMult(this.progress.deposit) * (1 + UPGRADE_EFFECTS.masteryPerLevel * this.progress.upgradeLevel('up-mastery'));
      const dmg = this.progress.upgradeLevel('up-dig-damage');
      const spd = this.progress.upgradeLevel('up-dig-speed');
      this.toolCache = {
        ...base,
        power: base.power * experience,
        digDepth: base.digDepth * (1 + UPGRADE_EFFECTS.digDepthPerLevel * dmg),
        swingCooldownMs: base.swingCooldownMs * (1 - UPGRADE_EFFECTS.cooldownReductionPerLevel * spd),
      };
    }
    return this.toolCache;
  }

  /** Deep Scanner owners see each uncut rock's rarity on its bag badge. */
  get showsRarity(): boolean {
    return this.progress.scanners.some((id) => SCANNERS[id]?.showsRarity);
  }

  /** Pushes store upgrades and gadgets into the systems they affect. */
  private applyUpgrades(): void {
    const lv = (id: string) => this.progress.upgradeLevel(id);
    this.stamina.setUpgrades(
      lv('up-stamina-tank') * UPGRADE_EFFECTS.staminaPerLevel,
      lv('up-stamina-regen') * UPGRADE_EFFECTS.regenPerLevel,
      1 - lv('up-stamina-efficiency') * UPGRADE_EFFECTS.costReductionPerLevel,
    );
    this.dig.hardnessMult = hardnessMult(this.progress.deposit);
    this.discovery.findBonus = this.progress.scanners.reduce((sum, id) => sum + (SCANNERS[id]?.findBonus ?? 0), 0);
    this.toolCache = null;
    const equipped = this.progress.equippedToolId;
    if (equipped !== this.lastToolId) {
      this.lastToolId = equipped;
      this.bus.emit(EVT.toolChanged);
    }
  }

  // ---------- deposits ----------

  /** Rocks are worth more in later deposits. */
  get depositValueMult(): number {
    return valueMult(this.progress.deposit);
  }

  /** Cash the current deposit pays when the digger relocates away from it. */
  get relocationBonus(): number {
    return relocationBonus(this.progress.deposit);
  }

  /** Bedrock reached: a new deposit can be started. */
  get canRelocate(): boolean {
    return this.dig.atBottom;
  }

  /** Moves to a fresh deposit. The scenes restart the ground when they hear `relocated`. */
  relocate(): boolean {
    if (!this.canRelocate) return false;
    const bonus = this.relocationBonus;
    this.economy.grant(bonus);
    this.progress.advanceDeposit();
    this.dig.reset();
    this.bus.emit(EVT.relocated, this.progress.deposit, bonus);
    return true;
  }

  // ---------- store ----------

  buyTool(item: ToolItem): BuyResult {
    if (item.placeholder) return 'unavailable';
    if (this.progress.owns(item.id)) return 'owned';
    if (this.progress.level < item.minLevel) return 'locked';
    if (item.kind === 'dig' && TOOL_DEFS[item.id].power <= TOOL_DEFS[this.progress.equippedToolId].power) return 'weaker';
    if (!this.economy.spend(item.price)) return 'poor';
    this.progress.own(item.id);
    this.progress.note('buy');
    return 'ok';
  }

  buyUpgrade(item: UpgradeItem): BuyResult {
    const level = this.progress.upgradeLevel(item.id);
    if (level >= item.maxLevel) return 'maxed';
    if (!this.economy.spend(upgradePrice(item, level))) return 'poor';
    this.progress.setUpgradeLevel(item.id, level + 1);
    this.progress.note('buy');
    return 'ok';
  }

  /** Something in the store is unlocked, useful and affordable right now (drives the "!" badge). */
  get storeHasDeal(): boolean {
    const money = this.economy.money;
    for (const up of ALL_UPGRADES) {
      const lv = this.progress.upgradeLevel(up.id);
      if (lv < up.maxLevel && upgradePrice(up, lv) <= money) return true;
    }
    const power = TOOL_DEFS[this.progress.equippedToolId].power;
    return ALL_TOOLS.some(
      (t) =>
        !t.placeholder &&
        !this.progress.owns(t.id) &&
        this.progress.level >= t.minLevel &&
        t.price <= money &&
        (t.kind === 'scanner' || TOOL_DEFS[t.id].power > power),
    );
  }

  private save(): void {
    writeSave(
      this.progress.toSave({
        money: this.economy.money,
        day: this.day.day,
        found: this.stats.found,
        cut: this.stats.cut,
        finance: this.finance.toSave(),
        gameOver: this.finance.gameOver,
      }),
    );
  }

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

  /** At least one uncut rock: the workshop can be visited (it just is not urgent yet). */
  get workshopAvailable(): boolean {
    return this.inventory.uncutCount > 0;
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
    this.progress.note('find');
    this.bus.emit(EVT.statsChanged);
  }

  recordCut(rock: Rock): void {
    this.stats.cut++;
    this.day.today.processed++;
    this.progress.note('cut');
    if (rock.rarity.tier >= 2) this.progress.note('rare');
    this.progress.addXp(ROCK_XP[rock.rarity.tier] ?? 3);
    if (!this.stats.best || rock.value > this.stats.best.value) this.stats.best = rock;
    this.bus.emit(EVT.statsChanged);
  }

  /** Advance every time-based system. Called once per frame with the (clamped) frame time. */
  tick(deltaMs: number): void {
    if (this.isGameOver) {
      // A run that ended stays ended: nothing moves any more.
      if (!this.gameOverAnnounced) {
        this.gameOverAnnounced = true;
        this.bus.emit(EVT.gameOver, this.finance.gameOver);
      }
      return;
    }
    this.stamina.update(deltaMs);
    this.progress.note('depth', this.dig.deepestMeters, true);
    this.day.tick(deltaMs, this.rocksLeft);
    if (this.day.readyForSummary(this.somethingRunning, this.rocksLeft)) {
      this.day.openSummary();
      this.settleFinance();
      this.bus.emit(EVT.daySummary, this.buildSummary());
    }
  }

  /** Takes the household bill of the finished day out of the player's money. */
  private settleFinance(): void {
    if (this.settlementDone) return;
    this.settlementDone = true;
    const settlement = this.finance.settleDay(this.economy.money);
    if (settlement.paid > 0) this.economy.spend(settlement.paid);
    this.financeSettlement = settlement;
    this.bus.emit(EVT.financeChanged);
  }

  /** The household bill and the debt of the day that just ended. */
  private buildFinanceSummary(): FinanceDaySummary {
    const settlement = this.financeSettlement;
    const view = this.finance.view();
    return {
      items: settlement ? settlement.items : [],
      carriedIn: settlement ? settlement.carriedIn : 0,
      due: settlement ? settlement.due : 0,
      paid: settlement ? settlement.paid : 0,
      carriedOut: settlement ? settlement.carriedOut : 0,
      installmentIssued: settlement ? settlement.installmentIssued : 0,
      overdue: settlement ? settlement.overdue : 0,
      isMonthEnd: settlement ? settlement.isMonthEnd : false,
      daysLeftInMonth: settlement ? settlement.daysLeftInMonth : view.daysLeftInMonth,
      debtRemaining: view.debtRemaining,
      moneyAfterPayment: this.economy.money,
    };
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
      finance: this.buildFinanceSummary(),
    };
  }

  /**
   * Called by the end-of-day screen. Money, rocks and excavation progress stay
   * as they are; only the clock, the day counter and stamina reset.
   */
  startNextDay(): void {
    if (this.day.phase !== 'summary') return;
    const view = this.finance.view();
    if (view.dayInMonth === view.monthDays) {
      // The month is over: anything still overdue ends the run.
      const check = this.finance.evaluateMonth();
      if (!check.ok) {
        this.finance.triggerGameOver(check.reason ?? 'The debt caught up with the family.');
        this.gameOverAnnounced = true;
        this.bus.emit(EVT.gameOver, this.finance.gameOver);
        this.save();
        return;
      }
    }
    this.finance.startNextDay();
    this.settlementDone = false;
    this.financeSettlement = null;
    this.stamina.reset();
    this.day.startNextDay();
    this.bus.emit(EVT.dayStarted, this.day.day);
    this.save();
  }

  // ---------- household ledger ----------

  /** A snapshot of the ledger for the UI. */
  get ledger(): LedgerView {
    return this.finance.view();
  }

  /** True when there is an unpaid debt instalment or an unpaid household bill. */
  get hasOverdue(): boolean {
    return this.finance.overdue > 0 || this.finance.billsOutstanding > 0;
  }

  /** True once the run has ended. */
  get isGameOver(): boolean {
    return this.finance.gameOver !== null;
  }

  /** Settles household bills that were carried forward, out of the player's money. */
  private payCarriedBills(): number {
    const paid = this.finance.payBills(this.economy.money);
    if (paid > 0) this.economy.spend(paid);
    return paid;
  }

  /**
   * Pays the household first (bills carried forward), then the bank with whatever is
   * left, up to `amount`. The cash comes out of the player's money. Returns the total paid.
   */
  payDebt(amount: number): number {
    const bills = this.payCarriedBills();
    const paid = this.finance.pay(amount, this.economy.money);
    if (paid > 0) this.economy.spend(paid);
    if (bills + paid > 0) this.bus.emit(EVT.financeChanged);
    return bills + paid;
  }

  /**
   * Pays what is due: the household bills carried forward and the overdue debt. With
   * nothing due it pays the next instalment ahead of time.
   */
  payDebtDue(): number {
    const bills = this.payCarriedBills();
    // Overdue debt is due; otherwise only prepay when there were no bills to clear either.
    const instalment =
      this.finance.overdue > 0 || bills === 0 ? this.finance.payInstallment(this.economy.money) : 0;
    if (instalment > 0) this.economy.spend(instalment);
    if (bills + instalment > 0) this.bus.emit(EVT.financeChanged);
    return bills + instalment;
  }

  /**
   * Starts the run from scratch: money, day, dig, bag, upgrades, collections,
   * bills and debt are all cleared and the save file is removed. The audio
   * mute preference is not touched.
   */
  resetRun(): void {
    this.economy.reset(GAME_CONFIG.economy.startingMoney);
    this.finance.reset();
    this.financeSettlement = null;
    this.settlementDone = false;
    this.gameOverAnnounced = false;

    this.day.reset();
    this.stamina.reset();
    this.stamina.setUpgrades(0, 0, 1);

    this.stats.found = 0;
    this.stats.cut = 0;
    this.stats.best = null;

    for (let i = 0; i < GAME_CONFIG.inventory.slots; i++) {
      const rock = this.inventory.get(i);
      if (rock) this.inventory.remove(rock.id);
    }

    this.dig.reset();
    this.dig.hardnessMult = 1;
    this.discovery.findBonus = 0;

    this.progress.reset();
    this.progress.ensureGoals();
    this.applyUpgrades();
    this.toolCache = null;
    this.lastToolId = this.progress.equippedToolId;

    this.currentMode = 'dig';
    this.setMode('dig');
    this.setBusy(false);
    this.activity = 0;

    clearSave();
    this.bus.emit(EVT.runReset);
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
