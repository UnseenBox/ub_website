import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { FEATURES } from '../config/features';
import { LAYERS } from '../data/layers';
import { SCANNERS, TOOL_DEFS, type ToolDef } from '../data/tools';
import { ALL_TOOLS, ALL_UPGRADES, upgradePrice, type ToolItem, type UpgradeItem } from '../data/store';
import { FindSystem, FindsInventory, type FindItem } from '../systems/FindSystem';
import { FIND_BY_ID, FIND_CONFIG, type FindDef } from '../data/finds';
import { hardnessMult, relocationBonus, valueMult } from '../data/deposits';
import { PROSPECT_EFFECTS } from '../data/traits';
import { staminaUpgrades, toolWithUpgrades } from '../systems/ToolStats';
import { TraitSystem } from '../systems/TraitSystem';
import { generateRock, upgradeRock } from '../systems/RockGenerator';
import { ProgressSystem, ROCK_XP, clearSave, readSave, writeSave, type Goal } from '../systems/ProgressSystem';
import { DailyGoalSystem } from '../systems/DailyGoalSystem';
import type { DailyStrength } from '../data/dailyGoals';
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
  /** (rockIds: string[]) ids of rocks sitting on the cutting benches (empty when none). */
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
  /** (goal | null, bonus?) a daily goal was finished (null = all three done). */
  dailyGoalDone: 'daily-goal-done',
  /** Today's daily goals progressed, reset or were restored. */
  dailyGoalsChanged: 'daily-goals-changed',
  /** The tool in the player's hands changed. */
  toolChanged: 'tool-changed',
  /** (def: FindDef, item: FindItem, first: boolean) a find was dug up. */
  findFound: 'find-found',
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
  /** (slots) the bag grew: the bag row and the play area are laid out again. */
  capacityChanged: 'capacity-changed',
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
      this.daily.note('earn', delta);
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
  /** The store's skills: big hole, rage, ghost swings, junk skills, second wind, haggling. */
  readonly traits = new TraitSystem((id) => this.progress.upgradeLevel(id));
  readonly finds = new FindSystem();
  readonly findsInv = new FindsInventory();
  readonly finance = new FinanceSystem();
  readonly day = new DayCycleSystem(clockConfig(), GAME_CONFIG.day, {
    onPhase: (phase) => this.bus.emit(EVT.dayPhaseChanged, phase),
  });
  /**
   * The three small goals for the current working day. Disabled entirely by
   * FEATURES.v2: when off it creates nothing, saves nothing and draws nothing.
   */
  readonly daily = new DailyGoalSystem(
    {
      changed: () => {
        this.bus.emit(EVT.dailyGoalsChanged);
        this.save();
      },
      completed: (goal) => {
        this.economy.grant(goal.cash);
        this.bus.emit(EVT.dailyGoalDone, goal);
        this.save();
      },
      allDone: (bonus) => {
        this.economy.grant(bonus);
        this.bus.emit(EVT.dailyGoalDone, null, bonus);
        this.save();
      },
    },
    FEATURES.v2,
  );
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
      this.findsInv.restore(save.finds);
    }
    this.progress.ensureGoals();
    this.applyUpgrades();
    this.lastToolId = this.progress.equippedToolId;

    // Daily goals need the final tool/level/depth, so they are restored last.
    this.daily.restore(save?.daily, this.day.day, this.strength);
    if (FEATURES.v2) {
      // DigScene has no per-swing hook; wrapping the excavation call keeps the
      // "Dig N times" goal accurate without touching the scene or the system.
      const rawDig = this.dig.dig.bind(this.dig);
      this.dig.dig = (x, tool, boost) => {
        const result = rawDig(x, tool, boost);
        if (result.dug) this.daily.note('dig');
        return result;
      };
      // WorkshopScene emits this for every sale; a daily goal wants the best one.
      this.bus.on(EVT.sale, (amount: number) => this.daily.note('sale', amount, true));
    }
  }

  /** The tool in the player's hands, with the store's digging upgrades applied. */
  get tool(): ToolDef {
    if (!this.toolCache) {
      this.toolCache = toolWithUpgrades(
        TOOL_DEFS[this.progress.equippedToolId],
        (id) => this.progress.upgradeLevel(id),
        this.progress.deposit,
      );
    }
    return this.toolCache;
  }

  /** Deep Scanner owners see each uncut rock's rarity on its bag badge. */
  get showsRarity(): boolean {
    return this.progress.scanners.some((id) => SCANNERS[id]?.showsRarity);
  }

  /** What daily goals need to know about this player today. */
  get strength(): DailyStrength {
    return {
      level: this.progress.level,
      toolPower: this.tool.power,
      toolId: this.progress.equippedToolId,
      day: this.day.day,
      bestDepth: this.progress.bestDepth,
    };
  }

  /** Pushes store upgrades and gadgets into the systems they affect. */
  private applyUpgrades(): void {
    const st = staminaUpgrades((id) => this.progress.upgradeLevel(id));
    this.stamina.setUpgrades(st.maxBonus, st.regenBonus, st.costMult);
    this.dig.hardnessMult = hardnessMult(this.progress.deposit);
    const scannerBonus = this.progress.scanners.reduce((sum, id) => sum + (SCANNERS[id]?.findBonus ?? 0), 0);
    this.discovery.findBonus = scannerBonus + this.progress.upgradeLevel('up-find-chance') * PROSPECT_EFFECTS.findChancePerLevel;
    const slots = GAME_CONFIG.inventory.slots + this.progress.upgradeLevel('up-bag') * PROSPECT_EFFECTS.bagSlotsPerLevel;
    if (this.inventory.setCapacity(slots)) this.bus.emit(EVT.capacityChanged, slots);
    this.toolCache = null;
    const equipped = this.progress.equippedToolId;
    if (equipped !== this.lastToolId) {
      this.lastToolId = equipped;
      this.bus.emit(EVT.toolChanged);
    }
  }

  // ---------- deposits ----------

  /** Rocks and artifacts are worth more in later deposits. */
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
    if (item.minLevel !== undefined && this.progress.level < item.minLevel) return 'locked';
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
      if (up.minLevel !== undefined && this.progress.level < up.minLevel) continue;
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
    if (this.dreaming) return; // nothing of the dream is ever saved
    writeSave(
      this.progress.toSave({
        money: this.economy.money,
        day: this.day.day,
        found: this.stats.found,
        cut: this.stats.cut,
        finance: this.finance.toSave(),
        gameOver: this.finance.gameOver,
        finds: this.findsInv.toSave(),
        daily: this.daily.toSave(),
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

  /**
   * Number of cutting machines in the workshop. Always 1 outside v2; each
   * Extra Saws level adds one more (max 4). Persisted through the normal
   * upgrade save, so no new save format is needed.
   */
  get sawCount(): number {
    return FEATURES.v2 ? 1 + this.progress.upgradeLevel('up-saws') : 1;
  }

  /** Ids of rocks currently sitting on the benches, indexed by machine. */
  readonly placedRockIds: string[] = [];

  /** Replaces the bench occupancy list and notifies every listener (bag markings). */
  setPlacedRockIds(ids: readonly string[]): void {
    this.placedRockIds.length = 0;
    for (const id of ids) if (id) this.placedRockIds.push(id);
    this.bus.emit(EVT.placedChanged, [...this.placedRockIds]);
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
    this.daily.note('find');
    this.bus.emit(EVT.statsChanged);
  }

  /**
   * A find was dug up: it is stored or recorded, pays XP, but NEVER cash.
   * Rocks (cut open and sold) are the business; finds only add variety and surprise.
   */
  recordFindItem(def: FindDef, item: FindItem): { first: boolean } {
    let first = false;
    if (def.category === 'artifact') {
      this.findsInv.addArtifact(item);
    } else if (def.category === 'collection') {
      const result = this.findsInv.recordCollection(def.id);
      first = result.first;
      this.progress.note('curio');
    } else if (def.category === 'junk') {
      this.findsInv.recordJunk(def.id);
    }
    const table = FIND_CONFIG.xpByTier[def.category];
    const xp = (table[Math.min(def.tier, table.length - 1)] ?? 0) * (first && def.category === 'collection' ? 2 : 1);
    if (xp > 0) this.progress.addXp(xp);
    this.bus.emit(EVT.findFound, def, item, first);
    this.bus.emit(EVT.statsChanged);
    this.save();
    return { first };
  }

  /**
   * Sells a single artifact by its item id: the ONLY way an artifact turns into money.
   * (x, y) is where the coins start flying from, in screen pixels. Returns the amount received.
   */
  sellArtifact(id: string, x = 0, y = 0): number {
    const held = this.findsInv.artifacts.find((a) => a.id === id);
    const tier = held ? (FIND_BY_ID[held.defId]?.tier ?? 0) : 0;
    const amount = this.findsInv.sellArtifact(id);
    if (amount > 0) {
      this.economy.earn(amount);
      this.bus.emit(EVT.sale, amount, x, y, tier);
      this.bus.emit(EVT.statsChanged);
      this.save();
    }
    return amount;
  }

  /** Sells every artifact at once. Returns the total amount received. */
  sellAllArtifacts(x = 0, y = 0): number {
    const amount = this.findsInv.sellAllArtifacts();
    if (amount > 0) {
      this.economy.earn(amount);
      this.bus.emit(EVT.sale, amount, x, y, 3);
      this.bus.emit(EVT.statsChanged);
      this.save();
    }
    return amount;
  }

  /** Number of different collection items found. */
  get collectionFound(): number {
    return this.findsInv.collectionUnique;
  }

  /** Total number of collection items in the catalogue. */
  get collectionTotal(): number {
    return this.findsInv.collectionTotal;
  }

  /** Number of artifacts currently held. */
  get artifactCount(): number {
    return this.findsInv.artifacts.length;
  }

  /** Total value of artifacts currently held. */
  get artifactValue(): number {
    return this.findsInv.artifactValue;
  }

  /**
   * Master Cutter: just before a cut is revealed, the rock may turn out one rarity better. Returns true when
   * it did (the scene rebuilds the cross-section picture and shows it off).
   */
  rollLuckyCut(rock: Rock): boolean {
    if (!this.traits.rollLuckyCut(rock)) return false;
    upgradeRock(rock);
    return true;
  }

  /** Price multiplier for selling a rock (Haggler). */
  get sellMult(): number {
    return this.traits.sellMult;
  }

  recordCut(rock: Rock): void {
    this.stats.cut++;
    this.day.today.processed++;
    this.progress.note('cut');
    this.daily.note('cut');
    if (rock.rarity.tier >= 2) {
      this.progress.note('rare');
      this.daily.note('rare');
    }
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
    this.daily.note('depth', this.dig.deepestMeters, true);
    if (!this.dreaming) this.day.tick(deltaMs, this.rocksLeft); // the clock is frozen in the dream
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
      // Retention update: a player who can afford the overdue payment never loses by missing a button; the bank collects it.
      if (FEATURES.v2 && this.finance.overdue > 0 && this.economy.money >= this.finance.overdue) {
        const collected = this.finance.pay(this.finance.overdue, this.economy.money);
        if (collected > 0) {
          this.economy.spend(collected);
          this.bus.emit(EVT.financeChanged);
          this.bus.emit(EVT.toast, `The bank collected $${Math.round(collected).toLocaleString('en-US')}`);
        }
      }
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
    this.daily.reset(this.day.day, this.strength);
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
  // ---------- the dream (retention update) ----------

  private dreaming = false;

  /** True while the opening dream is being played. */
  get inDream(): boolean {
    return this.dreaming;
  }

  private dreamRockIds: string[] = [];

  /** The dream's own rocks are all cut (or already sold): time to wake up. */
  get dreamRocksCut(): boolean {
    return this.dreamRockIds.length > 0 && this.dreamRockIds.every((id) => {
      const i = this.inventory.indexOf(id);
      return i < 0 || !!this.inventory.get(i)?.cut;
    });
  }

  /**
   * The opening dream: the real game with everything maxed out. Every digging tool is owned (the best one is in the
   * hands), every upgrade and skill is at half of its maximum, and the bag holds a few fancy rocks to cut. Nothing is saved
   * and the clock is frozen until `endDream()`.
   */
  beginDream(): void {
    this.dreaming = true;
    for (const t of ALL_TOOLS) if (!t.placeholder) this.progress.own(t.id);
    // Half of every upgrade (rounded up), with the best tool: strong, but the climb is still ahead.
    for (const up of ALL_UPGRADES) this.progress.setUpgradeLevel(up.id, Math.ceil((up.id === 'up-mastery' ? 10 : up.maxLevel) / 2));
    this.applyUpgrades();
    this.stamina.reset();
    // Epic and legendary rocks, so there is something impressive to put on the saw.
    this.dreamRockIds = [];
    for (let i = 0; i < 3; i++) {
      const rock = generateRock(Math.random, [0, 0, 0, 3, 2, 0], 3, 6 + i);
      this.dreamRockIds.push(rock.id);
      this.inventory.add(rock);
    }
    this.bus.emit(EVT.inventoryChanged);
  }

  /**
   * Empties the bag. The dream uses it to catch a rock that was still flying through the air when the run was reset,
   * and that landed in the new, empty bag a moment later.
   */
  clearBag(): void {
    for (let i = 0; i < this.inventory.capacity; i++) {
      const rock = this.inventory.get(i);
      if (rock) this.inventory.remove(rock.id);
    }
    // Rocks still in flight when the run was reset were counted as finds of the new run: zero those again.
    for (const goal of this.progress.goals) goal.progress = 0;
    this.stats.found = 0;
    this.bus.emit(EVT.progressChanged);
  }

  /** The dream is over: everything is taken away again (Old Shovel, $0, day 1). */
  endDream(): void {
    this.dreaming = false;
    this.resetRun();
  }

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

    for (let i = 0; i < this.inventory.capacity; i++) {
      const rock = this.inventory.get(i);
      if (rock) this.inventory.remove(rock.id);
    }

    this.dig.reset();
    this.dig.hardnessMult = 1;
    this.discovery.findBonus = 0;
    this.traits.reset();

    this.progress.reset();
    this.progress.ensureGoals();
    this.applyUpgrades();
    this.toolCache = null;
    this.lastToolId = this.progress.equippedToolId;

    this.findsInv.reset();
    this.finds.reset();

    this.currentMode = 'dig';
    this.setMode('dig');
    this.setBusy(false);
    this.activity = 0;

    this.daily.reset(1, this.strength);
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
