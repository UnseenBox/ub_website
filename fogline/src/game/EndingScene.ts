import Phaser from 'phaser';
import { audio } from '../audio/AudioManager';
import { starTotals } from '../systems/Campaign';
import { profile } from '../systems/Profile';
import { endlessOpen } from '../systems/Retention';
import { MONO, STENCIL, button } from '../ui/widgets';
import { VIEW } from './config';

type Line = { who?: string; text: string };

export interface EndingData {
  /** The act just finished: 3 (the Heart) leads into Act 4; 4 (the Bloom) is the last word. */
  act?: number;
}

/** After the Heart: the valley is free, and a haze appears up the coast. */
const ACT3_LINES: Line[] = [
  { text: 'The Heart stopped at 04:12. By sunrise the fog had drawn back off Harlow Valley for the first time in six weeks.' },
  { who: 'HALE', text: 'Every bunker on the Fogline is reporting clear skies. We held, Warden. Then we pushed. Then we won.' },
  { who: 'VARGA', text: 'I will testify. Everything we did at Meridian goes on the record, and every name it took goes on the memorial.' },
  { who: 'DOT', text: 'I am keeping the railgun. For research.' },
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
  { who: 'HALE', text: 'Warden: thank you. Every one of them got home because you held.' },
];

export class EndingScene extends Phaser.Scene {
  constructor() {
    super('Ending');
  }

  create(data: EndingData = {}): void {
    const finalAct = (data.act ?? 3) >= 4;
    const LINES = finalAct ? ACT4_LINES : ACT3_LINES;
    this.input.setDefaultCursor('default');
    this.add.rectangle(0, 0, VIEW.width, VIEW.height, 0x0a0b09).setOrigin(0);
    // A pale dawn rising behind the text.
    const dawn = this.add.rectangle(0, VIEW.height, VIEW.width, VIEW.height, 0xd8c090, 0.0).setOrigin(0, 1);
    this.tweens.add({ targets: dawn, fillAlpha: 0.12, duration: 9000 });
    this.add.text(VIEW.centerX, 70, finalAct ? 'CLEAR SKIES' : 'THE FOG LIFTS', { fontFamily: STENCIL, fontSize: '56px', color: '#e8e0c0', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
    const p = profile.get();
    const stars = starTotals(p);
    this.add.text(VIEW.centerX, 118, finalAct ? `CAMPAIGN COMPLETE  ·  ★ ${stars.earned}/${stars.total}` : `ACT 3 COMPLETE  ·  ★ ${stars.earned}/${stars.total}`, { fontFamily: MONO, fontSize: '15px', color: '#e8c060' }).setOrigin(0.5);

    let y = 170;
    const texts: Phaser.GameObjects.Text[] = [];
    LINES.forEach((l, i) => {
      const t = this.add.text(VIEW.centerX, y, l.who ? `${l.who}: ${l.text}` : l.text, {
        fontFamily: MONO, fontSize: '16px', color: l.who ? '#d0ccb4' : '#a8b8a0', align: 'center', wordWrap: { width: 900 }, lineSpacing: 4,
      }).setOrigin(0.5, 0).setAlpha(0);
      y += t.height + 16;
      texts.push(t);
      this.tweens.add({ targets: t, alpha: 1, duration: 900, delay: 600 + i * 1700 });
    });
    const end = 600 + LINES.length * 1700;
    let shown = false;
    const finish = (): void => {
      if (shown) return;
      shown = true;
      audio.play('wave_clear', { volume: 0.6, rate: 0.8 });
      const hook = !finalAct
        ? 'ACT 4 — THE FOG RETURNS waits on the map, once you have the stars for it.'
        : endlessOpen(p) ? 'LAST STAND and Veteran missions are waiting: see how long the line holds.' : '';
      if (hook) this.add.text(VIEW.centerX, VIEW.height - 130, hook, { fontFamily: MONO, fontSize: '15px', color: '#e8c060' }).setOrigin(0.5);
      button(this, VIEW.centerX - 170, VIEW.height - 70, 300, 50, 'TO THE HQ', () => this.scene.start('HQ', { tab: 'endless' }), 10, 0x5fae3c);
      button(this, VIEW.centerX + 170, VIEW.height - 70, 300, 50, 'VALLEY MAP  [ENTER]', () => this.scene.start('Map'), 10, 0xc8a040);
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
