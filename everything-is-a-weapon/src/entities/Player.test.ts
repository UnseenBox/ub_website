import { expect, it } from 'vitest';
import { Player } from './Player';

it('defaults to five hearts', () => {
  const player = new Player(0, 0);
  expect(player.maxHp).toBe(5);
  expect(player.hp).toBe(5);
});

it('starts at the upgraded max and revives to it', () => {
  const player = new Player(0, 0, 7);
  expect(player.maxHp).toBe(7);
  expect(player.hp).toBe(7);
  player.hp = 1;
  player.revive();
  expect(player.hp).toBe(7);
});
