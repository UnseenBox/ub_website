import { TAU } from '../core/math';
import coinUrl from '../assets/ui/arcade-coin.png';

const coin = new Image();
coin.src = coinUrl;

/** A Kora Coin drifting above the paving until the ball punches it out of the air. */
export function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const bob = Math.sin(time * 2.4) * 7;
  const pulse = 1 + 0.06 * Math.sin(time * 5.1);
  ctx.save();
  ctx.translate(x, y);

  // A soft pool of shade on the paving.
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = '#101b33';
  ctx.beginPath();
  ctx.ellipse(0, 15, 19, 7, 0, 0, TAU);
  ctx.fill();

  // A warm halo so the coin catches the eye from the corner of the screen.
  ctx.globalAlpha = 0.45 + 0.15 * Math.sin(time * 3.3);
  const halo = ctx.createRadialGradient(0, bob, 2, 0, bob, 42);
  halo.addColorStop(0, 'rgba(255, 216, 80, 0.9)');
  halo.addColorStop(1, 'rgba(255, 216, 80, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, bob, 42, 0, TAU);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = false;
  const size = 46 * pulse;
  ctx.drawImage(coin, -size / 2, bob - size / 2, size, size);
  ctx.restore();
}
