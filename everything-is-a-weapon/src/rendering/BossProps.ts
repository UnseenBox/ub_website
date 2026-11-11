import { INK } from '../core/constants';
import { TAU } from '../core/math';
import { COPIERS } from '../entities/bossScripts/ChairmanScript';
import { onTop, prism, roundRectPath, type PathFn } from './draw';
import { registerObjectArt, type ArtContext } from './ObjectArt';

/** Drawings for the things a boss fight puts into the room. */

const rect = (x0: number, y0: number, w: number, h: number, radius = 2): PathFn => (c) => roundRectPath(c, x0, y0, w, h, radius);

/** The Chairman's photocopier: lid, tray, a light bar that sweeps while it prints, a jam light when it chokes. */
function photocopier({ ctx, o, x, y, z, angle, time, tone }: ArtContext): void {
  const state = COPIERS.get(o);
  const broken = o.structural === 'broken';
  const printing = !!state && state.progress > 0 && !state.jammed && !broken;
  const jammed = !!state && state.jammed && !broken;
  // cabinet, then the scanner lid
  prism(ctx, x, y, angle, z, z + 26, rect(-27, -20, 54, 40, 4), tone('#9aa6b8'), tone('#e8edf4'));
  prism(ctx, x, y, angle, z + 26, z + 33, rect(-24, -17, 48, 34, 3), tone('#aeb9c9'), tone('#f6f8fb'));
  onTop(ctx, x, y, angle, z + 33, (c) => {
    // the glass, and the light bar sweeping under it
    c.fillStyle = broken ? '#2b2f3a' : tone('#cfe9f7');
    c.fillRect(-18, -12, 30, 24);
    c.strokeStyle = INK;
    c.lineWidth = 1.4;
    c.strokeRect(-18, -12, 30, 24);
    if (printing) {
      const sweep = ((time * 2.4) % 1) * 22 - 11;
      c.fillStyle = 'rgba(126, 224, 255, 0.95)';
      c.fillRect(-18, sweep, 30, 2.4);
    }
    // control panel
    c.fillStyle = tone('#3b4558');
    c.fillRect(15, -13, 8, 26);
    const lamp = broken ? '#444' : jammed ? (Math.floor(time * 6) % 2 === 0 ? '#ff4d4d' : '#7a1f1f') : printing ? '#7ee0ff' : '#7ee07e';
    c.fillStyle = lamp;
    c.beginPath();
    c.arc(19, -7, 2.4, 0, TAU);
    c.fill();
    c.fillStyle = tone('#d8dde6');
    c.fillRect(17, 0, 4, 3);
    c.fillRect(17, 5, 4, 3);
    // a sheet poking out of the tray
    if (printing || jammed) {
      c.save();
      c.translate(-27, 2);
      c.rotate(jammed ? 0.45 : 0);
      c.fillStyle = '#ffffff';
      c.strokeStyle = INK;
      c.lineWidth = 1;
      c.fillRect(-10 - (printing ? ((time * 40) % 8) : 0), -6, 12, 12);
      c.strokeRect(-10 - (printing ? ((time * 40) % 8) : 0), -6, 12, 12);
      c.restore();
    }
  });

  if (!state || broken) return;
  // floating progress bar, in screen space above the machine
  if (state.progress > 0 && !state.jammed) {
    const bw = 54;
    const bx = x - bw / 2;
    const by = y - z - 52;
    ctx.fillStyle = 'rgba(16, 20, 32, 0.85)';
    ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
    ctx.fillStyle = '#7ee0ff';
    ctx.fillRect(bx, by, bw * state.progress, 8);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx - 2, by - 2, bw + 4, 12);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PRINTING MEMOS', x, by - 5);
    ctx.textAlign = 'start';
  } else if (state.jammed) {
    ctx.fillStyle = '#ffb347';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAPER JAM', x, y - z - 46);
    ctx.textAlign = 'start';
  }
}

export function registerBossPropArt(): void {
  registerObjectArt('photocopier', photocopier);
}
