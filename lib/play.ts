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
    slug: "everything-is-a-weapon",
    title: "Everything Is A Weapon",
    src: "/arcade/everything-is-a-weapon/index.html",
    poster: "/arcade/everything-is-a-weapon/poster.jpg",
    genre: {
      en: "Physics action sandbox",
      fr: "Bac à sable d’action physique",
      ar: "أكشن فيزيائي حرّ",
    },
    summary: {
      en: "Intruders break in at 3 a.m. You have no weapon. Good — the room is full of them. Throw the chair, topple the lamp into the puddle, and find all 52 ways it can go wrong for them.",
      fr: "Des intrus débarquent à 3 h du matin. Vous n’avez pas d’arme. Tant mieux : la pièce en est pleine. Lancez la chaise, faites tomber la lampe dans la flaque et découvrez les 52 façons dont ça peut mal tourner pour eux.",
      ar: "يقتحم الدخلاء المكان في الثالثة فجراً. لا تملك سلاحاً. جيد — فالغرفة مليئة بالأسلحة. ارمِ الكرسي، أسقط المصباح في بركة الماء، واكتشف 52 طريقة تسوء بها الأمور عليهم.",
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
