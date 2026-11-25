"""UI overlap safety net (Step 15).

Visits every screen from every entry point at 360x640, 740x360 and 1280x720 and fails when:
  - an in-match control (kick dock, ability bar and its coin pill, pause button, coach card) is visible while an
    overlay screen is open; or
  - a visible button is covered by another element (document.elementFromPoint at the button's centre).

Usage (the dev server must be running):
  python scripts/ui-overlap-check.py [http://localhost:5184/]

Exit code 0 when every check passes, 1 otherwise.
"""
import re
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5184/'
SIZES = [(360, 640, '360x640'), (740, 360, '740x360'), (1280, 720, '1280x720')]
CONTROLS = ['.kick-dock', '.ability-bar', '.pause-button', '.guide-card']

AUDIT_JS = """(controls) => {
  const shown = (e) => {
    if (!e || e.closest('[hidden]')) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const overlayOpen = [...document.querySelectorAll('.screen')].some(shown);
  const bad = [];
  if (overlayOpen) {
    for (const sel of controls) {
      for (const e of document.querySelectorAll(sel)) {
        if (shown(e)) bad.push('control visible under an open screen: ' + sel);
      }
    }
  }
  for (const b of document.querySelectorAll('button')) {
    if (!shown(b) || b.disabled) continue;
    const r = b.getBoundingClientRect();
    if (r.right <= 0 || r.bottom <= 0 || r.left >= innerWidth || r.top >= innerHeight) continue;
    const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2));
    const cy = Math.min(innerHeight - 1, Math.max(0, r.top + r.height / 2));
    // A button scrolled out of its scroll box is clipped, not covered: only the part on show counts.
    let clipped = false;
    for (let a = b.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (!/(hidden|auto|scroll|clip)/.test(cs.overflowX + ' ' + cs.overflowY)) continue;
      const ar = a.getBoundingClientRect();
      if (cx < ar.left || cx > ar.right || cy < ar.top || cy > ar.bottom) { clipped = true; break; }
    }
    if (clipped) continue;
    const top = document.elementFromPoint(cx, cy);
    if (!top || !(b === top || b.contains(top))) {
      const who = top ? (typeof top.className === 'string' && top.className ? top.className : top.tagName) : 'nothing';
      bad.push('covered button "' + (b.textContent || b.className).trim().slice(0, 24) + '" by ' + who);
    }
  }
  return { overlayOpen, bad };
}"""

results = []


def audit(page, size, label):
    out = page.evaluate(AUDIT_JS, CONTROLS)
    ok = not out['bad']
    results.append((size, label, out['overlayOpen'], ok, out['bad']))
    status = 'ok  ' if ok else 'FAIL'
    print(f"{status} {size:<8} {label:<34} overlay={'open' if out['overlayOpen'] else 'closed':<6} {'; '.join(out['bad'][:3])}", flush=True)


def unlock_before(page, level_id):
    page.evaluate(
        "(id) => { const L = __cg.game.levels; const stop = L.findIndex(l => l.id === id); "
        "for (let i = 0; i < stop; i++) __cg.game.save.data.levels[L[i].id] = { best: 1000, attempts: 1, goals: 1, stars: 1, coin: false, paidStars: 1, bonus: false }; "
        "__cg.game.save.save(); }",
        level_id,
    )


def visible_button(page, pattern):
    return page.locator('.screen:not([hidden]) button').filter(has_text=re.compile(pattern, re.I)).first


def close_screen(page, pattern='BACK|CONTINUE|MENU|RESUME'):
    btn = visible_button(page, pattern)
    if btn.count() and btn.is_visible():
        btn.click()
        page.wait_for_timeout(250)
    else:
        page.evaluate("() => { __cg.game.returnToMenu(); }")
        page.wait_for_timeout(250)


def settle(page, ms=350):
    page.wait_for_timeout(ms)


def run(size_w, size_h, tag):
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={'width': size_w, 'height': size_h})
        page = ctx.new_page()
        page.goto(URL)
        page.wait_for_function('window.__cg !== undefined', timeout=30000)
        settle(page, 800)
        page.evaluate("() => { __cg.game.resetProgress(); }")
        unlock_before(page, 'm04-ice-rink')
        page.evaluate("() => { __cg.game.returnToMenu(); }")
        settle(page)

        # 1. The main menu, with the big FRENZY button shown.
        audit(page, tag, 'main menu')

        # 2. The stadiums, balls, store, league and settings screens, opened from the menu.
        for shortcut, name in [('.menu-shortcut-stadiums', 'stadiums'), ('.menu-shortcut-balls', 'balls'),
                               ('.menu-shortcut-store', 'store'), ('.menu-shortcut-league', 'league')]:
            page.click(shortcut)
            settle(page)
            audit(page, tag, f'{name} (from the menu)')
            close_screen(page)
        page.click('.menu-gear')
        settle(page)
        audit(page, tag, 'settings (from the menu)')
        close_screen(page)

        # 3. A match: the controls show, and no screen is over them.
        page.click('.menu-play')
        settle(page, 700)
        audit(page, tag, 'match, ready to aim')

        # 4. The pause menu, from the pause button.
        page.click('.pause-button')
        settle(page)
        audit(page, tag, 'pause menu (from the match)')
        close_screen(page, 'RESUME|BACK|CONTINUE')
        settle(page)
        audit(page, tag, 'match again, after resume')

        # 5. After a goal: the result card, with the controls hidden.
        level = page.evaluate("() => __cg.info().level")
        hits = page.evaluate(f"() => __cg.sweep({level}, 6, [0.8, 1], 0, {{ air: false, bend: 0 }})")
        if hits:
            h = hits[0]
            page.evaluate(f"() => {{ __cg.game.armedBoost = null; __cg.game.armedFree = false; __cg.game.lessonBoost = false; __cg.shoot({h['angle']}, {h['power']}); }}")
            for _ in range(900):
                if page.evaluate("() => __cg.game.state") == 'goal':
                    break
                page.evaluate("() => __cg.step(1/60)")
            for _ in range(200):
                if page.locator('.result .btn-primary').is_visible():
                    break
                settle(page, 50)
            audit(page, tag, 'after a goal (result card)')
            page.locator('.result .btn-primary').click()
            settle(page, 500)

        # 6. After a reset: the settings reset (two taps), back on the title card.
        page.evaluate("() => { __cg.game.returnToMenu(); }")
        settle(page)
        page.click('.menu-gear')
        settle(page)
        # Two taps: the first asks, the second erases (the button's own confirmation).
        page.evaluate("() => { const b = document.querySelector('.reset-button'); if (b) b.click(); }")
        settle(page, 200)
        page.evaluate("() => { const b = document.querySelector('.reset-button'); if (b) b.click(); }")
        settle(page, 400)
        close_screen(page)
        settle(page)
        audit(page, tag, 'after reset (title card)')

        # 7. After a world-complete panel: match 3's first clear (the boss of the first world).
        page.evaluate("() => { __cg.game.resetProgress(); }")
        unlock_before(page, 'match-03-pinball')
        page.evaluate("() => { __cg.game.returnToMenu(); }")
        settle(page)
        page.evaluate("() => { __cg.level(10); __cg.step(0.3); }")
        hits = page.evaluate("() => __cg.sweep(10, 6, [0.8, 1], 0, { air: false, bend: 0 })")
        if hits:
            h = hits[0]
            page.evaluate(f"() => {{ __cg.game.armedBoost = null; __cg.game.armedFree = false; __cg.game.lessonBoost = false; __cg.shoot({h['angle']}, {h['power']}); }}")
            for _ in range(900):
                if page.evaluate("() => __cg.game.state") == 'goal':
                    break
                page.evaluate("() => __cg.step(1/60)")
            for _ in range(300):
                if page.locator('.world-continue').is_visible():
                    break
                settle(page, 50)
            audit(page, tag, 'world complete panel')
            if page.locator('.world-continue').is_visible():
                page.locator('.world-continue').click()
                settle(page, 400)
            audit(page, tag, 'after the world panel (result card)')

        # 8. A FRENZY run's RUN OVER card (FRENZY opens once match 4 is cleared).
        unlock_before(page, 'm04-ice-rink')
        page.evaluate("() => { __cg.game.returnToMenu(); }")
        settle(page)
        if page.locator('.menu-frenzy').is_visible():
            page.click('.menu-frenzy')
            settle(page, 400)
            # Miss until the run is over; a shot that scores (a random match) goes to NEXT and the run goes on.
            for _ in range(12):
                if page.evaluate("() => !__cg.game.frenzy || __cg.game.frenzy.over"):
                    break
                if page.evaluate("() => __cg.game.state") == 'goal':
                    page.locator('.result .btn-primary').click()
                    settle(page, 200)
                    continue
                page.evaluate("() => { __cg.game.armedBoost = null; __cg.game.armedFree = false; __cg.game.lessonBoost = false; __cg.shoot(0, 0.2); }")
                for _k in range(900):
                    if page.evaluate("() => __cg.game.state") in ('missed', 'goal') or page.evaluate("() => !__cg.game.frenzy || __cg.game.frenzy.over"):
                        break
                    page.evaluate("() => __cg.step(1/60)")
                for _k in range(400):
                    if page.evaluate("() => !__cg.game.frenzy || __cg.game.frenzy.over || __cg.game.state === 'ready'"):
                        break
                    page.evaluate("() => __cg.step(1/60)")
            settle(page, 400)
            audit(page, tag, 'FRENZY run over')
        browser.close()


def main():
    for w, h, tag in SIZES:
        run(w, h, tag)
    failed = [r for r in results if not r[3]]
    print()
    print(f'{len(results) - len(failed)}/{len(results)} checks passed')
    for size, label, _open, _ok, bad in failed:
        print(f'  FAILED {size} {label}: {"; ".join(bad)}')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
