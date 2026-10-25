import { expect, it } from 'vitest';
import { DISCOVERIES } from './Discoveries';

it('has 166 discoveries with unique ids', () => {
  expect(DISCOVERIES).toHaveLength(166);
  expect(new Set(DISCOVERIES.map((d) => d.id)).size).toBe(166);
});

it('keeps both trip hazards, one gadget and one style', () => {
  const gadget = DISCOVERIES.find((d) => d.id === 'trip_hazard')!;
  const hamster = DISCOVERIES.find((d) => d.id === 'hamster_trip')!;
  expect(gadget.group).toBe('gadget');
  expect(gadget.recipe).toContain('ROBOT HOOVER');
  expect(hamster.group).toBe('style');
  expect(hamster.title).toBe('HAMSTER TRIP');
  expect(hamster.recipe).toContain('STEPS ON THE HAMSTER BALL');
});
