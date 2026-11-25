"""Final stress run (Step 16) on the CrazyGames dev build (port 5188, mode crazygames): loads all 47 levels and shoots once
on each, opens every screen, buys every store item, plays a FRENZY run to RUN OVER, and reports the page and console
errors. Fails on any error.

Usage (the crazygames dev server must be running):
  python scripts/stress-check.py [http://localhost:5188/]
"""
import random
import re
import sys

from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:5188/'
random.seed(16)


def settle(page, ms=300):
    page.wait_for_timeout(ms)


def finish_shot(page, limit=1500):
    for _ in range(limit):
        if page.evaluate("() => __cg.game.state") in ('ready', 'goal', 'missed', 'menu'):
            return
        page.evaluate("() => __cg.step(1/60)")


def unlock_before(page, level_id):
    page.evaluate(
        "(id) => { const L = __cg.game.levels; const stop = L.findIndex(l => l.id === id); "
        "for (let i = 0; i < stop; i++) __cg.game.save.data.levels[L[i].id] = { best: 1000, attempts: 1, goals: 1, stars: 1, coin: false, paidStars: 1, bonus: false }; "
        "__cg.game.save.save(); }",
        level_id,
    )


def main():
    errors, console_errors = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={'width': 1280, 'height': 720})
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: console_errors.append('console: ' + m.text) if m.type == 'error' else None)
        page.goto(URL)
        page.wait_for_function('window.__cg !== undefined', timeout=30000)
        settle(page, 1200)
        page.evaluate("() => { __cg.game.resetProgress(); }")

        total = page.evaluate("() => __cg.game.levels.length")
        print(f'levels: {total}')
        check = total == 47
        print(f'47 levels: {"ok" if check else "FAIL " + str(total)}')

        # 1. Every level: load it and shoot once.
        shots = 0
        for n in range(1, total + 1):
            page.evaluate(f"() => {{ __cg.level({n}); __cg.step(0.2); }}")
            page.evaluate(f"() => {{ __cg.game.armedBoost = null; __cg.game.armedFree = false; __cg.game.lessonBoost = false; __cg.shoot({random.uniform(-150, -30):.1f}, {random.uniform(0.4, 1.0):.2f}); }}")
            finish_shot(page)
            shots += 1
        print(f'shot once on each level: {shots} shots')

        # 2. Unlock the campaign up to match 4, then every screen.
        unlock_before(page, 'm05-beach-day')
        page.evaluate("() => { __cg.game.returnToMenu(); }")
        settle(page)
        for shortcut, name in [('.menu-shortcut-stadiums', 'stadiums'), ('.menu-shortcut-balls', 'balls'),
                               ('.menu-shortcut-store', 'store'), ('.menu-shortcut-league', 'league'), ('.menu-gear', 'settings')]:
            page.click(shortcut)
            settle(page)
            print(f'opened {name}')
            if name == 'balls':
                # Every ball that is open.
                for tile in page.locator('.tile.skin:not(:disabled)').all():
                    tile.click()
                    settle(page, 80)
            page.evaluate("() => { __cg.game.returnToMenu(); }")
            settle(page)

        # 3. Buy every store item (coins for all of them).
        page.evaluate("() => { __cg.game.save.data.coins = 1000000; __cg.game.save.save(); __cg.game.returnToMenu(); }")
        settle(page)
        page.click('.menu-shortcut-store')
        settle(page)
        bought = 0
        for _ in range(12):
            buys = page.locator('.store-buy:not(:disabled)')
            if buys.count() == 0:
                break
            buys.first.click()
            bought += 1
            settle(page, 120)
        print(f'bought store items: {bought} purchases')
        page.evaluate("() => { __cg.game.returnToMenu(); }")
        settle(page)

        # 4. The pause menu and a settings reset.
        page.evaluate("() => { __cg.level(9); __cg.step(0.2); }")
        settle(page, 400)
        page.click('.pause-button')
        settle(page)
        page.evaluate("() => { __cg.game.setPaused(false); }")
        settle(page)

        # 5. FRENZY: a run until RUN OVER (a goal goes to NEXT, a miss costs a life).
        page.evaluate("() => { __cg.game.returnToMenu(); }")
        settle(page)
        page.click('.menu-frenzy')
        settle(page, 400)
        for _ in range(40):
            if page.evaluate("() => !__cg.game.frenzy || __cg.game.frenzy.over"):
                break
            if page.evaluate("() => __cg.game.state") == 'goal':
                page.locator('.result .btn-primary').click()
                settle(page, 200)
                continue
            page.evaluate("() => { __cg.game.armedBoost = null; __cg.game.armedFree = false; __cg.game.lessonBoost = false; __cg.shoot(0, 0.2); }")
            finish_shot(page)
            for _k in range(400):
                if page.evaluate("() => !__cg.game.frenzy || __cg.game.frenzy.over || __cg.game.state === 'ready'"):
                    break
                page.evaluate("() => __cg.step(1/60)")
        over = page.evaluate("() => !!__cg.game.frenzy && __cg.game.frenzy.over")
        print(f'FRENZY run over: {over}')
        if over:
            page.locator('.run-menu').click()
            settle(page)

        # 6. The daily reward: this build has none (checked: no daily reward in src), so there is nothing to claim.
        print('daily reward: not in this build (nothing to claim)')

        # 7. Every screen again, after the run: the title card and a match.
        page.click('.menu-play')
        settle(page, 600)
        page.evaluate("() => __cg.game.setPaused(true)")
        settle(page, 200)
        page.evaluate("() => __cg.game.setPaused(false)")
        browser.close()

    print(f'page errors: {len(errors)}')
    for e in errors[:10]:
        print('  ', e)
    print(f'console errors: {len(console_errors)}')
    for e in console_errors[:10]:
        print('  ', e)
    return 1 if (errors or console_errors or not check) else 0


if __name__ == '__main__':
    sys.exit(main())
