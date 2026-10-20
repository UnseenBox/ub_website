import type { Game } from '../core/Game';
import { WALL_THING, type Thing } from '../core/types';
import { clamp } from '../core/math';
import type { Contact } from '../physics/CollisionResolver';
import type { SoundKind } from '../objects/Materials';
import { impactWord } from '../rendering/Fx';
import { passChain } from './Chain';

const CHAIN_PASS_IMPULSE = 220;
const FEEDBACK_IMPULSE = 120;
const FALL_DAMAGE_SCALE = 0.008;

function soundOf(thing: Thing): SoundKind | null {
  if (thing.kind === 'object') return thing.material.sound;
  if (thing.kind === 'enemy' || thing.kind === 'player') return 'soft';
  return null;
}

/** An intruder only hands a chain on while it is being thrown around, not while walking normally. */
function carriesCause(thing: Thing): boolean {
  if (thing.kind !== 'enemy') return true;
  return thing.defeated || thing.stun > 0 || thing.slip > 0;
}

/**
 * Turns raw physics contacts into gameplay: hands chains along, runs the impact rules
 * and produces feedback (sound, debris, shake) scaled by how hard the hit really was.
 */
export class ImpactSystem {
  constructor(private readonly game: Game) {}

  process(): void {
    const world = this.game.world;
    for (let i = 0; i < world.contactCount; i++) {
      const contact = world.contacts[i]!;
      if (contact.impulse < 40) continue;
      this.handle(contact);
    }
    for (let i = 0; i < world.landingCount; i++) {
      const landing = world.landings[i]!;
      this.landed(landing.body.owner, landing.speed);
    }
  }

  private handle(contact: Contact): void {
    const game = this.game;
    const a: Thing = contact.a.owner ?? WALL_THING;
    const b: Thing = contact.b.owner ?? WALL_THING;
    const impulse = contact.impulse;

    if (impulse > CHAIN_PASS_IMPULSE) {
      if (b.kind !== 'player' && carriesCause(a)) passChain(a, b, game.time);
      if (a.kind !== 'player' && carriesCause(b)) passChain(b, a, game.time);
    }

    game.interactions.handleContact(contact);

    if (impulse < FEEDBACK_IMPULSE) return;
    const intensity = clamp(impulse / 6000, 0.05, 1);
    const object = a.kind === 'object' ? a : b.kind === 'object' ? b : null;

    const sound = (object ? object.material.sound : null) ?? soundOf(a) ?? soundOf(b);
    if (sound) game.audio.impact(sound, intensity, object ? object.body.mass : 40);
    const quirky = a.kind === 'object' && a.def.quirk ? a : b.kind === 'object' && b.def.quirk ? b : null;
    if (quirky) {
      if (quirky.def.quirk === 'squeak') {
        game.audio.play('squeak', 0.5 + intensity);
        if (impulse > 500) game.fx.burst('SQUEAK!', contact.px, contact.py - 24, 0.75, '#ffe36e');
      } else if (impulse > 900) {
        game.audio.play('gong', intensity, 1.5 - Math.min(0.7, quirky.body.mass / 8));
      }
    }

    if (impulse > 700) {
      if (object) {
        // Debris sprays along the contact normal so every smash reads directionally.
        game.particles.burst(object.material.debris, contact.px, contact.py - object.body.z, 2 + Math.floor(intensity * 6), 120 + intensity * 200, {
          dirX: contact.nx, dirY: contact.ny, spread: 1.1,
        });
        object.squash = Math.max(object.squash, intensity);
      }
      game.particles.burst('dust', contact.px, contact.py, 1 + Math.floor(intensity * 4), 60 + intensity * 80, {
        dirX: contact.nx, dirY: contact.ny, spread: 1.4,
      });
      game.fx.ring(contact.px, contact.py, 4, 14 + intensity * 30, 0.22, 'rgba(255,255,255,0.5)', 2);
      // Really hard smashes throw sparks even when no creature is involved.
      if (impulse > 2200) {
        game.impactSpark(contact.px, contact.py - 10, Math.min(0.6, 0.3 + intensity * 0.3), contact.nx, contact.ny);
      }
      game.bus.emit({ type: 'OBJECT_HIT', a, b, impulse, x: contact.px, y: contact.py });
    }
    if (impulse > 1400) {
      game.camera.addShake(Math.min(0.5, impulse / 16000));
      game.camera.kick(contact.nx * intensity * 5, contact.ny * intensity * 5);
      game.fx.ring(contact.px, contact.py, 4, 22 + intensity * 52, 0.3, 'rgba(255,255,255,0.8)', 2 + intensity * 2.5);
      game.noise(contact.px, contact.py, intensity);
    }
    // Hits on intruders get their sound word from the damage event; this covers furniture and walls.
    if (impulse > 2600 && object && a.kind !== 'enemy' && b.kind !== 'enemy') {
      game.fx.burst(impactWord(object.material.sound), contact.px, contact.py - 26 - object.body.z, 0.7 + intensity * 0.5);
    }
  }

  /** An object came down on the floor (or on a table) at the given vertical speed. */
  landed(owner: Thing | null, speed: number): void {
    if (!owner || owner.kind !== 'object' || !owner.alive) return;
    const game = this.game;
    const b = owner.body;
    const fromSurface = owner.fellFrom !== null;
    owner.fellFrom = null;

    const energy = b.mass * speed;
    game.particles.burst('dust', b.x, b.y, 2 + Math.min(6, Math.floor(energy / 500)), 50 + Math.min(120, energy / 20));
    game.audio.impact(owner.material.sound, clamp(energy / 2600, 0.1, 0.85), b.mass);
    if (energy > 1200) game.camera.addShake(Math.min(0.3, energy / 11000));
    if (energy > 500) {
      game.fx.ring(b.x, b.y, b.boundR * 0.5, b.boundR + 8 + Math.min(34, energy / 120), 0.24, 'rgba(255,255,255,0.55)', 2);
    }
    if (energy > 2600) game.addDecal('scuff', b.x, b.y, b.boundR + 4);
    // Coming down in a puddle makes a splash.
    for (const zone of game.zones.zones) {
      if (zone.zone !== 'water' || !zone.alive) continue;
      if (Math.hypot(zone.x - b.x, zone.y - b.y) < zone.r * 0.85) {
        game.particles.burst('water', b.x, b.y, 6 + Math.min(10, Math.floor(energy / 300)), 150);
        game.fx.ring(b.x, b.y, 4, 26 + Math.min(30, energy / 150), 0.4, 'rgba(210,246,255,0.8)', 2);
        game.audio.play('splash', clamp(energy / 2200, 0.25, 0.9));
        break;
      }
    }
    owner.squash = Math.max(owner.squash, clamp(energy / 2500, 0.2, 1));

    if (fromSurface && !owner.thrownByPlayer) game.discoveries.unlock('gravity');
    owner.applyDamage(game, energy * FALL_DAMAGE_SCALE * owner.material.fragility);
    if (owner.alive) game.bus.emit({ type: 'OBJECT_LANDED', object: owner, speed });
  }
}
