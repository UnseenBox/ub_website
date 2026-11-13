import type { RoomStats } from './ScoreSystem';

/** The campaign is a finite tour: 1 tutorial, 9 handcrafted rooms, then generated rooms. */
export const CAMPAIGN_ROOMS = 50;
export const FINAL_ROOM_INDEX = CAMPAIGN_ROOMS - 1;

/** Which chapter of the gnome invasion a room belongs to. */
export interface Act {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  /** Inclusive 0-based room indices. */
  readonly from: number;
  readonly to: number;
  readonly blurb: string;
}

export const ACTS: readonly Act[] = [
  {
    id: 'eviction',
    name: 'ACT I · THE INVASION',
    tagline: 'they came in through the cat flap',
    from: 0,
    to: 9,
    blurb: 'The garden gnomes marched in at 3 a.m. Take the house back, room by room.',
  },
  {
    id: 'pushback',
    name: 'ACT II · THE HOUSE FIGHTS BACK',
    tagline: 'the rooms are the weapons',
    from: 10,
    to: 19,
    blurb: 'Fire, water, grease. Learn what each room does — then aim it at them.',
  },
  {
    id: 'landlord',
    name: 'ACT III · THE GNOME COURT',
    tagline: 'the king wants your keys',
    from: 20,
    to: 29,
    blurb: 'The garage, the attic, then the house itself. End it where the gnomes hold court.',
  },
  {
    id: 'depths',
    name: 'ACT IV · THE DEPTHS',
    tagline: 'the house goes down',
    from: 30,
    to: 39,
    blurb: 'Under the house it keeps going: boiler rooms, bad wiring, and the gnome tunnels.',
  },
  {
    id: 'finale',
    name: 'ACT V · THE GNOME KING',
    tagline: 'the last door is his',
    from: 40,
    to: 49,
    blurb: 'Every key on the wall. One last door. The Gnome King is standing on it.',
  },
];

export function actFor(index: number): Act {
  for (const act of ACTS) {
    if (index >= act.from && index <= act.to) return act;
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
    story: '3 a.m. Something small is marching up the stairs. The garden gnomes want your house.',
    objective: 'grab, throw, knock them out',
    landlord: '“This house is ours now. — G.K.”',
    par: 150,
  },
  'room-2': {
    story: 'They took over the home office and called a meeting about who owns the house.',
    objective: 'shove a desk, skip chairs',
    landlord: '“Desks are gnome property. — G.K.”',
    par: 120,
  },
  'room-3': {
    story: 'The laundry is flooded and something down there is eating socks, coins and gnomes.',
    objective: 'water + socket; feed hoover',
    landlord: '“We like it damp. — G.K.”',
    par: 150,
  },
  'room-4': {
    story: 'The gnomes lit the lounge fire. The little ones brought marshmallows.',
    objective: 'one throw, two gnomes',
    landlord: '“The marshmallows are ours too. — G.K.”',
    par: 150,
  },
  'room-5': {
    story: 'The kitchen gnomes throw your own pans back at you. The floor is mostly oil now.',
    objective: 'keep moving, mind flour',
    landlord: '“Fridge confiscated. — G.K.”',
    par: 160,
  },
  'room-6': {
    story: 'The gnomes woke the living-room furniture. The sofa has opinions and eight legs.',
    objective: 'chain 4 steps, burn stock',
    landlord: '“No sitting on the sofa. — G.K.”',
    par: 170,
  },
  'room-7': {
    story: 'Down in the garage the mower bled oil. The Bulwark dares you to hit its front.',
    objective: "don't hit its front",
    landlord: '“The garage is a gnome fort. — G.K.”',
    par: 180,
  },
  'room-8': {
    story: 'The attic. Mom is up here, and the whole gnome crew is with her.',
    objective: 'all at once · book',
    landlord: '“BRING ME THE KEYS. — THE GNOME KING”',
    par: 210,
  },
  'room-9': {
    story: 'The gnomes woke the house itself, and it stood up. Win it back, wall by wall.',
    objective: 'tame the house itself',
    landlord: '“THE HOUSE IS OURS. — THE GNOME KING”',
    par: 220,
  },
  'pool-11': {
    story: 'Under the house: a pool nobody drained. The platform is dry. Be on it.',
    objective: 'one throw, two gnomes',
    landlord: '“No lifeguard on duty. — G.K.”',
    par: 150,
  },
  'jail-14': {
    story: 'Below that: the gnome lock-up. Pick a door — they open downward.',
    objective: 'no direct hits',
    landlord: '“Lights out at nine. — G.K.”',
    par: 160,
  },
  'garden-17': {
    story: 'Back where they came from: the garden. Weed them out between the beds.',
    objective: 'one throw, two gnomes',
    landlord: '“Keep off OUR grass. — G.K.”',
    par: 170,
  },
  'porch-19': {
    story: 'Out front: sunset, sweet tea, two fast gnomes who skipped the queue.',
    objective: 'one throw, two gnomes',
    landlord: '“Wipe your feet. — G.K.”',
    par: 140,
  },
  'basement-20': {
    story: 'Under everything: the furnace room. It is lit, slick, and hungry.',
    objective: 'let the room do it',
    landlord: '“Mind the boiler. — G.K.”',
    par: 180,
  },
  'final-49': {
    story: 'The last door. The Gnome King built a war machine out of your moving boxes, and he is in it.',
    objective: 'beat the king · take the house back',
    landlord: '“MY HOUSE NOW. — THE GNOME KING”',
    par: 240,
  },
};

const DEPTH_STORIES: readonly string[] = [
  'Another room, another gnome crew who think it is theirs.',
  'The house is bigger than the floor plan admits.',
  'They keep sneaking back into rooms you already cleared.',
  'Down here the wallpaper remembers every fight.',
];

export function briefingFor(roomId: string, index: number): Briefing {
  const handcrafted = BRIEFINGS[roomId];
  if (handcrafted) return handcrafted;
  return {
    story: DEPTH_STORIES[index % DEPTH_STORIES.length]!,
    objective: 'clear · chase ★',
    landlord: '“Still our house. — G.K.”',
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
  { id: 'bouncer', name: 'BOUNCER', text: 'Kick out 25 gnomes', target: 25, reward: 60, progress: (s) => s.totalKills },
  { id: 'chain_gang', name: 'CHAIN GANG', text: 'Trigger 10 chain reactions', target: 10, reward: 80, progress: (s) => s.totalChains },
  { id: 'pyro', name: 'INSIDE JOB', text: 'Let the house defeat 15 gnomes', target: 15, reward: 80, progress: (s) => s.totalHazardKills },
  { id: 'collector', name: 'EVIDENCE BOARD', text: 'Collect 30 discoveries', target: 30, reward: 60, progress: (s) => s.discoveries },
  { id: 'boss_hunter', name: 'GNOME HUNTER', text: 'Beat 5 bosses', target: 5, reward: 120, progress: (s) => s.bossesBeaten },
  { id: 'veteran', name: 'HOMEOWNER', text: 'Clear 15 rooms', target: 15, reward: 100, progress: (s) => s.roomsCleared },
];

export function totalStars(roomStars: Record<string, number>): number {
  return Object.values(roomStars).reduce((sum, n) => {
    if (!Number.isFinite(n)) return sum;
    return sum + Math.max(0, Math.min(3, n));
  }, 0);
}

/** Whole-campaign progress for the portal + menu header (50 rooms × 3 stars). */
export function campaignProgress(roomCount: number, roomStars: Record<string, number>): number {
  if (roomCount <= 0) return 0;
  return Math.min(100, Math.round((totalStars(roomStars) / (roomCount * 3)) * 100));
}

export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function yesterdayKey(date = new Date()): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}
