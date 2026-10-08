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
    slug: "dont-let-it-see-you",
    title: "DON’T LET IT SEE YOU",
    src: "/arcade/dont-let-it-see-you/index.html",
    poster: "/arcade/dont-let-it-see-you/poster.jpg",
    genre: {
      en: "Stealth horror puzzle",
      fr: "Infiltration et horreur",
      ar: "تسلّل ورعب وألغاز",
    },
    summary: {
      en: "The thing in the room cannot see your body. It can see your cursor. Walk right past it and nothing happens; point at it and it knows in under two seconds. Twelve rooms, nine creatures, and one rule you will learn the hard way.",
      fr: "La chose dans la pièce ne voit pas votre corps. Elle voit votre curseur. Passez juste à côté et rien ne se produit ; pointez-la et elle le sait en moins de deux secondes. Douze pièces, neuf créatures, et une règle que vous apprendrez à vos dépens.",
      ar: "الكائن في الغرفة لا يرى جسدك، لكنه يرى مؤشّرك. امشِ بجانبه فلا يحدث شيء، وأشِر إليه فيعرف في أقل من ثانيتين. اثنتا عشرة غرفة، وتسعة كائنات، وقاعدة واحدة ستتعلّمها بالطريقة الصعبة.",
    },
    desktopControls: {
      en: "WASD to move · shift to sneak · click to use what you point at · E to reach for something without looking at it · space to hide · R to restart",
      fr: "ZQSD pour bouger · maj pour se faufiler · clic pour utiliser ce que vous pointez · E pour attraper sans regarder · espace pour se cacher · R pour recommencer",
      ar: "WASD للحركة · Shift للتسلّل · انقر لاستخدام ما تشير إليه · E للوصول إلى شيء دون النظر إليه · المسافة للاختباء · R لإعادة المحاولة",
    },
    phoneControls: {
      en: "Best on a computer, since the whole game is about a mouse cursor. On a phone, turn it sideways: left thumb walks, right thumb drags your attention around, tap to use.",
      fr: "Mieux sur ordinateur, puisque tout le jeu repose sur un curseur de souris. Sur téléphone, mettez-le en paysage : le pouce gauche marche, le pouce droit déplace votre attention, touchez pour utiliser.",
      ar: "أفضل على الحاسوب، فاللعبة كلّها قائمة على مؤشّر الفأرة. على الهاتف، أدِره أفقيًّا: الإبهام الأيسر يمشي، والأيمن يحرّك انتباهك، والنقر للاستخدام.",
    },
  },
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
  {
    slug: "chronodle",
    title: "CHRONODLE",
    src: "/arcade/chronodle/index.html",
    poster: "/arcade/chronodle/poster.jpg",
    genre: {
      en: "Daily history puzzle",
      fr: "Puzzle historique quotidien",
      ar: "لغز تاريخي يومي",
    },
    summary: {
      en: "Five moments from history, one right order. Put them oldest to newest in four tries: green locks in, yellow points the way. A new puzzle every day for everyone, a streak to protect, and an endless practice mode with puzzles you can send to a friend. In English.",
      fr: "Cinq moments de l’histoire, un seul bon ordre. Classez-les du plus ancien au plus récent en quatre essais : le vert se verrouille, le jaune indique la direction. Un nouveau puzzle chaque jour, le même pour tout le monde, une série à protéger et un mode entraînement sans fin dont vous pouvez envoyer les puzzles à un ami. En anglais.",
      ar: "خمس لحظات من التاريخ وترتيب صحيح واحد. رتّبها من الأقدم إلى الأحدث في أربع محاولات: الأخضر يثبت في مكانه، والأصفر يدلّك على الاتجاه. لغز جديد كل يوم للجميع، وسلسلة انتصارات تحافظ عليها، ووضع تدريب لا ينتهي يمكنك إرسال ألغازه إلى صديق. باللغة الإنجليزية.",
    },
    desktopControls: {
      en: "Click two cards to swap them, or use the ▲▼ arrows · Submit to check your order",
      fr: "Cliquez sur deux cartes pour les échanger, ou utilisez les flèches ▲▼ · Valider pour vérifier votre ordre",
      ar: "انقر على بطاقتين لتبديلهما، أو استخدم السهمين ▲▼ · اضغط Submit للتحقق من ترتيبك",
    },
    phoneControls: {
      en: "Made for phones: tap two cards to swap them, then tap Submit",
      fr: "Pensé pour le téléphone : touchez deux cartes pour les échanger, puis Submit",
      ar: "مصمَّمة للهاتف: المس بطاقتين لتبديلهما، ثم المس Submit",
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
