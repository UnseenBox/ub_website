import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { starTotals } from '../systems/Campaign';
import { profile } from '../systems/Profile';
import { endlessOpen } from '../systems/Retention';
import { BODY, C, STENCIL, centreRow, chip, portraitTexture, pushButton, text } from '../ui/kit';
import { backdrop } from '../rendering/Margins';
import { VIEW } from './config';

type Line = { who?: string; text: string };

export interface EndingData {
  /** The act just finished: 3 (the Heart) leads into Act 4, 4 (the Gorger) into Act 5, and 5 is the last word. */
  act?: number;
}

/** After the Heart: the valley is free, and a haze appears up the coast. */
const ACT3_LINES: Line[] = [
  { text: 'The Heart stopped at 04:12. By sunrise the fog had drawn back off Harlow Valley for the first time in six weeks.' },
  { who: 'HALE', text: 'Every bunker on the Fogline is reporting clear skies. We held, Warden. Then we pushed. Then we won.' },
  { who: 'VARGA', text: 'I will testify. Everything we did at Meridian goes on the record, and every name it took goes on the memorial.' },
  { who: 'DOT', text: 'I am keeping the M82. For research.' },
  { who: 'KESTREL', text: 'First flight in weeks with nothing to shoot at. It is boring. I love it.' },
  { text: 'Three days later, a farmer north of the quarry reported a grey haze over his well.' },
  { who: 'VARGA', text: 'The Heart was a culture, Warden. Cultures leave spores. It will come back, and the line has to be ready.' },
];

/** After the Bloom: the last spore is gone. */
const ACT4_LINES: Line[] = [
  { text: 'The Bloom burned for two days in the yard of Fort Ashby. When the smoke cleared, the air over the coast was clean.' },
  { who: 'HALE', text: 'The fishing boats are back out. The trains run to the sea again. The Fogline is being stood down, bunker by bunker.' },
  { who: 'VARGA', text: 'I tested every well from the quarry to the harbour. Nothing. No spores, no seeds. It is gone.' },
  { who: 'VESNA', text: 'I will miss the mortar. Do not tell anyone I said that.' },
  { who: 'ROOK', text: 'First thing I am doing is sleeping for a week.' },
  { who: 'DOT', text: 'The farm bunker stays, though. I am keeping it oiled. Just in case.' },
  { who: 'HALE', text: 'Warden, the summit village in the high pass has stopped answering. Pack your rifle.' },
];

/** After the twin giants: the pass is held, and the campaign is over. */
const ACT5_LINES: Line[] = [
  { text: 'It snowed on the pass for three days. When it stopped, there was no fog anywhere between the mountains and the sea.' },
  { who: 'VARGA', text: 'No spores in the snow. No seeds in the rock. This time I checked twice.' },
  { who: 'VESNA', text: 'I will miss the mortar. Do not tell anyone I said that.' },
  { who: 'ROOK', text: 'First thing I am doing is sleeping for a week.' },
  { who: 'DOT', text: 'The farm bunker stays, though. I am keeping it oiled. Just in case.' },
  { who: 'HALE', text: 'Warden: thank you. Every one of them got home because you held.' },
];

export class EndingScene extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  create(data: EndingData = {}): void {
    const act = data.act ?? 3;
    const finalAct = act >= 5;
    const LINES = finalAct ? ACT5_LINES : act === 4 ? ACT4_LINES : ACT3_LINES;
    this.input.setDefaultCursor('default');
    backdrop(this, 0x0a0b09);
    // A pale dawn rising behind the text.
    const dawn = backdrop(this, 0xd8c090, 0);
    this.tweens.add({ targets: dawn, fillAlpha: 0.12, duration: 9000 });
    text(this, VIEW.centerX, 62, finalAct ? 'THE LINE HOLDS' : act === 4 ? 'CLEAR SKIES' : 'THE FOG LIFTS', { size: 56, font: STENCIL, color: C.title }).setOrigin(0.5);
    const p = profile.get();
    const stars = starTotals(p);
    centreRow([
      chip(this, { icon: 'check', iconColor: C.ok, text: finalAct ? 'CAMPAIGN' : `ACT ${act}`, tone: 'green', size: 18 }),
      chip(this, { icon: 'star', text: `${stars.earned}/${stars.total}`, tone: 'gold', size: 18 }),
    ], VIEW.centerX, 120);

    // The story, line by line: narration centred, radio lines beside the speaker's portrait.
    let y = 154;
    const texts: (Phaser.GameObjects.Text | Phaser.GameObjects.Image)[] = [];
    LINES.forEach((l, i) => {
      const shown: (Phaser.GameObjects.Text | Phaser.GameObjects.Image)[] = [];
      if (l.who) {
        const who = text(this, 268, y, l.who, { size: 13, color: C.brass, bold: true, spacing: 2 });
        const said = text(this, 268, y + 17, l.text, { size: 17, font: BODY, wrap: 790 });
        shown.push(this.add.image(230, y + 23, portraitTexture(this, l.who, 44)).setScale(0.5), who, said);
        y += Math.max(54, said.height + 28);
      } else {
        const said = text(this, VIEW.centerX, y, l.text, { size: 17, font: BODY, color: C.soft, wrap: 900, align: 'center' }).setOrigin(0.5, 0);
        shown.push(said);
        y += said.height + 14;
      }
      for (const o of shown) o.setAlpha(0);
      texts.push(...shown);
      this.tweens.add({ targets: shown, alpha: 1, duration: 900, delay: 600 + i * 1700 });
    });
    const end = 600 + LINES.length * 1700;
    let shown = false;
    const finish = (): void => {
      if (shown) return;
      shown = true;
      audio.play('wave_clear', { volume: 0.6, rate: 0.8 });
      const next = !finalAct
        ? chip(this, { icon: 'lock', text: `ACT ${act + 1}`, tone: 'gold', size: 18 })
        : endlessOpen(p) ? chip(this, { icon: 'wave', text: 'LAST STAND · VETERAN', tone: 'gold', size: 18 }) : null;
      if (next) centreRow([next], VIEW.centerX, VIEW.height - 118);
      pushButton(this, VIEW.centerX - 150, VIEW.height - 56, { w: 260, h: 56, size: 26, icon: 'radio', label: 'HQ', onClick: () => this.scene.start('HQ', { tab: 'endless' }) });
      pushButton(this, VIEW.centerX + 150, VIEW.height - 56, { w: 260, h: 56, size: 26, icon: 'map', label: 'MAP', key: 'ENTER', tone: 'go', onClick: () => this.scene.start('Map') });
      this.input.keyboard!.once('keydown-ENTER', () => this.scene.start('Map'));
    };
    this.time.delayedCall(end, finish);
    // Skip: the first click shows everything at once.
    this.input.once('pointerdown', () => {
      // A tween still waiting on its delay does not jump to its end value, so set it directly.
      this.tweens.killTweensOf(texts);
      for (const t of texts) t.setAlpha(1);
      finish();
    });
  }
}
