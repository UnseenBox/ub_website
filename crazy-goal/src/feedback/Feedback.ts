import { cardOf } from '../abilities/Cards';
import type { Game } from '../core/Game';
import { tr } from '../core/i18n';
import { clamp01 } from '../core/math';
import type { Surface } from '../physics/Collider';
import { RUBBER_GREEN } from '../rendering/AbilityArt';
import { C } from '../rendering/Palette';

/** Closing speed that counts as a full-strength hit. */
const FULL_IMPACT = 1300;

/** What flies off each kind of surface when the ball hits it. */
const DUST: Readonly<Partial<Record<Surface, string>>> = {
  crate: C.orange,
  hedge: C.green,
  bumper: C.sun,
  spinner: C.blueLite,
  car: C.sun,
  rail: C.white,
  wall: C.white,
  kerb: C.stone,
};

/** What a hard hit shouts, by surface. */
const HIT_WORD: Readonly<Partial<Record<Surface, string>>> = {
  car: 'TAXI!',
  crate: 'CRUNCH!',
  hedge: 'RUSTLE!',
  gate: 'CLANG!',
  kerb: 'BONK!',
  rail: 'CLANK!',
  wall: 'BAM!',
  post: 'POST!',
};

/** What flies out of each kind of thing when a burning ball goes through it. */
const DEBRIS: Readonly<Partial<Record<Surface, string>>> = {
  crate: C.wood,
  hedge: C.green,
  bumper: C.sun,
  spinner: C.blueLite,
  car: C.sun,
  wall: C.white,
  gate: C.blueLite,
  tyre: C.rubber,
  glass: C.water,
};

let emberDebt = 0;

/** Once a frame: the part of a boost that is continuous. A burning ball sheds embers and roars. */
export function boostFeedback(g: Game, dt: number): void {
  if (g.shownBoost !== 'fire' || g.level.fireSpent || dt <= 0) return;
  const ball = g.ball;
  const moving = g.state === 'flight' || g.state === 'replay';
  const speed = ball.speed || 1;
  emberDebt += dt * (moving ? 60 : 12);
  while (emberDebt >= 1) {
    emberDebt -= 1;
    g.particles.embers(ball.renderX + g.aimDraw.x, ball.renderY + g.aimDraw.y, moving ? -ball.body.vx / speed : 0, moving ? -ball.body.vy / speed : -1, 1);
  }
}

/**
 * All the juice, in one place. Gameplay only announces what happened; this turns each event
 * into sound, particles, camera movement and time effects, scaled by how hard the moment was.
 * The level can change under it, so it always reads `g.level` and `g.net` afresh.
 */
export function wireFeedback(g: Game): void {
  const { events, sounds, particles, popups, camera, time, ball, celebration } = g;

  events.on('AIM_STARTED', () => sounds.aimStart());
  events.on('AIM_CANCELLED', () => sounds.aimCancel());

  events.on('AIM_STEP', (e) => {
    sounds.aimStep(e.step);
    const b = ball.body;
    const full = e.step >= 10;
    particles.ring(b.x, b.y, 26 + e.step * 2.6, full ? C.sun : C.blueLite, 0.18);
    if (full) particles.rays(b.x, b.y, 54, C.sun);
  });

  events.on('BALL_LAUNCHED', (e) => {
    sounds.kick(e.power);
    g.juice.launch(e.power);
    // The boot goes through the ball and takes a cone of street with it.
    particles.dust(e.x - e.dirX * 18, e.y - e.dirY * 18, -e.dirX, -e.dirY, 9 + 17 * e.power, C.sand);
    particles.sparks(e.x, e.y, e.dirX, e.dirY, 8 + 18 * e.power, C.sun);
    particles.ring(e.x, e.y, 60 + 70 * e.power, C.sun, 0.42);
    particles.ring(e.x, e.y, 38 + 44 * e.power, C.white, 0.3);
    particles.rays(e.x, e.y, 100 + 130 * e.power, C.sun);
    particles.blast(e.x, e.y, 26 + 36 * e.power, C.white, 0.2);
    camera.kick(e.dirX * (4 + 16 * e.power), e.dirY * (4 + 16 * e.power));
    camera.addTrauma(0.16 + 0.4 * e.power);
    camera.punchZoom(0.025 + 0.075 * e.power, e.x, e.y);
    // A defensive cap: even a typo'd power of 100 must not freeze the street for seconds.
    time.hitStop(Math.min(0.05, 0.008 + 0.02 * e.power));
    if (e.power >= 0.92) popups.spawn('YALLA!', e.x, e.y - 96, 40, C.sun, 0.8);
    // A duel card riding on the shot announces itself as the ball leaves.
    const boost = g.flightBoost;
    if (boost) {
      const card = cardOf(boost);
      sounds.boost(boost);
      particles.ring(e.x, e.y, 170, card.color, 0.55);
      particles.rays(e.x, e.y, 150, card.color);
      particles.blast(e.x, e.y, 70, card.color, 0.3);
      popups.spawn(`${tr(card.name)}!`, e.x, e.y - 64, 32, C.white, 0.9);
      camera.addTrauma(0.3);
      camera.punchZoom(0.05, e.x, e.y);
    }
  });

  events.on('BALL_COLLIDED', (e) => {
    if (e.impact < 25) return;
    const s = clamp01(e.impact / FULL_IMPACT);
    const colour = DUST[e.surface] ?? C.white;
    sounds.bounce(e.surface, s, e.bounce, time.elapsed);
    ball.impact(e.nx, e.ny, s);
    g.juice.impact(e.surface, s, e.bounce, colour);

    if (e.surface === 'net') {
      g.net.punch(e.x, -e.nx * e.impact * 0.8, -e.ny * e.impact * 0.8);
      if (s > 0.25) {
        particles.ring(e.x, e.y, 70 + 90 * s, C.white, 0.4);
        particles.rays(e.x, e.y, 70 + 80 * s, C.white);
      }
      camera.addTrauma(0.18 + 0.45 * s);
      camera.punchZoom(0.01 + 0.05 * s, e.x, e.y);
      return;
    }
    g.level.hitBlock(e.bodyId, e.nx, e.ny, s);
    particles.dust(e.x, e.y, e.nx, e.ny, 5 + 16 * s, colour);
    particles.sparks(e.x, e.y, e.nx, e.ny, 6 + 18 * s, C.white);
    if (s > 0.25) particles.ring(e.x, e.y, 50 + 90 * s, colour, 0.36);
    if (s > 0.4) particles.rays(e.x, e.y, 60 + 100 * s, C.white);
    if (s > 0.5) particles.blast(e.x, e.y, 40 + 80 * s, C.white, 0.22);
    camera.addTrauma(0.1 + 0.7 * s);
    camera.kick(-e.nx * 16 * s, -e.ny * 16 * s);
    camera.punchZoom(0.015 + 0.1 * s, e.x, e.y);
    // The hardest hits hold for a moment: that pause is what reads as weight.
    if (s > 0.45) time.hitStop(0.02 + 0.1 * (s - 0.45));
    if (g.flightBoost === 'rubber') {
      // A rubber ball rings every time it lands.
      sounds.rubber();
      particles.ring(e.x, e.y, 84, RUBBER_GREEN, 0.3);
      particles.ring(e.x, e.y, 150, '#8fe0b4', 0.45);
    }
    // A post announces itself; the combo count would only sit on top of it.
    if (e.bounce >= 2 && e.surface !== 'post') popups.spawn(`x${e.bounce}`, e.x + e.nx * 40, e.y + e.ny * 40, 24 + Math.min(e.bounce, 7) * 3.4, C.sun);
    const word = HIT_WORD[e.surface];
    if (word && s > 0.72) popups.spawn(word, e.x - e.nx * 48, e.y - e.ny * 48, 28, C.white, 0.55);
  });

  events.on('BALL_HIT_POST', (e) => {
    popups.spawn('POST!', e.x, e.y + 58, 34, C.sun, 0.9);
    particles.ring(e.x, e.y, 80, C.sun, 0.4);
    particles.ring(e.x, e.y, 140, C.white, 0.5);
    particles.rays(e.x, e.y, 130, C.sun);
    particles.blast(e.x, e.y, 50, C.sun, 0.22);
    camera.addTrauma(0.5);
    camera.punchZoom(0.1, e.x, e.y);
    time.hitStop(0.05);
  });

  events.on('MECHANIC', (e) => {
    sounds.mechanic(e.kind, e.strength);
    const b = ball.body;
    const s = Math.max(0.4, e.strength);
    switch (e.kind) {
      case 'boing':
        g.juice.mechanic(e.kind, s, C.sun);
        particles.ring(e.x, e.y, 100, C.sun, 0.38);
        particles.ring(e.x, e.y, 160, C.white, 0.45);
        particles.dust(e.x, e.y, 0, -1, 16, C.sand);
        particles.rays(e.x, e.y, 120, C.sun);
        popups.spawn('BOING', e.x, e.y - 58, 32, C.sun, 0.7);
        camera.addTrauma(0.4);
        camera.punchZoom(0.07, e.x, e.y);
        time.hitStop(0.03);
        break;
      case 'bumper':
        g.juice.mechanic(e.kind, s, C.sun);
        particles.ring(e.x, e.y, 130, C.sun, 0.45);
        particles.ring(e.x, e.y, 190, C.white, 0.5);
        particles.ring(e.x, e.y, 80, '#ff5a5a', 0.4);
        particles.rays(e.x, e.y, 170, C.sun);
        particles.blast(e.x, e.y, 70, C.sun, 0.24);
        popups.spawn('PING!', e.x, e.y - 64, 36, C.sun, 0.8);
        camera.addTrauma(0.55);
        camera.punchZoom(0.12, e.x, e.y);
        time.hitStop(0.07);
        break;
      case 'spin':
        g.juice.mechanic(e.kind, s, C.blueLite);
        particles.ring(e.x, e.y, 110, C.blueLite, 0.4);
        particles.sparks(e.x, e.y, 0, -1, 16, C.white);
        popups.spawn('WHIZZ!', e.x, e.y - 56, 30, C.white, 0.7);
        camera.addTrauma(0.4);
        camera.punchZoom(0.07, e.x, e.y);
        break;
      case 'wind':
        g.juice.mechanic(e.kind, s, C.blueLite);
        particles.dust(e.x, e.y, 0, -1, 22, C.white);
        particles.ring(e.x, e.y, 100, C.blueLite, 0.35);
        popups.spawn('WHOOSH!', e.x, e.y - 54, 28, C.white, 0.7);
        break;
      case 'pipe':
        g.juice.mechanic(e.kind, s, C.blueLite);
        // Gone at one end, out at the other.
        particles.ring(e.x, e.y, 90, C.blue, 0.4);
        particles.dust(e.x, e.y, 0, -1, 16, C.stone);
        particles.ring(b.x, b.y, 120, C.sun, 0.45);
        particles.dust(b.x, b.y, 0, -1, 18, C.stone);
        camera.addTrauma(0.35);
        camera.punchZoom(0.05, b.x, b.y);
        break;
      case 'sand':
        particles.dust(e.x, e.y, 0, -1, 16 + 20 * s, C.sand);
        break;
      case 'smash':
        g.juice.mechanic(e.kind, s, C.white);
        particles.shards(e.x, e.y, b.vx, b.vy, 90);
        particles.rays(e.x, e.y, 190, C.white);
        particles.ring(e.x, e.y, 160, C.white, 0.42);
        particles.ring(e.x, e.y, 100, C.blueLite, 0.35);
        particles.blast(e.x, e.y, 80, C.white, 0.26);
        popups.spawn('SMASH!', e.x, e.y - 68, 44, C.white, 0.9);
        camera.addTrauma(1);
        camera.punchZoom(0.18, e.x, e.y);
        time.hitStop(0.14);
        break;
      case 'bell':
        g.juice.mechanic(e.kind, s, C.sun);
        popups.spawn('DING DONG', e.x, e.y - 78, 34, C.sun, 0.9);
        particles.ring(e.x, e.y, 80, C.sun, 0.4);
        particles.ring(e.x, e.y, 150, C.sun, 0.55);
        particles.ring(e.x, e.y, 230, C.white, 0.65);
        camera.addTrauma(0.3);
        camera.punchZoom(0.06, e.x, e.y);
        break;
      case 'save':
        g.juice.mechanic(e.kind, s, C.cat);
        popups.spawn('MIAOU!', e.x, e.y - 58, 38, C.white, 0.8);
        particles.dust(e.x, e.y, 0, 1, 18, C.cat);
        particles.ring(e.x, e.y, 100, C.cat, 0.4);
        camera.addTrauma(0.55);
        camera.punchZoom(0.1, e.x, e.y);
        time.hitStop(0.09);
        break;
      case 'scooter':
        g.juice.mechanic(e.kind, s, C.white);
        popups.spawn('BEEP BEEP', e.x, e.y - 54, 30, C.white, 0.7);
        particles.ring(e.x, e.y, 90, C.sun, 0.35);
        camera.addTrauma(0.3);
        camera.punchZoom(0.05, e.x, e.y);
        break;
      case 'clink':
        break;
      case 'burn': {
        // Something stood in the way of a burning ball. It no longer does.
        g.juice.mechanic(e.kind, s, C.sun);
        const speed = Math.hypot(b.vx, b.vy) || 1;
        const dx = b.vx / speed;
        const dy = b.vy / speed;
        g.renderer.invalidate();
        particles.rays(e.x, e.y, 240, C.sun);
        particles.ring(e.x, e.y, 240, '#e2472b', 0.5);
        particles.ring(e.x, e.y, 150, C.sun, 0.38);
        particles.ring(e.x, e.y, 90, C.white, 0.3);
        particles.blast(e.x, e.y, 90, C.sun, 0.28);
        particles.debris(e.x, e.y, dx, dy, 60, DEBRIS[g.level.lastBurn?.surface ?? 'wall'] ?? C.white);
        particles.embers(e.x, e.y, dx, dy, 70);
        particles.dust(e.x, e.y, 0, -1, 28, '#5a5560');
        popups.spawn('BOOM!', e.x, e.y - 80, 48, C.sun, 1);
        camera.addTrauma(1);
        camera.punchZoom(0.2, e.x, e.y);
        time.hitStop(0.18);
        break;
      }
      case 'magnet':
        g.juice.mechanic(e.kind, s, C.blueLite);
        particles.ring(b.x, b.y, 120, C.blueLite, 0.4);
        particles.rays(b.x, b.y, 130, C.blueLite);
        popups.spawn('MAGNET!', b.x, b.y - 56, 30, C.white, 0.8);
        camera.addTrauma(0.2);
        break;
    }
  });

  events.on('GOAL_SCORED', (e) => {
    const goal = g.level.goal;
    sounds.goal(e.bounces, e.stars, e.newBest);
    g.juice.goal(e.stars, e.bounces);
    // A duel goal wears the scorer's colours; a solo goal wears the sun.
    const team = g.duelLook?.attacker;
    const burst = team ?? C.sun;
    // Confetti from both posts across the goalmouth, a storm from the rooftops, and a burst out of the net.
    particles.confetti(goal.leftPostX, goal.lineY + 6, 0.5, 1, 70, 1050, team);
    particles.confetti(goal.rightPostX, goal.lineY + 6, -0.5, 1, 70, 1050, team);
    particles.confetti(e.x, goal.lineY - 10, 0, 1, 50, 820, team);
    particles.confetti(goal.cx - 240, goal.lineY - 250, 0.25, 1, 42, 760, team);
    particles.confetti(goal.cx + 240, goal.lineY - 250, -0.25, 1, 42, 760, team);
    particles.ring(e.x, e.y, 140, burst, 0.55);
    particles.ring(e.x, e.y, 230, C.white, 0.62);
    particles.rays(e.x, e.y, 250, burst);
    particles.blast(e.x, e.y, 90, C.white, 0.3);
    particles.sparks(e.x, e.y, 0, -1, 32, C.sun);
    camera.addTrauma(1);
    camera.kick(0, -20);
    camera.punchZoom(0.2, e.x, e.y);
  });

  events.on('SHOT_FAILED', (e) => {
    sounds.miss(e.kind);
    const near = e.kind !== 'miss';
    g.juice.miss(near);
    if (near) {
      particles.ring(e.x, e.y, 80, C.white, 0.4);
      camera.addTrauma(0.35);
      camera.zoomTo(e.x, e.y, 0.16);
      camera.punchZoom(0.04, e.x, e.y);
    }
  });

  events.on('SHOT_RESET', (e) => {
    sounds.reset();
    g.juice.reset();
    particles.ring(e.x, e.y, 60, C.white, 0.3);
  });

  events.on('COIN_SNATCHED', (e) => {
    sounds.coin();
    particles.sparks(e.x, e.y, 0, -1, 10, C.sun);
    particles.ring(e.x, e.y, 46, C.sun, 0.4);
    popups.spawn('+10', e.x, e.y - 46, 30, C.sun, 0.9);
  });

  celebration.onLine = (index, last) => {
    sounds.scoreLine(index, last);
    g.juice.lineLanded();
  };
  celebration.onStar = (index) => {
    sounds.star(index);
    g.juice.starLanded(index);
  };
}
