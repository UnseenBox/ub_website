# Free Kicks playtest (roadmap T11)

The difficulty numbers are **modelled** (assumed aim error: mouse ±1.2° / ±3% power, touch ±2.5° / ±6%), never measured. This session replaces the assumption with real hands, mostly on phones held upright.

## Who
Five testers, a mix: three on phones in portrait (at least one narrow, 360 px or less), one on a tablet or laptop with a mouse, one who has never played Classic. Mixed skill is the point.

## Set-up (on the PC that holds the project)
```
node tools/free-kicks/playtest/serve.js --lan
```
Phones on the same Wi-Fi open the "on your Wi-Fi" address it prints (Windows may ask to allow it). The server shows only the playtest page and the game files, nothing else. Press Ctrl+C when the session is over. Without `--lan` it is reachable from this computer only.

## Session (about 20 minutes each)
1. Give the tester a name or number in the page, pick the language, say nothing about aiming. (The game shows its own three-step how-to-play card the first time it opens on a device; leave it to them, and note whether they read or skipped it. The ? button reopens it.)
2. They play THE SPOT → PRESSURE in order, retrying as they like, then QUICK FIVE three times.
3. Watch and write down (the log cannot see these): failed grabs of the ball, taps that missed a button, whether they read the hint, found AIR and the bend slider, understood the stars and PRACTICE, where they got frustrated or bored, how long each stage took.
4. Ask: which kick felt unfair? which felt too easy? did anything look broken or cut off?
5. They press **DOWNLOAD RESULTS** and send you the file.

## Reading the results
```
node tools/free-kicks/playtest/report.js ana.json bob.json carol.json
```
It lists, per stage, clear and star rates against the model, and per kick slot the observed make rate with a 95% interval. A `*` means 8+ tries and the model is outside the interval.

* Treat a flag as a lead, not proof: with about 60 slots a few will flag by luck. Act only when two or more testers agree and you saw it in person.
* Touch devices are compared with the touch odds, everything else with the mouse odds.
* Known from the model: stages 4 and 5 have the same touch odds (83 / 49 / 13 % for 3 / 4 / 5 goals), so stage 5 is not harder than stage 4 today.
* The log has outcomes only. It does not have power, angle or why a kick failed: that comes from watching.

## Physics changed after the metrics were made
The gameplay-polish pass added post/crossbar bounces, a bounded bend and an aerial leap for Mimi. `validate.js --check` now reports the stored metrics as stale, so the modelled odds in `cards.v1.metrics.json` (and this report's "model" column) describe the OLD rules until `validate.js` is re-run (heavy: ask first). On the shared test shots the new rules add ground goals (post rebounds that drop in, about +9%) and remove aerial ones (bar contact and the leap, about -15%).

## If a card needs changing
Edit `tools/free-kicks/cards.v1.json`, then `node tools/free-kicks/validate.js` (heavy: ask before running, it caps at 5 workers), `node tools/free-kicks/sync-cards.js`, `node tools/free-kicks/check-quick.js`, `node tools/free-kicks/check-strings.js`. Never tune on one tester.

## Privacy
The log holds your tester label, results, language and the device's browser string and screen size. It stays on the device until the tester sends the file.
