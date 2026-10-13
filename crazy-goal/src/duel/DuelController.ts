import type { DuelTemplate } from '../../data/duel/rounds';
import { asBoost, asTrick, cardOf, CARDS, type CardId, type Trick } from '../abilities/Cards';
import type { Game, ShotOutcome } from '../core/Game';
import { tr } from '../core/i18n';
import { portal } from '../portal/Portal';
import { C } from '../rendering/Palette';
import type { Overlay } from '../ui/Overlay';
import { DuelApi, DuelApiError, type DuelData, type DuelMode, type ShotRecord } from './DuelApi';
import { buildDuelLevel, cardsIn, modeOf, roundsFor, roundsIn, shutterSide } from './DuelLevels';
import { DuelUi, type CardView, type LobbyRow, type Rival, type RowIcon } from './DuelUi';

const LOBBY_POLL = 5;
const WAIT_POLL = 2;
/** How long your own result stays up before the duel moves on to your friend's shot. */
const AFTER_GOAL = 3.6;
const AFTER_MISS = 1.6;
const SEEN_KEY = 'crazy-goal-duel-seen';
const RIVALS_KEY = 'crazy-goal-duel-rivals';
const HELPED_KEY = 'crazy-goal-duel-helped';
/** The two duelists' colours. Whoever sent the challenge is blue; whoever accepted is terracotta. */
const TEAM = ['#1f5fa8', '#cf5c36'] as const;

/** What the server's refusals mean in words a player can act on. */
const REASONS: Readonly<Record<string, string>> = {
  offline: 'DUELS NEED A CONNECTION TO UNSEENBOX.COM.',
  no_such_player: 'NOBODY HAS THAT ID. CHECK IT AND TRY AGAIN.',
  that_is_you: 'THAT IS YOUR OWN ID.',
  slow_down: 'TOO MANY CHALLENGES. TAKE A BREATH.',
  no_database: 'THE DUEL SERVER IS NOT SET UP HERE.',
  no_such_duel: 'THAT DUEL IS FROM AN OLDER VERSION. START A NEW ONE.',
};

type Phase = 'idle' | 'lobby' | 'attack' | 'after' | 'watch' | 'wait' | 'done';

/** Something to do a little later in the current phase: a second banner, the start of a replay. */
interface Cue {
  at: number;
  run: () => void;
}

/**
 * Runs a duel from the lobby to the final whistle. It never simulates anything itself: it
 * decides what this player should be doing next from the duel's state, loads the right
 * street into the game, and sends each shot to the server. Everything is turn based, so the
 * two players can be online together or hours apart.
 *
 * A round goes: you take your shot (with a card, if you like), you watch your friend's shot
 * at the same street, and the next round opens once both are in.
 */
export class DuelController {
  /** True from entering a duel until leaving it. */
  active = false;
  private readonly api = new DuelApi();
  private readonly ui: DuelUi;
  private phase: Phase = 'idle';
  private duel: DuelData | null = null;
  private templates: DuelTemplate[] = [];
  private side: 0 | 1 = 0;
  private round = 0;
  /** This duel's mode and length. Old duels without a mode play as Classic ten. */
  private mode: DuelMode = 'classic';
  private total = 10;
  /** The mode picked in the lobby for the next challenge. */
  private picked: DuelMode = 'classic';
  /** Just walked in: round one opens with a VS splash. */
  private freshEnter = false;
  private pollIn = 0;
  private polling = false;
  /** Counts down from a shot to moving on. */
  private continueIn = -1;
  /** A shot that has been taken but not yet accepted by the server. */
  private unsent: ShotRecord | null = null;
  /** The card held up for this shot, and the one that actually went with it. */
  private selected: CardId | null = null;
  private played: CardId | null = null;
  private clock = 0;
  private cues: Cue[] = [];

  constructor(
    private readonly game: Game,
    overlay: Overlay,
    app: HTMLElement,
  ) {
    this.ui = new DuelUi(overlay, app, {
      challenge: (code) => void this.challenge(code),
      mode: (mode) => this.pickMode(mode),
      rival: (id) => void this.challenge(id),
      copyId: () => void this.copyId(),
      rename: (name) => void this.rename(name),
      enter: (id) => void this.enterById(id),
      back: () => this.close(),
      invite: () => void this.invite(),
      help: () => this.showHelp(() => void this.open()),
      card: (id) => this.pickCard(id),
      pause: () => this.game.setPaused(true),
    });
  }

  /**
   * Opens the lobby: finds or creates this browser's player, then lists their duels.
   * `friend` is an id from an invite link, put in the box ready to challenge.
   */
  async open(friend = ''): Promise<void> {
    this.phase = 'lobby';
    this.cues = [];
    this.ui.showLobby(this.api.identity?.id ?? '......', this.api.identity?.name ?? '');
    this.ui.setModes(this.picked);
    this.ui.setRivals(this.rivals());
    this.ui.setNote('');
    try {
      const me = await this.api.hello();
      if (this.phase !== 'lobby') return;
      this.ui.showLobby(me.id, me.name);
      const code = friend.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (code && code !== me.id) {
        this.ui.setFriend(code);
        this.ui.setNote(tr('{id} INVITED YOU. TAP CHALLENGE TO START.', { id: code }));
      }
      await this.refreshLobby();
    } catch (error) {
      this.ui.setNote(this.reason(error));
    }
  }

  private pickMode(mode: DuelMode): void {
    this.picked = mode;
    this.game.audio.unlock();
    this.game.sounds.ui();
    this.ui.setModes(mode);
  }

  /** Your own id, copied for pasting anywhere. */
  private async copyId(): Promise<void> {
    const me = this.api.identity;
    if (!me) return;
    try {
      await navigator.clipboard.writeText(me.id);
      this.ui.flashInvite('COPIED');
    } catch {
      /* the id stays on show; nothing better to do */
    }
  }

  /** Recent opponents, newest first. */
  private rivals(): Rival[] {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(RIVALS_KEY) ?? '[]');
      if (!Array.isArray(raw)) return [];
      const out: Rival[] = [];
      for (const r of raw) {
        if (out.length >= 5) break;
        const v = r as Partial<Rival>;
        if (typeof v.id === 'string' && v.id && !out.some((o) => o.id === v.id)) out.push({ id: v.id, name: typeof v.name === 'string' ? v.name : '' });
      }
      return out;
    } catch {
      return [];
    }
  }

  private noteRival(id: string, name: string): void {
    const me = this.api.identity;
    if (!id || (me && id === me.id)) return;
    try {
      localStorage.setItem(RIVALS_KEY, JSON.stringify([{ id, name }, ...this.rivals().filter((r) => r.id !== id)].slice(0, 5)));
    } catch {
      /* rivals are a shortcut, not a promise */
    }
    if (this.phase === 'lobby') this.ui.setRivals(this.rivals());
  }

  private close(): void {
    this.phase = 'idle';
    this.active = false;
    this.duel = null;
    this.cues = [];
    this.ui.setAction(null, null);
    this.ui.hideCards();
    this.game.returnToMenu();
  }

  private reason(error: unknown): string {
    const code = error instanceof DuelApiError ? error.code : 'offline';
    return tr(REASONS[code] ?? 'SOMETHING WENT WRONG. TRY AGAIN.');
  }

  private async rename(name: string): Promise<void> {
    try {
      const me = await this.api.hello(name);
      if (this.phase === 'lobby') this.ui.showLobby(me.id, me.name);
    } catch (error) {
      this.ui.setNote(this.reason(error));
    }
  }

  /** Hands the player a link that opens the game on the lobby with their id filled in. */
  private async invite(): Promise<void> {
    const me = this.api.identity;
    if (!me) return;
    const url = `${location.origin}${location.pathname}?duel=${me.id}`;
    const text = `Duel me at CRAZY KORA. My ID is ${me.id}.`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'CRAZY KORA', text, url });
        return;
      }
    } catch {
      /* the share sheet was closed, or is not allowed here: fall back to copying */
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      this.ui.flashInvite('COPIED');
      this.ui.setNote(tr('LINK COPIED. SEND IT TO A FRIEND.'));
    } catch {
      this.ui.setNote(tr('SEND YOUR FRIEND THIS ID: {id}', { id: me.id }));
    }
  }

  private async challenge(code: string): Promise<void> {
    const id = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!id) {
      this.ui.setNote(tr("TYPE YOUR FRIEND'S ID FIRST."));
      return;
    }
    this.ui.setNote(tr('SENDING...'));
    try {
      const duel = await this.api.challenge(id, this.picked);
      this.ui.setFriend('');
      this.enter(duel);
    } catch (error) {
      this.ui.setNote(this.reason(error));
    }
  }

  private async enterById(id: string): Promise<void> {
    try {
      this.enter(await this.api.get(id));
    } catch (error) {
      this.ui.setNote(this.reason(error));
    }
  }

  private async refreshLobby(): Promise<void> {
    const me = this.api.identity;
    if (!me) return;
    const duels = await this.api.list();
    if (this.phase !== 'lobby') return;
    this.ui.setRows(duels.map((d) => this.lobbyRow(d, me.id)));
  }

  private lobbyRow(d: DuelData, myId: string): LobbyRow {
    const side = d.players[0].id === myId ? 0 : 1;
    const other = d.players[1 - side];
    const seen = this.seen(d.id);
    const [mine, theirs] = tally(d, side, seen);
    const next = nextStep(d, side, seen);
    const n = next.round + 1;
    const mode = modeOf(d.mode);
    let icon: RowIcon;
    let status: string;
    if (next.kind === 'done') {
      const draw = mine.goals === theirs.goals && mine.points === theirs.points;
      icon = draw ? 'draw' : beats(mine, theirs) ? 'win' : 'lose';
      status = draw ? tr('DRAW') : beats(mine, theirs) ? tr('YOU WON') : tr('YOU LOST');
    } else if (next.kind === 'wait') {
      icon = 'wait';
      status = tr('ROUND {n}: THEIR SHOT', { n });
    } else if (next.kind === 'watch') {
      icon = 'eye';
      status = tr('ROUND {n}: SEE THEIR SHOT', { n });
    } else {
      icon = 'play';
      status = tr('ROUND {n}: YOUR SHOT', { n });
    }
    return { id: d.id, opponent: other.name || other.id, score: `${mine.goals} : ${theirs.goals}`, status, icon, mode, yourTurn: next.kind === 'attack' || next.kind === 'watch' };
  }

  private enter(duel: DuelData): void {
    const me = this.api.identity;
    if (!me) return;
    this.active = true;
    this.duel = duel;
    this.side = duel.players[0].id === me.id ? 0 : 1;
    this.mode = modeOf(duel.mode);
    this.total = duel.rounds.length || roundsIn(this.mode);
    this.templates = roundsFor(duel.seed, this.mode);
    this.freshEnter = true;
    this.noteRival(duel.players[1 - this.side].id, duel.players[1 - this.side].name);
    this.ui.hideScreens();
    this.advance();
    // The first duel on this browser starts with the rules.
    if (!this.flag(HELPED_KEY)) this.showHelp(() => this.ui.hideScreens());
  }

  private showHelp(onClosed: () => void): void {
    this.setFlag(HELPED_KEY);
    this.ui.showHelp(this.opponentName || tr('YOUR FRIEND'), onClosed);
  }

  private flag(key: string): boolean {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return true;
    }
  }

  private setFlag(key: string): void {
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* it will simply be shown again */
    }
  }

  private get opponentName(): string {
    const p = this.duel?.players[1 - this.side];
    return p ? p.name || p.id : '';
  }

  /** Rounds of this duel whose incoming shot this browser has already watched. */
  private seen(duelId: string): Set<number> {
    try {
      const all: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}');
      const list = (all as Record<string, unknown>)[duelId];
      return new Set(Array.isArray(list) ? list.filter((v): v is number => typeof v === 'number') : []);
    } catch {
      return new Set();
    }
  }

  private markSeen(duelId: string, round: number): void {
    try {
      const all = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}') as Record<string, number[]>;
      all[duelId] = [...new Set([...(all[duelId] ?? []), round])];
      localStorage.setItem(SEEN_KEY, JSON.stringify(all));
    } catch {
      /* the replay will simply be offered again */
    }
  }

  private cue(seconds: number, run: () => void): void {
    this.cues.push({ at: this.clock + seconds, run });
  }

  /** The scoreboard. A friend's result only goes up once their shot has been watched. */
  private showScore(round: number): void {
    const duel = this.duel;
    if (!duel) return;
    const [mine, theirs] = tally(duel, this.side, this.seen(duel.id));
    this.game.duelScore = { round, mine: mine.results, theirs: theirs.results, opponent: this.opponentName, mineColor: TEAM[this.side], theirColor: TEAM[1 - this.side] };
    this.game.hudLabel = tr('ROUND {n} OF {max}', { n: round + 1, max: this.total });
  }

  /** Looks at the duel and starts whatever this player should do next. */
  private advance(): void {
    const duel = this.duel;
    if (!duel) return;
    this.ui.hideScreens();
    this.ui.setAction(null, null);
    this.ui.hideCards();
    this.continueIn = -1;
    this.cues = [];
    this.clock = 0;

    const step = nextStep(duel, this.side, this.seen(duel.id));
    this.round = step.round;
    if (step.kind === 'attack') this.attack(step.round);
    else if (step.kind === 'watch') this.watch(step.round);
    else if (step.kind === 'wait') this.wait(step.round);
    else this.finish();
  }

  /** Loads a round's street as one of the two players will meet it. */
  private loadStreet(round: number, shooter: number): void {
    const duel = this.duel;
    if (!duel) return;
    const mine = shooter === this.side;
    this.game.loadCustom(buildDuelLevel(this.templates[round], trickAgainst(duel, shooter, round), shutterSide(duel.seed, round)));
    this.game.duelLook = mine
      ? { attacker: TEAM[this.side], defender: TEAM[1 - this.side], ballTag: tr('YOU'), goalTag: tr("{name}'S GOAL", { name: this.opponentName }) }
      : { attacker: TEAM[1 - this.side], defender: TEAM[this.side], ballTag: this.opponentName, goalTag: tr('YOUR GOAL') };
    this.showScore(round);
  }

  private attack(round: number): void {
    const duel = this.duel;
    if (!duel) return;
    this.phase = 'attack';
    portal.gameplayStart();
    this.selected = null;
    this.played = null;
    this.loadStreet(round, this.side);
    this.game.onShotStart = () => this.shotStarted();
    this.game.onShotEnd = (outcome) => this.shotTaken(outcome);
    const streetBanner = (): void => {
      this.game.showBanner(tr('ROUND {n}: {name}', { n: round + 1, name: tr(this.templates[round].name) }), true, 1.5);
      if (cardsIn(this.mode)) this.showCards();
      const trick = trickAgainst(duel, this.side, round);
      if (trick) this.cue(1.5, () => this.trickLands(trick));
    };
    if (this.freshEnter && round === 0) {
      // Walk out to a VS splash: both colours, confetti, a cheer.
      this.freshEnter = false;
      const g = this.game;
      const { arena } = g.level.def;
      g.showBanner(tr('YOU VS {name}', { name: this.opponentName }), true, 1.7);
      g.particles.confetti(arena.x + arena.w * 0.3, arena.y + 120, 0.4, 1, 30, 800, TEAM[this.side]);
      g.particles.confetti(arena.x + arena.w * 0.7, arena.y + 120, -0.4, 1, 30, 800, TEAM[1 - this.side]);
      g.sounds.goal(1, 1, false);
      this.cue(1.8, streetBanner);
    } else {
      streetBanner();
    }
  }

  /** A trick your friend played last round turns up in your street. */
  private trickLands(trick: Trick): void {
    const g = this.game;
    if (this.phase !== 'attack' || g.shotTaken) return;
    g.showBanner(tr('{name} SENT {card}!', { name: this.opponentName, card: tr(cardOf(trick).name) }), false, 1.8);
    g.sounds.trick(trick);
    g.camera.addTrauma(0.3);
    g.goalFlash = Math.max(g.goalFlash, 0.4);
    if (trick === 'cat') {
      const keeper = g.level.keeper;
      if (keeper) {
        g.particles.ring(keeper.body.x, keeper.body.y, 100, C.cat, 0.5);
        g.particles.dust(keeper.body.x, keeper.body.y, 0, 1, 14, C.cat);
        g.popups.spawn('MIAOU!', keeper.body.x, keeper.body.y + 70, 24, C.white, 0.9);
        keeper.pounce = 1;
      }
    } else if (trick === 'shutter') {
      const shutter = g.level.blocks.find((b) => b.kind === 'shutter');
      if (shutter) {
        shutter.hit = 1;
        shutter.hitNy = -1;
        g.particles.ring(shutter.x, shutter.y, 110, C.blueLite, 0.5);
        g.particles.dust(shutter.x, shutter.y + 14, 0, 1, 16, C.stone);
        g.popups.spawn('CLANG!', shutter.x, shutter.y + 70, 24, C.white, 0.9);
      }
    } else {
      // You get a look at the street first. Then it goes.
      g.smokeTarget = 1;
    }
  }

  private cardViews(): CardView[] {
    const duel = this.duel;
    const used = duel ? cardsPlayed(duel, this.side) : new Set<CardId>();
    const last = this.round >= this.total - 1;
    return CARDS.map((c) => ({ id: c.id, state: used.has(c.id) ? 'used' : c.kind === 'trick' && last ? 'off' : 'ready', selected: this.selected === c.id }));
  }

  private showCards(): void {
    if (!cardsIn(this.mode)) return;
    const friend = this.opponentName;
    let tip = tr('PLAY A CARD, OR JUST SHOOT. EACH CARD WORKS ONCE.');
    if (this.selected) {
      const card = cardOf(this.selected);
      tip = `${tr(card.name)}: ${tr(card.blurb, { friend }).toUpperCase()} ${tr('TAP AGAIN TO PUT IT BACK.')}`;
    } else if (this.round >= this.total - 1) {
      tip = tr('LAST ROUND. A TRICK WOULD HAVE NO NEXT SHOT TO LAND ON.');
    }
    this.ui.showCards(this.cardViews(), tip, friend);
  }

  private pickCard(id: CardId): void {
    const g = this.game;
    if (this.phase !== 'attack' || g.shotTaken || g.paused || !cardsIn(this.mode)) return;
    if (this.cardViews().find((c) => c.id === id)?.state !== 'ready') return;
    this.selected = this.selected === id ? null : id;
    g.armedBoost = asBoost(this.selected);
    g.audio.unlock();
    g.sounds.card(this.selected !== null);
    if (this.selected) {
      const b = g.ball.body;
      g.particles.ring(b.x, b.y, 80, cardOf(this.selected).color, 0.4);
    }
    this.showCards();
  }

  /** The ball has left: the card held up goes with it, and the hand is put away. */
  private shotStarted(): void {
    this.played = this.selected;
    this.ui.hideCards();
    const trick = asTrick(this.played);
    if (trick) {
      const { ballStart } = this.game.level.def;
      this.game.popups.spawn(tr('{card} SENT TO {name}', { card: tr(cardOf(trick).name), name: this.opponentName }), ballStart.x, ballStart.y + 56, 17, C.white, 1.6);
    }
  }

  private shotTaken(outcome: ShotOutcome): void {
    const { points, keeper, count } = outcome.path;
    const path: (number | null)[] = [];
    const keeperX: (number | null)[] = [];
    for (let i = 0; i < count; i++) {
      const x = points[i * 2];
      const y = points[i * 2 + 1];
      path.push(Number.isNaN(x) ? null : Math.round(x), Number.isNaN(y) ? null : Math.round(y));
      keeperX.push(Number.isNaN(keeper[i]) ? null : Math.round(keeper[i]));
    }
    this.unsent = { goal: outcome.goal, score: outcome.score, path, keeper: keeperX, card: this.played, events: [...outcome.events], movers: [...outcome.movers] };
    this.phase = 'after';
    this.continueIn = outcome.goal ? AFTER_GOAL : AFTER_MISS;
    this.showScoreSoon(outcome.goal);
    void this.sendShot();
  }

  /** Puts your own result on the scoreboard at once, without waiting for the server. */
  private showScoreSoon(goal: boolean): void {
    const score = this.game.duelScore;
    if (score) score.mine[this.round] = goal;
  }

  /** Sends the shot, and keeps trying: a shot that was taken must not be lost to a bad signal. */
  private async sendShot(): Promise<void> {
    const duel = this.duel;
    const shot = this.unsent;
    if (!duel || !shot) return;
    try {
      this.duel = await this.api.move(duel.id, this.round, shot);
      this.unsent = null;
    } catch {
      window.setTimeout(() => void this.sendShot(), 2500);
    }
  }

  /** Your shot is in, theirs is not: the street stays up and the duel checks back every couple of seconds. */
  private wait(round: number): void {
    this.phase = 'wait';
    portal.gameplayStop();
    this.pollIn = WAIT_POLL;
    // Coming in from the lobby there is no street up yet.
    if (this.game.level.def.id !== `duel-${this.templates[round].id}` || !this.game.duelLook) {
      this.loadStreet(round, this.side);
      this.game.lockShot();
    }
    this.showScore(round);
    this.ui.status(tr("WAITING FOR {name}'S SHOT...", { name: this.opponentName }));
  }

  private watch(round: number): void {
    const duel = this.duel;
    const shot = duel?.rounds[round].shot[1 - this.side];
    const mine = duel?.rounds[round].shot[this.side];
    if (!duel || !shot || !mine) return;
    this.phase = 'watch';
    portal.gameplayStart();
    this.loadStreet(round, 1 - this.side);
    this.game.lockShot();
    const g = this.game;
    const boost = asBoost(shot.card);
    const last = round >= this.total - 1;
    g.showBanner(boost ? tr('{name} PLAYS {card}!', { name: this.opponentName, card: tr(cardOf(boost).name) }) : tr("{name}'S SHOT", { name: this.opponentName }), false, 1.2);

    const finish = (): void => {
      this.markSeen(duel.id, round);
      this.showScore(round);
      const verdict = mine.goal === shot.goal ? tr(mine.goal ? 'BOTH SCORED!' : 'NOBODY SCORED') : mine.goal ? tr('ROUND {n} IS YOURS!', { n: round + 1 }) : tr('{name} TAKES ROUND {n}', { name: this.opponentName, n: round + 1 });
      g.showBanner(verdict, mine.goal, 1.7);
      if (mine.goal && !shot.goal) {
        // Their miss, your round: cheer it.
        const b = g.ball.body;
        g.particles.rays(b.x, b.y, 80, TEAM[this.side]);
        g.particles.ring(b.x, b.y, 90, TEAM[this.side], 0.5);
        g.sounds.saved();
      }
      const trick = asTrick(shot.card);
      if (trick && !last) {
        // Fair warning of what is waiting in the next street.
        this.cue(1.8, () => {
          if (this.phase !== 'watch') return;
          g.showBanner(tr('{name} SENT {card} FOR YOUR NEXT SHOT', { name: this.opponentName, card: tr(cardOf(trick).name) }), false, 2.2);
          g.sounds.card(true);
        });
      }
      this.ui.setAction(last ? 'FINAL SCORE' : 'NEXT ROUND', () => this.advance());
    };

    if (shot.path.length < 4) {
      finish();
      return;
    }
    this.ui.setAction('SKIP', () => g.skipReplay());
    // A beat for the banner to be read before the ball moves.
    this.cue(1, () => {
      if (this.phase !== 'watch') return;
      g.playReplay({ path: shot.path, keeper: shot.keeper, goal: shot.goal, events: shot.events ?? [], movers: shot.movers ?? [], boost }, finish);
    });
  }

  private finish(): void {
    const duel = this.duel;
    if (!duel) return;
    this.phase = 'done';
    portal.gameplayStop();
    this.showScore(this.total - 1);
    const [mine, theirs] = tally(duel, this.side, null);
    const draw = mine.goals === theirs.goals && mine.points === theirs.points;
    const won = beats(mine, theirs);
    const opponent = duel.players[1 - this.side];
    if (won) {
      // Confetti over the whole street, and the street cheering.
      const { arena } = this.game.level.def;
      for (let k = 0; k < 5; k++) this.game.particles.confetti(arena.x + (arena.w * (k + 0.5)) / 5, arena.y + 80, 0, 1, 30, 700, TEAM[this.side]);
      this.game.sounds.win();
    } else if (!draw) {
      this.game.sounds.miss('close');
    }
    const detail = mine.goals === theirs.goals && !draw ? tr(' Level on goals, so Crazy Score decides: {a} to {b}.', { a: mine.points, b: theirs.points }) : '';
    this.ui.showPanel(draw ? tr('A DRAW') : won ? tr('YOU WIN!') : tr('{name} WINS', { name: this.opponentName }), tr('{a} : {b} after {n} rounds.', { a: mine.goals, b: theirs.goals, n: this.total }) + detail, [
      { label: 'REMATCH', primary: true, onClick: () => void this.rematch(opponent.id) },
      { label: 'BACK TO DUELS', onClick: () => void this.open() },
    ]);
  }

  private async rematch(opponentId: string): Promise<void> {
    try {
      this.enter(await this.api.challenge(opponentId, this.mode));
    } catch {
      void this.open();
    }
  }

  /** The pause button during a duel: there is nothing to restart, only to leave. */
  showPause(): void {
    this.ui.showPanel(tr('DUEL PAUSED'), tr('Leaving is safe. Your duel waits for you in the list.'), [
      { label: 'RESUME', primary: true, onClick: () => this.resume() },
      { label: 'HOW IT WORKS', onClick: () => this.showHelp(() => this.showPause()) },
      { label: 'BACK TO DUELS', onClick: () => void this.open() },
    ]);
  }

  private resume(): void {
    this.ui.hideScreens();
    this.game.setPaused(false);
  }

  /** Called every frame by the game. */
  update(realDt: number): void {
    this.placeCards();
    this.clock += realDt;
    if (this.cues.length > 0) {
      const due = this.cues.filter((c) => c.at <= this.clock);
      if (due.length > 0) {
        this.cues = this.cues.filter((c) => c.at > this.clock);
        for (const c of due) c.run();
      }
    }
    if (this.phase === 'after' && this.continueIn >= 0) {
      this.continueIn -= realDt;
      // Wait for the server too, so the duel always moves on from an up to date state.
      if (this.continueIn < 0 && !this.unsent) this.advance();
      else if (this.continueIn < 0) {
        this.continueIn = 0.3;
        this.ui.status(tr('SENDING YOUR SHOT...'));
      }
    }
    if (this.phase !== 'lobby' && this.phase !== 'wait') return;
    this.pollIn -= realDt;
    if (this.pollIn > 0 || this.polling) return;
    this.pollIn = this.phase === 'lobby' ? LOBBY_POLL : WAIT_POLL;
    this.polling = true;
    void this.poll().finally(() => (this.polling = false));
  }

  /** Keeps the hand where the street leaves room for it: beside it when wide, under it when tall. */
  private placeCards(): void {
    const cam = this.game.camera;
    if (cam.portrait) {
      this.ui.placeCards(null);
      return;
    }
    const column = this.game.hud.column;
    this.ui.placeCards({ left: (column.x - cam.visible.x) * cam.scale, top: (column.y - cam.visible.y) * cam.scale, width: column.w * cam.scale });
  }

  private async poll(): Promise<void> {
    try {
      if (this.phase === 'lobby') {
        await this.refreshLobby();
      } else if (this.phase === 'wait' && this.duel) {
        const fresh = await this.api.get(this.duel.id);
        if (this.phase !== 'wait' || fresh.updatedAt === this.duel.updatedAt) return;
        this.duel = fresh;
        // Only move on if there is now something for this player to do.
        if (nextStep(fresh, this.side, this.seen(fresh.id)).kind !== 'wait') this.advance();
      }
    } catch {
      /* a failed poll is just tried again */
    }
  }
}

interface Tally {
  goals: number;
  points: number;
  results: (boolean | null)[];
}

/**
 * Goals, total Crazy Score and round by round results for each side. With `seen` given, the
 * other side's shots that have not been watched yet are left blank, so nothing is spoiled.
 */
function tally(duel: DuelData, side: 0 | 1, seen: ReadonlySet<number> | null): [Tally, Tally] {
  const make = (s: number, hide: boolean): Tally => {
    const shots = duel.rounds.map((r, i) => (hide && seen && !seen.has(i) ? null : r.shot[s]));
    const results = shots.map((shot) => shot?.goal ?? null);
    return {
      goals: results.filter((v) => v === true).length,
      points: shots.reduce((sum, shot) => sum + (shot?.score ?? 0), 0),
      results,
    };
  };
  return [make(side, false), make(1 - side, true)];
}

/** More goals wins; level on goals, the bigger total Crazy Score wins. */
const beats = (a: Tally, b: Tally): boolean => a.goals > b.goals || (a.goals === b.goals && a.points > b.points);

/** The cards a player has already played in this duel. */
function cardsPlayed(duel: DuelData, side: number): Set<CardId> {
  const used = new Set<CardId>();
  for (const r of duel.rounds) {
    const card = r.shot[side]?.card;
    if (card) used.add(card);
  }
  return used;
}

/** The trick waiting for `shooter` in a round: whatever the other player sent with their shot the round before. */
function trickAgainst(duel: DuelData, shooter: number, round: number): Trick | null {
  return round > 0 ? asTrick(duel.rounds[round - 1].shot[1 - shooter]?.card) : null;
}

interface Step {
  kind: 'attack' | 'wait' | 'watch' | 'done';
  round: number;
}

/**
 * The rule of play, in one place. Rounds go in order. In each: take your shot, wait for
 * theirs if it is not in yet, watch it, move on.
 */
function nextStep(duel: DuelData, side: 0 | 1, seen: ReadonlySet<number>): Step {
  const other = 1 - side;
  for (let r = 0; r < duel.rounds.length; r++) {
    const round = duel.rounds[r];
    if (!round.shot[side]) return { kind: 'attack', round: r };
    if (!round.shot[other]) return { kind: 'wait', round: r };
    if (!seen.has(r)) return { kind: 'watch', round: r };
  }
  return { kind: 'done', round: duel.rounds.length - 1 };
}
