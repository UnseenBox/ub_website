import type { LocalizedString } from "@/types/content";

/**
 * Games that run directly in the browser on the /play page.
 * Each one is a static build living in `public/arcade/<slug>/`; to add a game,
 * copy its build there (with a `poster.jpg`) and add an entry here.
 */
export interface PlayableGame {
  slug: string;
  title: string;
  /** Entry point of the static build. Must keep its file extension so the locale proxy skips it. */
  src: string;
  poster: string;
  genre: LocalizedString;
  summary: LocalizedString;
  desktopControls: LocalizedString;
  phoneControls: LocalizedString;
}

export const PLAYABLE_GAMES: PlayableGame[] = [
  {
    slug: "bonk",
    title: "BONK!",
    src: "/arcade/bonk/index.html",
    poster: "/arcade/bonk/poster.jpg",
    genre: {
      en: "Physics action sandbox",
      fr: "Bac à sable d’action physique",
      ar: "أكشن فيزيائي حرّ",
    },
    summary: {
      en: "Living cardboard boxes break in at 3 a.m. to move you out. You have no weapon. Good. The flat is full of them. Throw the toaster, topple the lamp into the puddle, and find over 130 ways it can go wrong for them.",
      fr: "Des cartons vivants débarquent à 3 h du matin pour vous déménager de force. Vous n’avez pas d’arme. Tant mieux : l’appartement en est plein. Lancez le grille-pain, faites tomber la lampe dans la flaque et découvrez plus de 130 façons dont ça peut mal tourner pour eux.",
      ar: "صناديق كرتونية حيّة تقتحم شقتك في الثالثة فجراً لتُخرجك منها. لا تملك سلاحاً. جيد، فالشقة مليئة بالأسلحة. ارمِ محمصة الخبز، أسقط المصباح في بركة الماء، واكتشف أكثر من 130 طريقة تسوء بها الأمور عليهم.",
    },
    desktopControls: {
      en: "WASD to move · click to grab · hold and release to throw · space to dodge",
      fr: "ZQSD pour bouger · clic pour saisir · maintenir puis relâcher pour lancer · espace pour esquiver",
      ar: "WASD للحركة · انقر للإمساك · اضغط مطولاً ثم أفلت للرمي · المسافة للمراوغة",
    },
    phoneControls: {
      en: "Left thumb to move · tap the right side to grab · hold it to throw",
      fr: "Pouce gauche pour bouger · touchez à droite pour saisir · maintenez pour lancer",
      ar: "الإبهام الأيسر للحركة · المس الجهة اليمنى للإمساك · اضغط مطولاً للرمي",
    },
  },
];

/*
 * Playable games take reviews like catalogue games do. Their review id is
 * prefixed so it can never collide with a catalogue id (`game_…`).
 */
const PLAY_REVIEW_PREFIX = "play_";

export function playReviewId(game: PlayableGame): string {
  return `${PLAY_REVIEW_PREFIX}${game.slug}`;
}

export function findPlayableByReviewId(id: string): PlayableGame | undefined {
  return PLAYABLE_GAMES.find((game) => playReviewId(game) === id);
}

/** Where a review's game lives on the site, relative to the locale root. */
export function reviewGamePath(review: { gameId: string; gameSlug: string }): string {
  return review.gameId.startsWith(PLAY_REVIEW_PREFIX) ? `/play#${review.gameSlug}` : `/games/${review.gameSlug}`;
}
