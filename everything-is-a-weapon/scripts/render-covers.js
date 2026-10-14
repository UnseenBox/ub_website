// Renders the three store covers (landscape, portrait, square) with the game's own art
// and saves them into covers/ through the dev server's /__cover/ endpoint.
//
// How to run: `npm run dev`, open the game, paste this whole file into the browser console.
// It returns a list of the files written.
(async () => {
  const PA = await import('/src/rendering/PlayerArt.ts');
  const PT = await import('/src/rendering/PetArt.ts');
  const PS = await import('/src/entities/Pets.ts');
  const P = await import('/src/entities/Player.ts');
  const EA = await import('/src/rendering/EnemyArt.ts');
  const E = await import('/src/entities/Enemy.ts');
  const ET = await import('/src/entities/EnemyTypes.ts');
  const INK = '#221b36';

  const LETTERS = [
    { ch: 'B', card: '#f4ecdc', ink: '#e5383b', font: '900 FS "Impact", "Arial Black", sans-serif', rot: -5, dy: 6, w: 0.74 },
    { ch: 'O', card: '#e5383b', ink: '#ffffff', font: '900 FS "Arial Black", "Helvetica Neue", Arial, sans-serif', rot: 3, dy: -8, w: 0.9 },
    { ch: 'N', card: '#d8d2c2', ink: INK, font: 'italic 700 FS Georgia, "Times New Roman", serif', rot: -2, dy: 2, w: 0.86 },
    { ch: 'K', card: '#2f4fb5', ink: '#ffffff', font: '900 FS "Arial Black", "Helvetica Neue", Arial, sans-serif', rot: 6, dy: -4, w: 0.84 },
    { ch: '!', card: '#c9a070', ink: INK, font: '900 FS Georgia, "Times New Roman", serif', rot: -4, dy: -14, w: 0.5 },
  ];

  /** The title as a ransom note: each letter cut from a different page. `u` is the card height. */
  function title(ctx, cx, cy, u) {
    const gap = u * 0.06;
    const total = LETTERS.reduce((sum, l) => sum + l.w * u + gap, -gap);
    let x = cx - total / 2;
    for (const l of LETTERS) {
      const w = l.w * u;
      ctx.save();
      ctx.translate(x + w / 2, cy + (l.dy / 100) * u);
      ctx.rotate((l.rot * Math.PI) / 180);
      ctx.fillStyle = 'rgba(17, 14, 34, 0.55)';
      ctx.fillRect(-w / 2 + u * 0.05, -u / 2 + u * 0.07, w, u);
      ctx.fillStyle = l.card;
      ctx.beginPath();
      // slightly uneven scissor work
      ctx.moveTo(-w / 2, -u / 2 + u * 0.02);
      ctx.lineTo(w / 2 - u * 0.02, -u / 2);
      ctx.lineTo(w / 2, u / 2 - u * 0.03);
      ctx.lineTo(-w / 2 + u * 0.03, u / 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = l.ink;
      ctx.font = l.font.replace('FS', `${Math.round(u * 0.82)}px`);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(l.ch, 0, u * 0.04);
      ctx.restore();
      x += w + gap;
    }
  }

  function room(ctx, W, H, floorY) {
    ctx.fillStyle = '#57487c';
    ctx.fillRect(0, 0, W, floorY);
    ctx.fillStyle = '#4b3d6e';
    const stripe = W / 19;
    for (let i = 0; i < 20; i++) ctx.fillRect(i * stripe + stripe * 0.2, 0, stripe * 0.38, floorY);
    ctx.fillStyle = '#fbf6e9';
    ctx.fillRect(0, floorY - H * 0.018, W, H * 0.022);
    ctx.fillStyle = '#c9a070';
    ctx.fillRect(0, floorY, W, H - floorY);
    ctx.strokeStyle = 'rgba(34,27,54,0.25)';
    ctx.lineWidth = Math.max(2, H * 0.004);
    ctx.beginPath();
    const board = (H - floorY) / 5.5;
    for (let y = floorY + board; y < H; y += board) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    const light = ctx.createRadialGradient(W / 2, floorY, Math.min(W, H) * 0.1, W / 2, floorY, Math.max(W, H) * 0.75);
    light.addColorStop(0, 'rgba(255,243,214,0.32)');
    light.addColorStop(1, 'rgba(17,14,34,0.66)');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, W, H);
  }

  function mover(ctx, type, x, y, sc, facing) {
    const e = new E.Enemy(ET.ENEMY_TYPES[type], 0, 0, -1, 0);
    e.facing = facing;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(17,14,34,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 6, 18, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    EA.drawEnemy(ctx, e, 0, 0, 0.4);
    ctx.restore();
  }

  function hero(ctx, id, x, y, sc, faceRight) {
    const pl = Object.assign(new P.Player(0, 0), { aimX: faceRight ? 0.35 : -0.35, aimY: 0.94 });
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);
    ctx.fillStyle = 'rgba(17,14,34,0.3)';
    ctx.beginPath();
    ctx.ellipse(1, 3, 17, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    PA.drawPlayer(ctx, pl, 0, 0, 0.6, id);
    const pet = PS.createPet(id, 0, 0);
    pet.sitting = true;
    pet.facing = faceRight ? 1 : -1;
    if (pet.species === 'parrot') {
      pet.facing = 1;
      PT.drawPet(ctx, pet, 9, 1, 37, 0.6);
    } else if (pet.species === 'hamster') PT.drawPet(ctx, pet, faceRight ? 27 : -27, 6, 0, 0.6);
    else PT.drawPet(ctx, pet, faceRight ? 28 : -28, 7, 0, 0.6);
    ctx.restore();
  }

  const covers = {
    'cover-landscape-1920x1080.png': [1920, 1080, (ctx, W, H) => {
      room(ctx, W, H, 720);
      mover(ctx, 'trolley', 120, 730, 4.8, 0.5);
      mover(ctx, 'kaboom', 310, 690, 4.0, 0.9);
      mover(ctx, 'fragile', 1640, 690, 4.0, 2.2);
      mover(ctx, 'nested', 1810, 740, 4.8, 2.5);
      ['tenant', 'flatmate', 'gran', 'kid'].forEach((id, i) => hero(ctx, id, 380 + i * 400, 985, 6.2, i < 2));
      title(ctx, W / 2, 245, 330);
    }],
    'cover-square-800x800.png': [800, 800, (ctx, W, H) => {
      room(ctx, W, H, 560);
      mover(ctx, 'kaboom', 70, 560, 3.2, 0.8);
      mover(ctx, 'nested', 735, 570, 3.4, 2.4);
      ['tenant', 'flatmate', 'gran', 'kid'].forEach((id, i) => hero(ctx, id, 118 + i * 190, 740, 3.3, i < 2));
      title(ctx, W / 2, 205, 170);
    }],
    'cover-portrait-800x1200.png': [800, 1200, (ctx, W, H) => {
      room(ctx, W, H, 760);
      mover(ctx, 'trolley', 80, 740, 3.6, 0.6);
      mover(ctx, 'fragile', 725, 735, 3.4, 2.3);
      hero(ctx, 'gran', 265, 850, 4.3, true);
      hero(ctx, 'kid', 540, 850, 4.3, true);
      hero(ctx, 'tenant', 270, 1120, 5.2, false);
      hero(ctx, 'flatmate', 540, 1120, 5.2, true);
      title(ctx, W / 2, 270, 170);
    }],
  };

  const written = [];
  for (const [name, [W, H, draw]] of Object.entries(covers)) {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    draw(ctx, W, H);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const res = await fetch(`/__cover/${name}`, { method: 'POST', body: blob });
    written.push(`${await res.text()} (${Math.round(blob.size / 1024)} KB)`);
  }
  return written;
})();
