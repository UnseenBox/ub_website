import type { StudioInfo } from "@/types/content";
import { L } from "./helpers";

export const studio: StudioInfo = {
  name: "UnseenBox",
  foundedYear: "2019",
  email: "studio.unseenbox@gmail.com",
  city: L("Algiers", "Alger", "الجزائر"),
  country: L("Algeria", "Algérie", "الجزائر"),
  timezone: "Africa/Algiers",
  tagline: L(
    "An independent game & creative technology studio.",
    "Un studio indépendant de jeux vidéo et de technologies créatives.",
    "استوديو مستقل لتطوير الألعاب والتقنيات الإبداعية.",
  ),
  intro: L(
    "UnseenBox is a small, stubborn studio that builds games, virtual and augmented worlds, and interactive places. We work where play, craft and technology overlap — and where nobody has quite looked yet.\n\nSome of what we make ships on Steam. Some of it lives in a museum for three months. Some of it teaches a twelve-year-old how gravity works without ever saying the word. All of it starts the same way: as something unseen.",
    "UnseenBox est un petit studio obstiné qui fabrique des jeux, des mondes virtuels et augmentés, et des lieux interactifs. Nous travaillons là où le jeu, l'artisanat et la technologie se croisent — là où personne n'a encore vraiment regardé.\n\nCertaines de nos créations sortent sur Steam. D'autres vivent trois mois dans un musée. D'autres encore apprennent à un enfant de douze ans comment fonctionne la gravité sans jamais prononcer le mot. Toutes commencent de la même façon : invisibles.",
    "UnseenBox استوديو صغير وعنيد يصنع الألعاب والعوالم الافتراضية والمعزّزة والأماكن التفاعلية. نعمل حيث يلتقي اللعب بالحِرفة والتقنية — في المساحات التي لم ينظر إليها أحد بعد.\n\nبعض ما نصنعه يُطلق على Steam، وبعضه يعيش ثلاثة أشهر داخل متحف، وبعضه يعلّم طفلًا في الثانية عشرة كيف تعمل الجاذبية دون أن يذكر الكلمة. لكن كل ما نصنعه يبدأ بالطريقة نفسها: خفيًّا.",
  ),
  manifesto: L(
    "We don't make content. We make places — small, strange, deliberate places you can walk into, break, learn from, and leave slightly changed.",
    "Nous ne produisons pas du contenu. Nous construisons des lieux — petits, étranges, précis — où l'on entre, que l'on casse, dont on apprend, et d'où l'on repart un peu changé.",
    "لا نصنع محتوى. نبني أماكن — صغيرة، غريبة، مقصودة — تدخلها، تكسرها، تتعلّم منها، ثم تغادرها وقد تغيّرتَ قليلًا.",
  ),
  approach: L(
    "Every project begins with a playable question, not a slide deck. We prototype in days, test with real people early, and throw away more than we keep. Art, code, sound and design sit at the same table from the first sketch to the final build — so the thing we ship feels like one idea, not a committee.",
    "Chaque projet commence par une question jouable, pas par une présentation. Nous prototypons en quelques jours, testons tôt avec de vraies personnes et jetons plus que nous ne gardons. Art, code, son et design partagent la même table du premier croquis à la version finale — pour que ce que nous livrons ressemble à une seule idée, pas à un comité.",
    "يبدأ كل مشروع بسؤال قابل للّعب، لا بعرض تقديمي. نصنع النماذج الأولية في أيام، ونختبرها مع أشخاص حقيقيين مبكرًا، ونتخلّى عن أكثر مما نحتفظ به. الفن والبرمجة والصوت والتصميم يجلسون إلى الطاولة نفسها من أول رسم حتى النسخة النهائية — ليبدو ما نطلقه فكرة واحدة، لا قرار لجنة.",
  ),
  ambition: L(
    "In ten years we want a shelf of games people still talk about, a handful of spaces that changed how a city learns, and a studio in North Africa that young developers see as proof it can be done from here.",
    "Dans dix ans, nous voulons une étagère de jeux dont on parle encore, quelques lieux qui ont changé la façon dont une ville apprend, et un studio en Afrique du Nord que les jeunes développeurs voient comme la preuve que c'est possible d'ici.",
    "بعد عشر سنوات نريد رفًّا من الألعاب التي لا يزال الناس يتحدثون عنها، وبضعة أماكن غيّرت طريقة تعلّم مدينة كاملة، واستوديو في شمال إفريقيا يراه المطوّرون الشباب دليلًا على أن ذلك ممكن من هنا.",
  ),
  beliefs: [
    {
      id: "belief_play",
      title: L("Play is a way of thinking.", "Jouer est une façon de penser.", "اللعب طريقة في التفكير."),
      text: L(
        "Not a feature, not a reward loop. The fastest way to understand a system is to be allowed to break it.",
        "Pas une fonctionnalité, pas une boucle de récompense. Le moyen le plus rapide de comprendre un système, c'est d'avoir le droit de le casser.",
        "ليس ميزة ولا حلقة مكافآت. أسرع طريقة لفهم نظامٍ ما أن يُسمح لك بكسره.",
      ),
    },
    {
      id: "belief_small",
      title: L("Small teams, sharp edges.", "Petites équipes, angles vifs.", "فرق صغيرة، حوافّ حادّة."),
      text: L(
        "We stay small on purpose. Fewer people means fewer compromises and work that still has fingerprints on it.",
        "Nous restons petits par choix. Moins de monde, c'est moins de compromis et un travail qui porte encore des empreintes.",
        "نبقى صغارًا عن قصد. عدد أقل من الأشخاص يعني تنازلات أقل وعملًا لا تزال عليه بصمات صانعيه.",
      ),
    },
    {
      id: "belief_feel",
      title: L("Feel before features.", "La sensation avant les fonctionnalités.", "الإحساس قبل الميزات."),
      text: L(
        "If jumping doesn't feel good, a hundred levels won't save it. We polish the first second until it hums.",
        "Si sauter n'est pas agréable, cent niveaux n'y changeront rien. Nous polissons la première seconde jusqu'à ce qu'elle vibre.",
        "إن لم تكن القفزة ممتعة فلن تنقذها مئة مرحلة. نصقل الثانية الأولى حتى تنبض.",
      ),
    },
    {
      id: "belief_honest",
      title: L("Technology is a material.", "La technologie est une matière.", "التقنية مادّة خام."),
      text: L(
        "VR, AR, sensors, shaders — we use them like clay, never like a sticker that says 'innovative'.",
        "VR, AR, capteurs, shaders — nous les travaillons comme de l'argile, jamais comme un autocollant « innovant ».",
        "الواقع الافتراضي، الواقع المعزّز، الحسّاسات، المُظلِّلات — نستخدمها كالطين، لا كملصق يقول «مبتكر».",
      ),
    },
    {
      id: "belief_here",
      title: L("Made from somewhere.", "Fait quelque part.", "مصنوع من مكانٍ ما."),
      text: L(
        "Our stories carry salt, heat, three languages and a Mediterranean light. We don't sand that off to fit a template.",
        "Nos histoires portent le sel, la chaleur, trois langues et une lumière méditerranéenne. Nous ne les rabotons pas pour entrer dans un moule.",
        "قصصنا تحمل الملح والحرارة وثلاث لغات وضوءًا متوسطيًّا. لا نمحو ذلك لنلائم قالبًا جاهزًا.",
      ),
    },
  ],
  timeline: [
    {
      id: "m2019",
      year: "2019",
      title: L("A box in a spare room", "Une boîte dans une chambre d'amis", "صندوق في غرفة فارغة"),
      text: L(
        "Two friends, one borrowed PC and a game jam deadline. BIT//FLOCK is born in 48 hours.",
        "Deux amis, un PC emprunté et une deadline de game jam. BIT//FLOCK naît en 48 heures.",
        "صديقان، حاسوب مستعار، وموعد نهائي لمسابقة ألعاب. وُلدت BIT//FLOCK في 48 ساعة.",
      ),
    },
    {
      id: "m2021",
      year: "2021",
      title: L("First commission", "Première commande", "أول طلب عمل"),
      text: L(
        "An educational pilot with three schools turns into our first real contract — and a studio name.",
        "Un pilote éducatif avec trois écoles devient notre premier vrai contrat — et un nom de studio.",
        "مشروع تعليمي تجريبي مع ثلاث مدارس يتحوّل إلى أول عقد حقيقي لنا — وإلى اسم للاستوديو.",
      ),
    },
    {
      id: "m2022",
      year: "2022",
      title: L("Into the headset", "Dans le casque", "داخل النظّارة"),
      text: L(
        "Pale Orbit launches on Quest. Our first VR title, built by four people and a lot of motion-sickness tests.",
        "Pale Orbit sort sur Quest. Notre premier titre VR, fait à quatre et avec beaucoup de tests de cinétose.",
        "إطلاق Pale Orbit على Quest. أول عنوان واقع افتراضي لنا، صنعه أربعة أشخاص مع كثير من اختبارات دوار الحركة.",
      ),
    },
    {
      id: "m2023",
      year: "2023",
      title: L("Salt & Lantern", "Salt & Lantern", "Salt & Lantern"),
      text: L(
        "Our first commercial narrative game ships on Steam and finds a small, loyal crowd.",
        "Notre premier jeu narratif commercial sort sur Steam et trouve un public fidèle.",
        "أول لعبة سردية تجارية لنا تصدر على Steam وتجد جمهورًا صغيرًا ووفيًّا.",
      ),
    },
    {
      id: "m2024",
      year: "2024",
      title: L("Spaces, not screens", "Des lieux, pas des écrans", "أماكن لا شاشات"),
      text: L(
        "Lumen Hall and the Museum of Tides AR guide take our work off the monitor and into public space.",
        "Lumen Hall et le guide AR du Musée des Marées sortent notre travail de l'écran vers l'espace public.",
        "Lumen Hall ودليل الواقع المعزّز لمتحف المدّ يُخرجان عملنا من الشاشة إلى الفضاء العام.",
      ),
    },
    {
      id: "m2025",
      year: "2025",
      title: L("The Quiet Cartographer", "The Quiet Cartographer", "The Quiet Cartographer"),
      text: L(
        "Four years of ink and code. Our most ambitious game yet, and the one that grew the team to nine.",
        "Quatre ans d'encre et de code. Notre jeu le plus ambitieux, celui qui a fait passer l'équipe à neuf.",
        "أربع سنوات من الحبر والبرمجة. أكثر ألعابنا طموحًا، وهي التي كبّرت الفريق إلى تسعة أشخاص.",
      ),
    },
    {
      id: "m2026",
      year: "2026",
      title: L("Three signals in the dark", "Trois signaux dans le noir", "ثلاث إشارات في العتمة"),
      text: L(
        "Ashfall Archive enters production. Two more worlds are forming behind it.",
        "Ashfall Archive entre en production. Deux autres mondes se forment derrière.",
        "Ashfall Archive يدخل مرحلة الإنتاج، وخلفه عالمان آخران يتشكّلان.",
      ),
    },
  ],
  socials: [
    { platform: "instagram", url: "https://instagram.com/" },
    { platform: "youtube", url: "https://youtube.com/" },
    { platform: "x", url: "https://x.com/" },
    { platform: "linkedin", url: "https://linkedin.com/" },
    { platform: "discord", url: "https://discord.com/" },
    { platform: "steam", url: "https://store.steampowered.com/" },
    { platform: "itch", url: "https://itch.io/" },
  ],
  availability: L(
    "Taking on two collaborations for early 2027.",
    "Deux collaborations possibles pour début 2027.",
    "نستقبل تعاونين جديدين لبداية 2027.",
  ),
};
