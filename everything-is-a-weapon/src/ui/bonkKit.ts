import menuSceneUrl from '../assets/menu-scene.svg?url';
import cursorHandUrl from '../ui-kit/cursor/hand.svg?url';
import cursorGrabUrl from '../ui-kit/cursor/grab.svg?url';
import cursorThrowUrl from '../ui-kit/cursor/throw.svg?url';
import panUrl from '../ui-kit/bonk-ui/shop/pan.svg?url';
import slipperUrl from '../ui-kit/bonk-ui/shop/slipper.svg?url';
import pillowUrl from '../ui-kit/bonk-ui/shop/pillow.svg?url';
import toyHammerUrl from '../ui-kit/bonk-ui/shop/toy-hammer.svg?url';
import broomUrl from '../ui-kit/bonk-ui/shop/broom.svg?url';
import vacuumUrl from '../ui-kit/bonk-ui/shop/vacuum.svg?url';
import starEarnedUrl from '../ui-kit/bonk-ui/icons/star-earned.svg?url';
import starEmptyUrl from '../ui-kit/bonk-ui/icons/star-empty.svg?url';

/**
 * The kit's additive UI: the living-room scene, credits, the hand cursor, and the
 * small amount of wiring the static screens need (arsenal cards, tab state, real
 * star art, map opening, result button art and the volume fill). The screens are
 * rebuilt constantly by the game, so everything is kept in sync with observers
 * rather than by rebuilding the game's menus.
 */

const ARSENAL: ReadonlyArray<readonly [string, string]> = [
  ['PAN', panUrl],
  ['SLIPPER', slipperUrl],
  ['PILLOW', pillowUrl],
  ['TOY HAMMER', toyHammerUrl],
  ['BROOM', broomUrl],
  ['VACUUM', vacuumUrl],
];

/** The credits card lives outside #screens, so it only needs wiring once. */
function installCredits(): void {
  const button = document.getElementById('menu-credits-btn');
  const panel = document.getElementById('menu-credits-panel');
  const close = document.getElementById('menu-credits-close');
  if (!button || !panel) return;

  const open = (): void => {
    panel.hidden = false;
    close?.focus();
  };
  const shut = (): void => {
    panel.hidden = true;
    button.focus();
  };

  button.addEventListener('click', open);
  close?.addEventListener('click', shut);
  panel.addEventListener('click', (event) => {
    if (event.target === panel) shut();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) shut();
  });
}

/** The hand-drawn room behind the menu, with a little pointer parallax. */
function installMenuScene(screens: HTMLElement): void {
  const build = (): HTMLElement => {
    const scene = document.createElement('div');
    scene.id = 'bonk-menu-scene';
    scene.setAttribute('aria-hidden', 'true');
    const image = document.createElement('img');
    image.className = 'scene-bg';
    image.src = menuSceneUrl;
    image.alt = '';
    scene.append(image);
    return scene;
  };

  const sync = (): void => {
    const screen = screens.querySelector<HTMLElement>('.screen.menu-board');
    const scene = screens.querySelector<HTMLElement>('#bonk-menu-scene');
    if (!screen) {
      scene?.remove();
      return;
    }
    if (!scene) {
      screen.prepend(build());
    } else if (screen.firstElementChild !== scene) {
      screen.prepend(scene);
    }
  };

  new MutationObserver(sync).observe(screens, { childList: true });
  sync();

  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  if (reduce) return;

  let px = 0;
  let py = 0;
  let tx = 0;
  let ty = 0;
  let running = false;

  const tick = (): void => {
    px += (tx - px) * 0.075;
    py += (ty - py) * 0.075;
    const background = document.querySelector<HTMLElement>('#bonk-menu-scene .scene-bg');
    if (background) {
      background.style.transform =
        `scale(1.06) translate3d(${(-px * 16).toFixed(2)}px,${(-py * 12).toFixed(2)}px,0)`;
    }
    if (Math.abs(tx - px) > 0.0015 || Math.abs(ty - py) > 0.0015) {
      requestAnimationFrame(tick);
    } else {
      running = false;
    }
  };

  document.addEventListener('mousemove', (event) => {
    if (!document.querySelector('#bonk-menu-scene')) return;
    tx = event.clientX / window.innerWidth - 0.5;
    ty = event.clientY / window.innerHeight - 0.5;
    if (!running) {
      running = true;
      requestAnimationFrame(tick);
    }
  }, { passive: true });
}

type CursorState = 'open' | 'grab' | 'throw';

/** A hand cursor for the playspace; menus and touch devices keep the native cursor. */
function installCursor(): void {
  if (window.matchMedia && !window.matchMedia('(pointer: fine)').matches) return;

  const cursor = document.getElementById('game-cursor');
  const image = document.getElementById('game-cursor-img');
  if (!cursor || !(image instanceof HTMLImageElement)) return;

  const sources: Record<CursorState, string> = {
    open: cursorHandUrl,
    grab: cursorGrabUrl,
    throw: cursorThrowUrl,
  };

  const HOT_X = 32;
  const HOT_Y = 30;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  let state: CursorState = 'open';
  let tx = 0;
  let ty = 0;
  let x = 0;
  let y = 0;
  let lastX = 0;
  let tilt = 0;
  let tiltTarget = 0;
  let scale = 1;
  let scaleTarget = 1;
  let holding = false;
  let holdStart = 0;
  let shown = false;
  let overUi = false;

  image.src = sources.open;

  const setState = (next: CursorState): void => {
    if (state === next) return;
    state = next;
    image.src = sources[next];
  };

  const inGame = (): boolean => document.body.classList.contains('playing');

  const show = (): void => {
    if (!inGame() || shown) return;
    shown = true;
    cursor.classList.add('is-visible');
  };

  const hide = (): void => {
    if (!shown) return;
    shown = false;
    cursor.classList.remove('is-visible');
  };

  const onUi = (target: EventTarget | null): boolean =>
    target instanceof Element &&
    !!target.closest('button, a, input, select, textarea, label, summary, .btn, .hud-pause, .mk-gear');

  document.addEventListener('mousemove', (event) => {
    tx = event.clientX;
    ty = event.clientY;
    overUi = onUi(event.target);
    if (!shown) {
      x = tx;
      y = ty;
    }
    if (overUi || !inGame()) hide();
    else show();
  }, { passive: true, capture: true });

  document.addEventListener('pointerdown', (event) => {
    if (onUi(event.target)) return;
    holding = true;
    holdStart = performance.now();
    setState('grab');
    scaleTarget = 0.9;
    cursor.classList.remove('is-charging');
    window.setTimeout(() => {
      if (holding) scaleTarget = 1;
    }, 120);
  }, true);

  document.addEventListener('pointerup', () => {
    if (!holding) return;
    holding = false;
    const held = (performance.now() - holdStart) / 1000;
    cursor.classList.remove('is-charging');
    setState('throw');
    scaleTarget = 1.12;
    window.setTimeout(() => {
      setState('open');
      scaleTarget = 1;
    }, held > 0.25 ? 260 : 175);
  }, true);

  document.addEventListener('mouseleave', hide);
  window.addEventListener('blur', hide);

  const frame = (now: number): void => {
    const t = now / 1000;
    const ease = reduce ? 1 : 0.34;
    x += (tx - x) * ease;
    y += (ty - y) * ease;

    const vx = tx - lastX;
    lastX = tx;
    const lean = Math.max(-12, Math.min(12, vx * 0.5));
    tiltTarget += (lean - tiltTarget) * 0.14;
    tilt = tiltTarget;

    scale += (scaleTarget - scale) * 0.28;
    let s = scale;
    if (!reduce) {
      if (holding) {
        const dt = (now - holdStart) / 1000;
        s *= 1 + Math.sin(dt * 13) * 0.035;
        if (dt > 0.16) cursor.classList.add('is-charging');
      } else {
        s *= 1 + Math.sin(t * 2.2) * 0.012;
      }
    }

    if (!inGame()) {
      if (holding) {
        holding = false;
        cursor.classList.remove('is-charging');
        setState('open');
        scaleTarget = 1;
      }
      if (shown) hide();
    }

    cursor.style.transform = `translate3d(${x - HOT_X}px,${y - HOT_Y}px,0)`;
    image.style.transform = `rotate(${tilt.toFixed(2)}deg) scale(${s.toFixed(3)})`;

    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** The menu's play-style row, the settings tabs and the six-card arsenal. */
function installCandy(screens: HTMLElement): void {
  let wantShop = false;

  const gear = (): HTMLElement | null => screens.querySelector<HTMLElement>('.screen.menu-board .mk-gear');

  const menuRow = (): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'candy-menu-row';
    row.innerHTML =
      '<button type="button" class="candy-btn candy-blue" data-candy="mode"><span class="candy-ico">\u2605</span>MODE</button>' +
      '<button type="button" class="candy-btn candy-orange" data-candy="shop"><span class="candy-ico">\u25C6</span>SHOP</button>' +
      '<button type="button" class="candy-btn candy-purple" data-candy="settings"><span class="candy-ico">\u2699</span>SETTINGS</button>';
    return row;
  };

  const shopPanel = (): HTMLElement => {
    const shop = document.createElement('div');
    shop.className = 'candy-shop kit-arsenal';
    shop.hidden = true;
    for (const [name, url] of ARSENAL) {
      const card = document.createElement('div');
      card.className = 'candy-item';
      const image = document.createElement('img');
      image.className = 'kit-shop-card';
      image.src = url;
      image.alt = name;
      card.append(image);
      shop.append(card);
    }
    const note = document.createElement('div');
    note.className = 'kit-shop-note';
    note.textContent = 'EVERYTHING IS A WEAPON';
    shop.append(note);
    return shop;
  };

  const tabBar = (): HTMLElement => {
    const bar = document.createElement('div');
    bar.className = 'candy-tabs';
    bar.innerHTML =
      '<button type="button" class="candy-tab on" data-tab="settings">SETTINGS</button>' +
      '<button type="button" class="candy-tab" data-tab="shop">SHOP</button>';
    return bar;
  };

  const setTab = (sheet: HTMLElement, want: 'settings' | 'shop'): void => {
    const shop = sheet.querySelector<HTMLElement>('.candy-shop');
    const tabs = sheet.querySelectorAll<HTMLElement>('.candy-tab');
    sheet.classList.toggle('tab-shop', want === 'shop');
    if (shop) shop.hidden = want !== 'shop';
    for (const tab of tabs) tab.classList.toggle('on', tab.dataset.tab === want);
  };

  screens.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLElement>('.candy-btn[data-candy]');
    if (!button) return;
    const what = button.dataset.candy;
    if (what === 'mode') {
      screens.querySelector<HTMLElement>('.screen.menu-board .rm-mapbtn')?.click();
    } else if (what === 'shop') {
      wantShop = true;
      gear()?.click();
    } else {
      wantShop = false;
      gear()?.click();
    }
  });

  const syncMenu = (): void => {
    const action = screens.querySelector<HTMLElement>('.screen.menu-board .rm-action');
    if (action && !action.querySelector('.candy-menu-row')) action.append(menuRow());
  };

  const syncSettings = (): void => {
    const pane = screens.querySelector<HTMLElement>('.screen.settings');
    const sheet = pane?.querySelector<HTMLElement>('.sheet');
    if (!pane || !sheet) return;

    if (!sheet.querySelector('.candy-tabs')) {
      const bar = tabBar();
      sheet.insertBefore(bar, sheet.firstChild);
      sheet.append(shopPanel());
      bar.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const tab = target.closest<HTMLElement>('.candy-tab');
        if (tab?.dataset.tab === 'shop' || tab?.dataset.tab === 'settings') {
          setTab(sheet, tab.dataset.tab);
        }
      });
    }

    /* BACK and SHRED SAVE belong inside the card, not floating on the dimmed board. */
    let actions = sheet.querySelector<HTMLElement>('.candy-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'candy-actions';
      sheet.append(actions);
    }
    for (const child of Array.from(pane.children)) {
      if (child !== sheet && child.tagName === 'BUTTON') actions.append(child);
    }

    if (wantShop) {
      setTab(sheet, 'shop');
      wantShop = false;
    }
  };

  const sync = (): void => {
    syncMenu();
    syncSettings();
  };

  new MutationObserver(sync).observe(screens, { childList: true, subtree: true });
  sync();
}

/** Real kit star art, kit result buttons, the desktop map, and the volume fill. */
function installKitWiring(screens: HTMLElement): void {
  const paintStars = (root: HTMLElement): void => {
    for (const node of root.querySelectorAll<HTMLElement>('.rm-stars, .victory-stars')) {
      const text = node.textContent ?? '';
      if (!/[\u2605\u2606]/.test(text)) continue;
      if (node.getAttribute('data-kit-stars') === text) continue;
      node.setAttribute('data-kit-stars', text);

      const fragment = document.createDocumentFragment();
      let textBuffer = '';
      const flushText = (): void => {
        if (!textBuffer) return;
        const label = document.createElement('span');
        label.className = 'kit-star-label';
        label.textContent = textBuffer;
        fragment.append(label);
        textBuffer = '';
      };

      for (let i = 0; i < text.length; i++) {
        const character = text.charAt(i);
        if (character === '\u2605' || character === '\u2606') {
          flushText();
          const star = document.createElement('img');
          star.className = 'kit-star' + (character === '\u2606' ? ' is-empty' : '');
          star.src = character === '\u2605' ? starEarnedUrl : starEmptyUrl;
          star.alt = '';
          star.setAttribute('aria-hidden', 'true');
          fragment.append(star);
        } else {
          textBuffer += character;
        }
      }
      flushText();
      node.replaceChildren(fragment);
    }
  };

  const markResults = (root: HTMLElement): void => {
    for (const button of root.querySelectorAll<HTMLButtonElement>('.screen.results .menu-buttons .btn')) {
      const label = (button.textContent ?? '').toUpperCase();
      let kind = '';
      if (label.includes('NEXT')) kind = 'next';
      else if (label.includes('REPLAY')) kind = 'replay';
      else if (label.includes('RETRY')) kind = 'retry';
      else if (label.includes('HOME')) kind = 'quit';
      if (kind && button.getAttribute('data-kit') !== kind) button.setAttribute('data-kit', kind);
    }
  };

  const openMapOnce = (): void => {
    const rail = screens.querySelector<HTMLElement>('.screen.menu-board .rm-map');
    const button = screens.querySelector<HTMLButtonElement>('.screen.menu-board .rm-mapbtn');
    if (!rail || !button || rail.getAttribute('data-kit-auto')) return;
    rail.setAttribute('data-kit-auto', '1');
    if (window.innerWidth > 900 && window.innerHeight > 680 && rail.hidden) button.click();
  };

  const bindVolume = (): void => {
    const slider = screens.querySelector<HTMLInputElement>('.screen.settings input[type="range"]');
    if (!slider || slider.getAttribute('data-kit-vol')) return;
    slider.setAttribute('data-kit-vol', '1');
    const update = (): void => slider.style.setProperty('--kit-vol', `${slider.value}%`);
    slider.addEventListener('input', update);
    update();
  };

  const sync = (): void => {
    paintStars(screens);
    markResults(screens);
    openMapOnce();
    bindVolume();
  };

  new MutationObserver(sync).observe(screens, { childList: true, subtree: true });
  sync();
}

/** Installs the kit-only layers once the game's screens root exists. */
export function installBonkUi(screens: HTMLElement): void {
  installCredits();
  installMenuScene(screens);
  installCursor();
  installCandy(screens);
  installKitWiring(screens);
}
