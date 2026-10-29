import type { Game } from '../../core/Game';

/** Tiny store screen: pet outfits + bite boost, no edge confusion. */
export function buildStore(game: Game) {
  const s = document.createElement('section');
  s.className = 'b2-panel b2-store';
  s.innerHTML = `<h2>SHOP — PET OUTFITS</h2>
    <div class="store-row">
      <button onclick="window.__storeBuy('dog_bandana',20)">Dog Bandana (#c23b2e) — 20 scrap</button>
      <button onclick="window.__storeBuy('cat_bow','#e8b13c')">Cat Bow (#e8b13c) — 20 scrap</button>
      <button onclick="window.__storeBuy('hamster_hat','#4a5c3a')">Hamster Hat (#4a5c3a) — 20 scrap</button>
    </div>
    <p>Bite boost available after 3 bosses cleared.</p>`;
  (window as unknown as Record<string, unknown>).__storeBuy = (id: string, cost: number) => {
    const pet = game.pet;
    if (!pet || pet.outfits.has(id)) return;
    if (game.save.data.scrap < cost) { alert('Need scrap'); return; }
    game.save.data.scrap -= cost;
    pet.outfitTag = id;
    pet.outfits.add(id);
    game.save.write();
    s.innerHTML += `<p>Bought ${id}</p>`;
  };
  return s;
}
