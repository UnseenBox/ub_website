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
  if (moving) g.audio.swell(0.2, 0.1);
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

  events.on('BALL_LAUNCHED', (e) => {
    sounds.kick(e.power);
    particles.dust(e.x - e.dirX * 12, e.y - e.dirY * 12, -e.dirX, -e.dirY, 5 + 9 * e.power, C.sand);
    particles.ring(e.x, e.y, 36 + 34 * e.power, C.white, 0.3);
    camera.kick(e.dirX * (2 + 7 * e.power), e.dirY * (2 + 7 * e.power));
    camera.addTrauma(0.1 + 0.22 * e.power);
    // A duel card riding on the shot announces itself as the ball leaves.
    const boost = g.flightBoost;
    if (boost) {
      const card = cardOf(boost);
      sounds.boost(boost);
      particles.ring(e.x, e.y, 130, card.color, 0.5);
      particles.rays(e.x, e.y, 110, card.color);
      popups.spawn(`${tr(card.name)}!`, e.x, e.y - 64, 28, C.white, 0.9);
      camera.addTrauma(0.2);
    }
  });

  events.on('BALL_COLLIDED', (e) => {
    if (e.impact < 25) return;
    const s = clamp01(e.impact / FULL_IMPACT);
    sounds.bounce(e.surface, s, e.bounce, time.elapsed);
    ball.impact(e.nx, e.ny, s);

    if (e.surface === 'net') {
      g.net.punch(e.x, -e.nx * e.impact * 0.5, -e.ny * e.impact * 0.5);
      return;
    }
    g.level.hitBlock(e.bodyId, e.nx, e.ny, s);
    particles.dust(e.x, e.y, e.nx, e.ny, 3 + 9 * s, DUST[e.surface] ?? C.white);
    if (s > 0.28) particles.sparks(e.x, e.y, e.nx, e.ny, 4 + 10 * s, C.white);
    if (s > 0.4) particles.rays(e.x, e.y, 30 + 40 * s, C.white);
    camera.addTrauma(0.07 + 0.4 * s);
    camera.kick(-e.nx * 7 * s, -e.ny * 7 * s);
    // The hardest hits hold for a couple of frames: that pause is what reads as weight.
    if (s > 0.6) time.hitStop(0.02 + 0.035 * (s - 0.6));
    if (g.flightBoost === 'rubber') {
      // A rubber ball rings every time it lands.
      sounds.rubber();
      particles.ring(e.x, e.y, 64, RUBBER_GREEN, 0.3);
      particles.ring(e.x, e.y, 112, '#8fe0b4', 0.45);
    }
    // A post announces itself; the combo count would only sit on top of it.
    if (e.bounce >= 2 && e.surface !== 'post') popups.spawn(`x${e.bounce}`, e.x + e.nx * 36, e.y + e.ny * 36, 20 + Math.min(e.bounce, 6) * 3, C.sun);
  });

  events.on('BALL_HIT_POST', (e) => {
    popups.spawn('POST!', e.x, e.y + 52, 24, C.white, 0.8);
    particles.ring(e.x, e.y, 48, C.sun, 0.4);
    camera.addTrauma(0.15);
  });

  events.on('MECHANIC', (e) => {
    sounds.mechanic(e.kind, e.strength);
    const b = ball.body;
    switch (e.kind) {
      case 'boing':
        particles.ring(e.x, e.y, 70, C.sun, 0.35);
        popups.spawn('BOING', e.x, e.y - 50, 22, C.sun, 0.6);
        camera.addTrauma(0.2);
        break;
      case 'bumper':
        particles.ring(e.x, e.y, 96, C.sun, 0.45);
        particles.ring(e.x, e.y, 60, '#ff5a5a', 0.4);
        particles.rays(e.x, e.y, 110, C.sun);
        popups.spawn('PING!', e.x, e.y - 56, 26, C.sun, 0.8);
        camera.addTrauma(0.3);
        time.hitStop(0.03);
        break;
      case 'spin':
        particles.ring(e.x, e.y, 80, C.blueLite, 0.4);
        particles.sparks(e.x, e.y, 0, -1, 8, C.white);
        popups.spawn('WHIZZ!', e.x, e.y - 52, 22, C.white, 0.7);
        camera.addTrauma(0.24);
        break;
      case 'wind':
        particles.dust(e.x, e.y, 0, -1, 12, C.white);
        particles.ring(e.x, e.y, 70, C.blueLite, 0.35);
        popups.spawn('WHOOSH!', e.x, e.y - 50, 20, C.white, 0.7);
        break;
      case 'pipe':
        // Gone at one end, out at the other.
        particles.ring(e.x, e.y, 60, C.blue, 0.4);
        particles.dust(e.x, e.y, 0, -1, 8, C.stone);
        particles.ring(b.x, b.y, 80, C.sun, 0.45);
        particles.dust(b.x, b.y, 0, -1, 12, C.stone);
        camera.addTrauma(0.25);
        break;
      case 'sand':
        particles.dust(e.x, e.y, 0, -1, 10 + 14 * e.strength, C.sand);
        break;
      case 'smash':
        particles.shards(e.x, e.y, b.vx, b.vy, 46);
        particles.rays(e.x, e.y, 90, C.white);
        popups.spawn('SMASH!', e.x, e.y - 60, 28, C.white, 0.8);
        camera.addTrauma(0.6);
        time.hitStop(0.07);
        break;
      case 'bell':
        popups.spawn('DING DONG', e.x, e.y - 70, 22, C.sun, 0.9);
        camera.addTrauma(0.15);
        break;
      case 'save':
        popups.spawn('MIAOU!', e.x, e.y - 50, 24, C.white, 0.8);
        particles.dust(e.x, e.y, 0, 1, 8, C.cat);
        camera.addTrauma(0.3);
        time.hitStop(0.05);
        break;
      case 'scooter':
        popups.spawn('BEEP BEEP', e.x, e.y - 50, 20, C.white, 0.7);
        camera.addTrauma(0.2);
        break;
      case 'clink':
        break;
      case 'burn': {
        // Something stood in the way of a burning ball. It no longer does.
        const speed = Math.hypot(b.vx, b.vy) || 1;
        const dx = b.vx / speed;
        const dy = b.vy / speed;
        g.renderer.invalidate();
        particles.rays(e.x, e.y, 160, C.sun);
        particles.ring(e.x, e.y, 170, '#e2472b', 0.5);
        particles.ring(e.x, e.y, 96, C.sun, 0.35);
        particles.debris(e.x, e.y, dx, dy, 36, DEBRIS[g.level.lastBurn?.surface ?? 'wall'] ?? C.white);
        particles.embers(e.x, e.y, dx, dy, 40);
        particles.dust(e.x, e.y, 0, -1, 18, '#5a5560');
        popups.spawn('BOOM!', e.x, e.y - 70, 34, C.sun, 1);
        camera.addTrauma(0.75);
        time.hitStop(0.09);
        break;
      }
      case 'magnet':
        particles.ring(b.x, b.y, 90, C.blueLite, 0.4);
        popups.spawn('MAGNET!', b.x, b.y - 50, 24, C.white, 0.8);
        camera.addTrauma(0.12);
        break;
    }
  });

  events.on('GOAL_SCORED', (e) => {
    const goal = g.level.goal;
    sounds.goal(e.bounces, e.stars, e.newBest);
    // A duel goal wears the scorer's colours; a solo goal wears the sun.
    const team = g.duelLook?.attacker;
    const burst = team ?? C.sun;
    // Confetti from both posts across the goalmouth, and a burst out of the net.
    particles.confetti(goal.leftPostX, goal.lineY + 6, 0.5, 1, 44, 900, team);
    particles.confetti(goal.rightPostX, goal.lineY + 6, -0.5, 1, 44, 900, team);
    particles.confetti(e.x, goal.lineY - 10, 0, 1, 26, 620, team);
    particles.ring(e.x, e.y, 96, burst, 0.5);
    camera.addTrauma(0.62);
    camera.kick(0, -9);
  });

  events.on('SHOT_FAILED', (e) => sounds.miss(e.kind));

  events.on('SHOT_RESET', (e) => {
    sounds.reset();
    particles.ring(e.x, e.y, 46, C.white, 0.3);
  });

  celebration.onLine = (index, last) => sounds.scoreLine(index, last);
  celebration.onStar = (index) => sounds.star(index);
}
