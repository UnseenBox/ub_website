import type { RoomStats } from './ScoreSystem';

/** Which chapter of the eviction saga a room belongs to. */
export interface Act {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  /** Inclusive 0-based room indices. The Depths act starts at 8 and never ends. */
  readonly from: number;
  readonly to: number | null;
  readonly blurb: string;
}

export const ACTS: readonly Act[] = [
  {
    id: 'eviction',
    name: 'ACT I · EVICTION NOTICE',
    tagline: 'they came with boxes',
    from: 0,
    to: 2,
    blurb: 'MOVERS & CO. slipped a notice under your door. Keep the flat room by room.',
  },
  {
    id: 'pushback',
    name: 'ACT II · THE FLAT FIGHTS BACK',
    tagline: 'the rooms are the weapons',
    from: 3,
    to: 5,
    blurb: 'Fire, water, grease. Learn what each room does — then aim it at them.',
  },
  {
    id: 'landlord',
    name: 'ACT III · THE LANDLORD',
    tagline: 'he wants the keys back',
    from: 6,
    to: 8,
    blurb: 'The compactor, the penthouse, then the lease itself. End it where the rent gets collected.',
  },
  {
    id: 'depths',
    name: 'THE DEPTHS',
    tagline: 'the building goes down forever',
    from: 9,
    to: null,
    blurb: 'Lease reclaimed. The basement keeps going for sport: new rooms, old bosses, daily work.',
  },
];

export function actFor(index: number): Act {
  for (const act of ACTS) {
    if (index >= act.from && (act.to === null || index <= act.to)) return act;
  }
  return ACTS[ACTS.length - 1]!;
}

/** Story + mini-goal for one handcrafted room. Shown on the key wall, on entry, on results. */
export interface Briefing {
  /** Why this room matters in the saga (1–2 lines). */
  readonly story: string;
  /** The mini-goal: what to try here beyond "kill everyone". */
  readonly objective: string;
  /** The other side talks back. */
  readonly landlord: string;
  /** Par time in seconds for the STYLE star conversation (display only). */
  readonly par: number;
}

export const BRIEFINGS: Readonly<Record<string, Briefing>> = {
  'room-1': {
    story: 'Morning. A boot kicks your bedroom door — MOVERS & CO. has come to box up your life.',
    objective: 'grab, throw, knock them out',
    landlord: '“Vacate by noon. — M.”',
    par: 150,
  },
  'room-2': {
    story: 'They set up desks in your office overnight and started charging you rent to sit down.',
    objective: 'shove a desk, skip chairs',
    landlord: '“Hot-desking now £40/hr. — M.”',
    par: 120,
  },
  'room-3': {
    story: 'The laundry is flooded and something down there is eating socks, coins, and movers.',
    objective: 'water + socket; feed hoover',
    landlord: '“Damp is tenant’s fault. — M.”',
    par: 150,
  },
  'room-4': {
    story: 'The lounge fireplace was lit “for viewings”. The gnats arrived with marshmallows.',
    objective: 'one throw, two movers',
    landlord: '“Viewings all week. Keep out. — M.”',
    par: 150,
  },
  'room-5': {
    story: 'The kitchen crew throws your own pans back at you. The floor is mostly oil now.',
    objective: 'keep moving, mind flour',
    landlord: '“Fridge contents confiscated. — M.”',
    par: 160,
  },
  'room-6': {
    story: 'The showroom furniture woke up. The sofa has opinions and eight legs.',
    objective: 'chain 4 steps, burn stock',
    landlord: '“Showroom models not for sitting. — M.”',
    par: 170,
  },
  'room-7': {
    story: 'Down in the warehouse the wall itself moves. The Bulwark dares you to hit its front.',
    objective: "don't hit its front",
    landlord: '“Storage fees tripled. — M.”',
    par: 180,
  },
  'room-8': {
    story: 'The penthouse. The Landlord himself, phased and furious, with the whole crew.',
    objective: 'all at once · book',
    landlord: '“BRING ME THE KEYS. — THE LANDLORD”',
    par: 210,
  },
  'room-9': {
    story: 'Mom retreated upstairs — and the building itself stood up. The lease is nailed to that office door.',
    objective: 'evict the house itself',
    landlord: '“FINAL NOTICE. — THE LANDLORD”',
    par: 220,
  },
};

const DEPTH_STORIES: readonly string[] = [
  'Another floor, another crew with your name on a box.',
  'The building is deeper than the floor plan admits.',
  'They keep subletting rooms you already cleared.',
  'Down here the wallpaper remembers every fight.',
];

export function briefingFor(roomId: string, index: number): Briefing {
  const handcrafted = BRIEFINGS[roomId];
  if (handcrafted) return handcrafted;
  return {
    story: DEPTH_STORIES[index % DEPTH_STORIES.length]!,
    objective: 'clear · chase ★',
    landlord: '“Rent due. — M.”',
    par: 150,
  };
}

/** 3 stars per room: ★ clear, ★ bonus objective, ★ style (chain / multi-kill / hazard work). */
export function starsFor(stats: RoomStats, challengePassed: boolean): { stars: number; style: boolean } {
  const style = stats.bestChain >= 3 || stats.bestMultiKill >= 2 || stats.hazardKills >= 1;
  return { stars: 1 + (challengePassed ? 1 : 0) + (style ? 1 : 0), style };
}

export function starText(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));
}

/** A big cross-room goal: the reason to come back tomorrow. */
export interface Contract {
  readonly id: string;
  readonly name: string;
  readonly text: string;
  readonly target: number;
  /** Scrap paid out once, on completion. */
  readonly reward: number;
  readonly progress: (s: {
    totalKills: number;
    totalChains: number;
    totalHazardKills: number;
    bossesBeaten: number;
    roomsCleared: number;
    discoveries: number;
  }) => number;
}

export const CONTRACTS: readonly Contract[] = [
  { id: 'bouncer', name: 'BOUNCER', text: 'Evict 25 movers', target: 25, reward: 60, progress: (s) => s.totalKills },
  { id: 'chain_gang', name: 'CHAIN GANG', text: 'Trigger 10 chain reactions', target: 10, reward: 80, progress: (s) => s.totalChains },
  { id: 'pyro', name: 'INSIDE JOB', text: 'Let the room defeat 15 movers', target: 15, reward: 80, progress: (s) => s.totalHazardKills },
  { id: 'collector', name: 'EVIDENCE BOARD', text: 'Collect 30 discoveries', target: 30, reward: 60, progress: (s) => s.discoveries },
  { id: 'boss_hunter', name: 'RENT COLLECTOR', text: 'Beat 5 bosses', target: 5, reward: 120, progress: (s) => s.bossesBeaten },
  { id: 'veteran', name: 'LONG LEASE', text: 'Clear 15 rooms', target: 15, reward: 100, progress: (s) => s.roomsCleared },
];

export function totalStars(roomStars: Record<string, number>): number {
  return Object.values(roomStars).reduce((sum, n) => sum + n, 0);
}

/** Whole-campaign progress for the portal + menu header. */
export function campaignProgress(handcraftedCount: number, roomStars: Record<string, number>): number {
  if (handcraftedCount <= 0) return 0;
  return Math.min(100, Math.round((totalStars(roomStars) / (handcraftedCount * 3)) * 100));
}

export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function yesterdayKey(date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}
