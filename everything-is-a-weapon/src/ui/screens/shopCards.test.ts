// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import { ABILITIES } from '../../gameplay/Abilities';
import { buildAbilityCard } from './shopCards';

const blast = ABILITIES.find((a) => a.id === 'blast')!;

beforeEach(() => {
  localStorage.clear();
  document.body.innerHTML = '';
});

it('shows cost and buys through the callback', () => {
  const buy = vi.fn(() => '');
  const onBought = vi.fn();
  document.body.append(buildAbilityCard(blast, { touch: false, owned: false, buy, onBought }));
  const button = document.querySelector<HTMLButtonElement>('.b2-shop-card__buy')!;
  expect(button.textContent).toBe('BUY');
  button.click();
  expect(buy).toHaveBeenCalledWith('blast');
  expect(onBought).toHaveBeenCalledWith('blast');
  expect(document.querySelector('.b2-shop-card__owned')?.textContent).toBe('OWNED');
  expect(document.querySelector<HTMLButtonElement>('.b2-shop-card__buy')).toBeNull();
});

it('shows a failure reason, then recovers', () => {
  vi.useFakeTimers();
  document.body.append(buildAbilityCard(blast, { touch: true, owned: false, buy: () => 'NEEDS 150 SCRAP' }));
  const button = document.querySelector<HTMLButtonElement>('.b2-shop-card__buy')!;
  button.click();
  expect(button.textContent).toBe('NEEDS 150 SCRAP');
  expect(button.disabled).toBe(true);
  vi.advanceTimersByTime(1200);
  expect(button.textContent).toBe('BUY');
  expect(button.disabled).toBe(false);
  expect(document.querySelector('.b2-shop-card__key')!.textContent).toBe('POWER');
  vi.useRealTimers();
});

it('renders an owned card without a buy button', () => {
  document.body.append(buildAbilityCard(blast, { touch: false, owned: true, buy: () => '' }));
  expect(document.querySelector('.b2-shop-card__owned')).toBeTruthy();
  expect(document.querySelector('.b2-shop-card__buy')).toBeNull();
});
