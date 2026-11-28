// The moment a gun, a tool or a keepsake is won. Its square screen appears grey and
// padlocked; the lock rattles and bursts off, the picture floods with colour and the prize
// speaks for itself. Shown once for each new prize, over the screen that earned it.

import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { weaponById } from '../data/weapons';
import { relicById, toolById } from '../data/tools';
import type { QuestReward } from '../data/quests';
import { VIEW } from '../game/config';
import { backdrop } from '../rendering/Margins';
import { makeCanvas } from '../rendering/CanvasUtil';
import { GunTile } from './gunTile';
import { ITEM_ICON, icon, type IconName } from './icons';
import { C, STENCIL, pushButton, text } from './kit';

const DEPTH = 100;
/** The gun's square: its side and where its middle sits. */
const SIDE = 390;
const MID = 348;
/** When, in milliseconds, the lock rattles, bursts, and the way on appears. */
const RATTLES = [430, 650, 840];
const BURST = 1080;
const READY = 1650;
const RAYS = 'gun_reveal_rays';

/** A fan of soft beams around a middle, painted once. */
function paintRays(scene: Phaser.Scene): void {
  if (scene.textures.exists(RAYS)) return;
  const size = 512, half = size / 2, beams = 14;
  const { canvas, ctx } = makeCanvas(size, size);
  const fade = ctx.createRadialGradient(half, half, 20, half, half, half);
  fade.addColorStop(0, 'rgba(255,226,150,0.95)');
  fade.addColorStop(0.55, 'rgba(240,190,80,0.45)');
  fade.addColorStop(1, 'rgba(220,160,50,0)');
  ctx.fillStyle = fade;
  for (let i = 0; i < beams; i++) {
    const a = (i / beams) * Math.PI * 2, wide = (Math.PI / beams) * (i % 2 ? 0.55 : 0.9);
    ctx.beginPath();
    ctx.moveTo(half, half);
    ctx.arc(half, half, half, a - wide / 2, a + wide / 2);
    ctx.closePath();
    ctx.fill();
  }
  scene.textures.addCanvas(RAYS, canvas);
}

/** One thing won: a gun with its picture, or a tool or keepsake with its symbol. */
export interface Prize {
  title: string;
  name: string;
  /** A line on what it does. */
  note?: string;
  picture?: { id: string; source: string };
  symbol?: { name: IconName; color: number };
  /** The sounds of it breaking free and being taken in hand. */
  shot: string;
  ready: string;
}

export function gunPrize(id: string): Prize {
  const def = weaponById(id);
  return { title: 'NEW WEAPON', name: def.name, picture: { id, source: def.viewTexture }, shot: def.sound.shot, ready: def.sound.reload };
}

export function questPrize(r: QuestReward): Prize {
  const def = r.kind === 'tool' ? toolById(r.id)! : relicById(r.id)!;
  return {
    title: r.kind === 'tool' ? 'NEW TOOL' : 'NEW KEEPSAKE', name: def.name, note: def.description,
    symbol: { name: ITEM_ICON[r.id], color: r.kind === 'tool' ? toolById(r.id)!.color : C.gold },
    shot: 'orbital_blast', ready: 'buy',
  };
}

/** Shows one reveal for each prize, one after another, then calls `done`. */
export function showReveals(scene: Phaser.Scene, prizes: readonly Prize[], done: () => void): void {
  const [prize, ...rest] = prizes;
  if (!prize) {
    done();
    return;
  }
  reveal(scene, prize, rest.length > 0, () => showReveals(scene, rest, done));
}

function reveal(scene: Phaser.Scene, prize: Prize, more: boolean, done: () => void): void {
  paintRays(scene);
  const picture = prize.picture ?? null;
  const cx = VIEW.centerX;
  const root = scene.add.container(0, 0).setDepth(DEPTH);
  const timers: Phaser.Time.TimerEvent[] = [];
  const at = (ms: number, run: () => void): void => { timers.push(scene.time.delayedCall(ms, run)); };

  const dark = backdrop(scene, 0x050604, 1).setAlpha(0).setInteractive();
  const rays = scene.add.image(cx, MID, RAYS).setScale(2.7).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  const halo = scene.add.image(cx, MID, 'glow').setTint(0xf0b840).setDisplaySize(760, 760).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  const frame = scene.add.container(cx, MID).setScale(0.55).setAlpha(0);
  let tile = new GunTile(scene, -SIDE / 2, -SIDE / 2, SIDE, picture, true, 8);
  const edge = scene.add.rectangle(0, 0, SIDE + 8, SIDE + 8, 0, 0).setStrokeStyle(4, C.lineStrong);
  frame.add([tile.c, edge]);
  // A tool or keepsake has a symbol on the screen instead of a picture: grey until freed.
  let symbol = prize.symbol ? icon(scene, prize.symbol.name, 0, 0, 230, C.dim) : null;
  if (symbol) frame.add(symbol);

  // The padlock: a dark badge over the grey picture.
  const badge = scene.add.circle(0, 0, 74, 0x0b0c08, 0.9).setStrokeStyle(5, C.brass);
  const lock = scene.add.container(cx, MID, [badge, icon(scene, 'lock', 0, -2, 88, C.text)]).setScale(0.4).setAlpha(0);

  const head = text(scene, cx, 78, prize.title, { size: 70, font: STENCIL, color: C.gold, shadow: 5 }).setOrigin(0.5).setAlpha(0);
  const name = text(scene, cx, MID + SIDE / 2 + (prize.note ? 32 : 44), prize.name.toUpperCase(), { size: 42, font: STENCIL, shadow: 4 }).setOrigin(0.5).setAlpha(0);
  const note = text(scene, cx, MID + SIDE / 2 + 72, prize.note ?? '', { size: 20, color: C.soft, bold: true }).setOrigin(0.5).setAlpha(0);
  if (note.width > VIEW.width - 60) note.setScale((VIEW.width - 60) / note.width);
  if (name.width > VIEW.width - 80) name.setScale((VIEW.width - 80) / name.width);
  const flash = scene.add.rectangle(cx, MID, SIDE, SIDE, 0xfff4d6).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
  root.add([dark, rays, halo, frame, flash, lock, head, name, note]);

  const move = (): void => tile.update(scene.time.now / 1000);
  scene.events.on(Phaser.Scenes.Events.UPDATE, move);
  const stop = (): void => { scene.events.off(Phaser.Scenes.Events.UPDATE, move); };
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);

  scene.tweens.add({ targets: dark, alpha: 1, duration: 220 });
  scene.tweens.add({ targets: frame, scale: 1, alpha: 1, duration: 330, ease: 'Back.Out' });
  scene.tweens.add({ targets: lock, scale: 1, alpha: 1, duration: 300, delay: 130, ease: 'Back.Out' });

  // The lock rattles, harder each time.
  RATTLES.forEach((ms, i) => at(ms, () => {
    const swing = 11 + i * 7;
    audio.play('ui_click', { volume: 0.8, rate: 0.7 + i * 0.22 });
    scene.tweens.add({ targets: lock, angle: { from: -swing, to: swing }, duration: 45, yoyo: true, repeat: 1, onComplete: () => lock.setAngle(0) });
    scene.tweens.add({ targets: frame, scale: { from: 1.03 + i * 0.02, to: 1 }, angle: { from: (i % 2 ? 1 : -1) * (1.4 + i), to: 0 }, duration: 150 });
    halo.setAlpha(0.12 + i * 0.1);
  }));

  at(BURST, () => {
    audio.play('shutter_hit', { volume: 0.9, rate: 1.35 });
    audio.play(prize.shot, { volume: 0.9 });
    audio.play('wave_clear', { volume: 0.7, rate: 1.15 });
    scene.cameras.main.shake(260, 0.01);

    // The grey picture gives way to the gun in colour.
    tile.c.destroy();
    tile = new GunTile(scene, -SIDE / 2, -SIDE / 2, SIDE, picture, false, 8);
    frame.addAt(tile.c, 0);
    if (symbol && prize.symbol) {
      symbol.destroy();
      symbol = icon(scene, prize.symbol.name, 0, 0, 230, prize.symbol.color);
      frame.add(symbol);
    }
    edge.setStrokeStyle(6, C.gold);
    frame.setScale(1.24).setAngle(0);
    scene.tweens.add({ targets: frame, scale: 1, duration: 460, ease: 'Back.Out' });

    flash.setAlpha(0.95);
    scene.tweens.add({ targets: flash, alpha: 0, scale: 1.35, duration: 420, ease: 'Quad.easeOut' });
    scene.tweens.add({ targets: lock, y: MID + 330, angle: 140, alpha: 0, scale: 1.5, duration: 620, ease: 'Quad.easeIn' });
    scene.tweens.add({ targets: rays, alpha: 0.36, duration: 380 });
    scene.tweens.add({ targets: rays, angle: 360, duration: 16000, repeat: -1 });
    halo.setAlpha(0.75);
    scene.tweens.add({ targets: halo, alpha: 0.32, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Two rings race outward, and brass sparks with them.
    [0, 130].forEach((delay) => {
      const ring = scene.add.circle(cx, MID, SIDE * 0.5, 0, 0).setStrokeStyle(8, C.gold).setScale(0.6).setAlpha(0);
      root.addAt(ring, root.getIndex(frame));
      scene.tweens.add({
        targets: ring, scale: 2.1, alpha: { from: 0.9, to: 0 }, duration: 620, delay, ease: 'Cubic.easeOut', onComplete: () => ring.destroy(),
      });
    });
    const sparks = scene.add.particles(cx, MID, 'dot', {
      emitting: false, speed: { min: 260, max: 780 }, lifespan: { min: 450, max: 1100 }, gravityY: 520,
      scale: { start: 1.1, end: 0 }, tint: [0xfff0c0, 0xf0c860, 0xff9a40], blendMode: Phaser.BlendModes.ADD,
    });
    root.add(sparks);
    sparks.explode(90, 0, 0);

    head.setScale(2.4);
    scene.tweens.add({ targets: head, scale: 1, alpha: 1, duration: 340, delay: 90, ease: 'Back.Out' });
    name.y += 40;
    scene.tweens.add({ targets: name, y: name.y - 40, alpha: 1, duration: 320, delay: 240, ease: 'Cubic.easeOut' });
    scene.tweens.add({ targets: note, alpha: 1, duration: 320, delay: 520 });
  });
  // Its action racks, as if it were being taken in hand.
  at(BURST + 420, () => audio.play(prize.ready, { volume: 0.7 }));

  let ready = false, leaving = false;
  const leave = (): void => {
    if (!ready || leaving) return;
    leaving = true;
    scene.input.keyboard?.off('keydown-ENTER', leave);
    scene.input.keyboard?.off('keydown-SPACE', leave);
    scene.tweens.add({
      targets: root, alpha: 0, duration: 200,
      onComplete: () => {
        timers.forEach((t) => t.remove());
        stop();
        scene.events.off(Phaser.Scenes.Events.SHUTDOWN, stop);
        scene.tweens.killTweensOf([rays, halo]);
        root.destroy();
        done();
      },
    });
  };
  at(READY, () => {
    ready = true;
    const go = pushButton(scene, cx, VIEW.height - 40, { w: 280, h: 56, size: 28, icon: 'play', label: more ? 'NEXT' : 'CONTINUE', tone: 'go', onClick: leave });
    go.c.setAlpha(0);
    root.add(go.c);
    scene.tweens.add({ targets: go.c, alpha: 1, duration: 200 });
    scene.tweens.add({ targets: go.c, scale: 1.06, duration: 520, delay: 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    dark.on('pointerup', leave);
    scene.input.keyboard?.on('keydown-ENTER', leave);
    scene.input.keyboard?.on('keydown-SPACE', leave);
  });
}
