import type { Playable } from "@/types/content";
import { L, SEED_DATE } from "./helpers";

/**
 * Starter set for the /play arcade. Each entry is a static build living in
 * `public/arcade/<slug>/` (with a `poster.jpg`); to add a game by hand, copy
 * its build there and add an entry here, newest first.
 */
export const playables: Playable[] = [
  {
    id: "play_crazy-goal",
    slug: "crazy-goal",
    title: "CRAZY KORA",
    added: "2026-10-08",
    moods: ["quick", "friends", "phone"],
    src: "/arcade/crazy-goal/index.html",
    poster: "/arcade/crazy-goal/poster.jpg",
    genre: {
      en: "Street football trick shots",
      fr: "Football de rue, tirs acrobatiques",
      ar: "كرة قدم الحومة بتسديدات بهلوانية",
    },
    summary: {
      en: "Football in the houmas of the city. One shot per try: drag back, let go, and get it in any way you can. Bank it off the houses, bounce it off the tyres, send it down the drain, smash the window, ring the bell, and get it past Mimi the cat. One hundred houmas across nine chapters — the Houma, New Grounds, the Crazy League, Legends, Street Kings, Night League, Golden Hour, Hall of Fame and the Finals — with pinball bumpers, gusty fans, spinning turnstiles, hedges, rooftops, snow, sunsets and floodlit nights on top of paving, grass, sand, ice and turbo arrows. Three stars each, twenty-seven ball skins to unlock, English or Arabic, chapters with progress bars, and your last miss stays chalked on the ground. Or duel a friend: send them an invite, then play ten rounds, each on a different street, one shot each. You both hold six cards to play once: set your ball on fire, turn the goal into a magnet, or send smoke, a shutter or Mimi herself to ruin their next shot.",
      fr: "Du foot dans les houmas de la ville. Un seul tir par essai : tirez en arrière, relâchez, et marquez comme vous pouvez. Jouez avec les murs, les pneus, la bouche d’égout, la vitre, la sonnette, et trompez Mimi la chatte. Cent houmas en neuf chapitres — la Houma, Nouveaux Terrains, Ligue Crazy, Légendes, Rois de la Rue, Ligue de Nuit, Heure Dorée, Panthéon et Finales — avec bumpers de flipper, ventilateurs capricieux, tourniquets, haies, toits, neige, couchers de soleil et nuits sous projecteurs, en plus des pavés, de l’herbe, du sable, de la glace et des flèches turbo. Trois étoiles chacune, vingt-sept ballons à débloquer, en anglais ou en arabe, des chapitres avec barres de progression, et votre dernier raté reste tracé à la craie sur le sol. Ou défiez un ami : envoyez-lui une invitation, puis jouez dix manches, chacune dans une rue différente, un tir chacun. Vous avez tous les deux six cartes à jouer une seule fois : enflammez votre ballon, transformez le but en aimant, ou envoyez de la fumée, un rideau de fer ou Mimi en personne pour gâcher son prochain tir.",
      ar: "كرة قدم في حومات المدينة. تسديدة واحدة في كل محاولة: اسحب إلى الخلف ثم أفلت، وسجّل بأي طريقة. استعمل الجدران والعجلات وفتحة المجاري، اكسر الزجاج، اقرع الجرس، وتجاوز القطة ميمي. مئة حومة في تسعة فصول — الحومة وملاعب جديدة والدوري المجنون والأساطير وأبطال الشوارع ودوري الليل والساعة الذهبية وقاعة المشاهير والنهائيات — مع مصدات البينبول والمراوح والأبواب الدوارة والشجيرات والسطوح والثلج والغروب والليالي المضاءة، إضافة إلى البلاط والعشب والرمل والجليد وأسهم التوربو. ثلاث نجوم لكل واحد، وسبع وعشرون كرة تُفتح بالنجوم، بالعربية أو الإنجليزية، وفصول بأشرطة تقدم، وآخر تسديدة ضائعة تبقى مرسومة بالطباشير على الأرض. أو تحدَّ صديقاً: أرسل له دعوة، ثم العبا عشر جولات، كل جولة في زقاق مختلف، بتسديدة واحدة لكل منكما. مع كل واحد منكما ست بطاقات تُلعب مرة واحدة: أشعل كرتك، حوّل المرمى إلى مغناطيس، أو أرسل دخاناً أو ستاراً حديدياً أو ميمي نفسها لإفساد تسديدته التالية.",
    },
    desktopControls: L(
      "Drag back to aim · let go to shoot · click to retry · R to restart · Esc to pause",
      "Tirez en arrière pour viser · relâchez pour tirer · clic pour réessayer · R pour recommencer · Échap pour la pause",
      "اسحب للخلف للتصويب · أفلت للتسديد · انقر لإعادة المحاولة · R للبدء من جديد · Esc للإيقاف المؤقت",
    ),
    phoneControls: L(
      "Works upright or sideways · drag anywhere to aim · lift your finger to shoot · tap to go again",
      "Fonctionne à la verticale comme à l’horizontale · glissez n’importe où pour viser · levez le doigt pour tirer · touchez pour rejouer",
      "تعمل بالوضع العمودي أو الأفقي · اسحب في أي مكان للتصويب · ارفع إصبعك للتسديد · المس للعب مجدداً",
    ),
    enabled: true,
    order: 1,
    updatedAt: SEED_DATE,
  },
  {
    id: "play_dont-let-it-see-you",
    slug: "dont-let-it-see-you",
    title: "DON'T LET IT FIND YOU",
    added: "2026-10-08",
    moods: ["dark", "brain"],
    src: "/arcade/dont-let-it-see-you/index.html",
    poster: "/arcade/dont-let-it-see-you/poster.jpg",
    genre: L("Survival horror stealth", "Infiltration et horreur", "رعب وبقاء وتسلّل"),
    summary: L(
      "It hunts your body now — your noise, your light, your footsteps. Sneak through twelve rooms past nine creatures: kill the torch, throw bottles to lure them away, hide in lockers, and run when it sees you. Three hits and you're gone.",
      "Elle chasse votre corps : votre bruit, votre lumière, vos pas. Traversez douze pièces peuplées de neuf créatures : éteignez la torche, lancez des bouteilles pour détourner, cachez-vous dans les casiers, et courez quand elle vous voit. Trois coups et c'est fini.",
      "إنه يطارد جسدك الآن — ضجيجك وضوءك وخطواتك. تسلّل عبر اثنتي عشرة غرفة أمام تسعة كائنات: أطفئ المصباح، وارمِ الزجاجات للإلهاء، واختبئ في الخزائن، واركض عندما يراك. ثلاث إصابات وتنتهي اللعبة.",
    ),
    desktopControls: L(
      "WASD to move · SHIFT to sprint · C to sneak · mouse aims the torch · F toggles torch · Q throws a bottle · E to use · SPACE to hide · R to restart",
      "ZQSD pour bouger · maj pour sprinter · C pour se faufiler · la souris vise la torche · F pour la torche · Q pour lancer une bouteille · E pour utiliser · espace pour se cacher · R pour recommencer",
      "WASD للحركة · Shift للركض · C للتسلّل · الفأرة توجّه المصباح · F للمصباح · Q لرمي زجاجة · E للاستخدام · المسافة للاختباء · R لإعادة المحاولة",
    ),
    phoneControls: L(
      "Best on a computer. On a phone, turn it sideways: left thumb walks (small moves sneak), right thumb aims the torch, tap to use.",
      "Mieux sur ordinateur. Sur téléphone, mettez-le en paysage : le pouce gauche marche (petits mouvements = furtif), le pouce droit vise la torche, touchez pour utiliser.",
      "أفضل على الحاسوب. على الهاتف، أدِره أفقيًّا: الإبهام الأيسر يمشي (الحركات الصغيرة تسلّل)، والأيمن يوجّه المصباح، والنقر للاستخدام.",
    ),
    enabled: true,
    order: 2,
    updatedAt: SEED_DATE,
  },
  {
    id: "play_bonk",
    slug: "bonk",
    title: "BONK!",
    added: "2026-10-02",
    moods: ["chaos", "phone"],
    src: "/arcade/bonk/index.html",
    poster: "/arcade/bonk/poster.jpg",
    genre: L("Physics action sandbox", "Bac à sable d’action physique", "أكشن فيزيائي حرّ"),
    summary: L(
      "Living cardboard boxes break in at 3 a.m. to move you out. You have no weapon. Good. The flat is full of them. Throw the toaster, topple the lamp into the puddle, and find over 130 ways it can go wrong for them.",
      "Des cartons vivants débarquent à 3 h du matin pour vous déménager de force. Vous n’avez pas d’arme. Tant mieux : l’appartement en est plein. Lancez le grille-pain, faites tomber la lampe dans la flaque et découvrez plus de 130 façons dont ça peut mal tourner pour eux.",
      "صناديق كرتونية حيّة تقتحم شقتك في الثالثة فجراً لتُخرجك منها. لا تملك سلاحاً. جيد، فالشقة مليئة بالأسلحة. ارمِ محمصة الخبز، أسقط المصباح في بركة الماء، واكتشف أكثر من 130 طريقة تسوء بها الأمور عليهم.",
    ),
    desktopControls: L(
      "WASD to move · click to grab · hold and release to throw · space to dodge",
      "ZQSD pour bouger · clic pour saisir · maintenir puis relâcher pour lancer · espace pour esquiver",
      "WASD للحركة · انقر للإمساك · اضغط مطولاً ثم أفلت للرمي · المسافة للمراوغة",
    ),
    phoneControls: L(
      "Left thumb to move · tap the right side to grab · hold it to throw",
      "Pouce gauche pour bouger · touchez à droite pour saisir · maintenez pour lancer",
      "الإبهام الأيسر للحركة · المس الجهة اليمنى للإمساك · اضغط مطولاً للرمي",
    ),
    enabled: true,
    order: 3,
    updatedAt: SEED_DATE,
  },
  {
    id: "play_chronodle",
    slug: "chronodle",
    title: "CHRONODLE",
    added: "2026-10-08",
    moods: ["brain", "quick", "friends", "phone"],
    src: "/arcade/chronodle/index.html",
    poster: "/arcade/chronodle/poster.jpg",
    genre: L("Daily history puzzle", "Puzzle historique quotidien", "لغز تاريخي يومي"),
    summary: L(
      "Five moments from history, one right order. Put them oldest to newest in four tries: green locks in, yellow points the way. A new puzzle every day for everyone, a streak to protect, and an endless practice mode with puzzles you can send to a friend. In English.",
      "Cinq moments de l’histoire, un seul bon ordre. Classez-les du plus ancien au plus récent en quatre essais : le vert se verrouille, le jaune indique la direction. Un nouveau puzzle chaque jour, le même pour tout le monde, une série à protéger et un mode entraînement sans fin dont vous pouvez envoyer les puzzles à un ami. En anglais.",
      "خمس لحظات من التاريخ وترتيب صحيح واحد. رتّبها من الأقدم إلى الأحدث في أربع محاولات: الأخضر يثبت في مكانه، والأصفر يدلّك على الاتجاه. لغز جديد كل يوم للجميع، وسلسلة انتصارات تحافظ عليها، ووضع تدريب لا ينتهي يمكنك إرسال ألغازه إلى صديق. باللغة الإنجليزية.",
    ),
    desktopControls: L(
      "Click two cards to swap them, or use the ▲▼ arrows · Submit to check your order",
      "Cliquez sur deux cartes pour les échanger, ou utilisez les flèches ▲▼ · Valider pour vérifier votre ordre",
      "انقر على بطاقتين لتبديلهما، أو استخدم السهمين ▲▼ · اضغط Submit للتحقق من ترتيبك",
    ),
    phoneControls: L(
      "Made for phones: tap two cards to swap them, then tap Submit",
      "Pensé pour le téléphone : touchez deux cartes pour les échanger, puis Submit",
      "مصمَّمة للهاتف: المس بطاقتين لتبديلهما، ثم المس Submit",
    ),
    enabled: true,
    order: 4,
    updatedAt: SEED_DATE,
  },
];
