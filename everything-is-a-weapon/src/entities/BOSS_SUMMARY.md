# What Each of the 20 Bosses Does (Exactly)

Every fight = observe → learn → adapt → master. No shared template.

---

1. **Chairman** — FORM SHIFT (red/yellow/blue ring per form). Walks straight, slams floor (slam), throws paperball (hurl). After 3 hits announces "TANK!"/"CHOPPER!"/"ROBOT!" with different ring color, changes speed/slam/lunge. Death = chair folds flat, `FLAT-PACKED!`

2. **Flusher** — WHIRLPOOL + SLIP. Slow crawl, creates growing water zone on slam, leaves water floor (slip). Throws plunger. Must stay out of water + dodge plunger. Death = bowl cracks, drain sound

3. **Sofa Kraken** — HUG CONE. Slow crawl, tentacle lash in wide arc (0.9). Pulls objects toward it. Slam is backup. Must stay OUTSIDE cone. Death = tentacles detach, `DEFLATED!`

4. **Fridgezilla** — FROST SPREAD. Very slow crawl, freezes floor behind as it moves (`slick`). Throws frozen fish. Must not stand on frozen floor. Death = frost crack, blue spark burst

5. **Piano Spider** — SONIC BOOM. Fast crawl, slam creates shockwave that hits PLAYER (sound + damage). Landing = sonic ring. Must dodge slam area. Death = piano collapses, notes scatter, `OUT OF TUNE!`

6. **Mower Maniac** — LANE + TRAMPLE. Picks straight direction, revs, runs whole length (lunge 720, trample splinters). Must NOT be in lane. Death = engine seizes, smoke

7. **Mom** — DODGE + CONFISCATE + REARRANGE. Fast, sidesteps fast throws, catches slow (`dodges`), tidies arena (moves objects mid-fight `rearrange`), throws shoes back. 4 phases (3rd at 0.15, more gnats + bigger shockwave). Death = puts slipper down, `BEDTIME!`

8. **Vacuumasaurus** — INHALE + EAT. Slow crawl, sucks objects into itself (`sucks`), eats rival enemies (heals self +15), digests them. Must not stand near mouth. Death = unplugged, `EXTINCT!`

9. **Laundry Hydra** — THREE HEADS. Body slow, 3 heads lash independently (arc 0.9). After half health summons more heads (`summon: gnat`). Must watch all heads. Death = heads flop, water spray

10. **Fan-tastic** — CYCLONE + WIND. Hovers, swoops (lunge 560), seeds wind zones that push objects and steal throws (`wind_push`). Must avoid cyclones + dodge swoop. Death = blades stop, smoke

11. **Popcorn** — BLINK + AIMED THROW. Disappears (`teleports`), reappears near player, throws spraycan aimed at future position. Must track blink + dodge aimed throw. Death = microwave overheat, sparks

12. **Cable Kraken** — ZAP + LASH. Slow crawl, creates electric zone (`zaps`) that shocks player + other enemies. Lashes in cone. Must stay out of electric radius + dodge lash. Death = cable burns, final zap

13. **Pressure Cooker** — STEAM + SLAM. Slow crawl, slam creates steam zone (`spawnZone: steam`) that hurts + makes floor slippery. 4th phase at 0.15 (bigger shockwave). Must avoid steam + dodge slam. Death = steam release, `DEPRESSURIZED!`

14. **Midnight Express** — TRACK RUN. Picks lane, whistles (`alarm`), very long lunge (500 range, 800 speed, 0.9s). Must NOT be on track. Death = derails, smoke

15. **King of Junk** — ORBIT + WEEKLY HURL. Slow crawl, pulls furniture into orbit (`pull: 500`), then throws back (`plank`). Must dodge orbit + thrown pieces. Death = tower collapses, `JUNK REMOVED!`

16. **The House** — WALL THROW + SLAM. Very slow crawl, throws pieces of itself (`plank` hurl, range 500), slams (radius 160). Must stay away + dodge thrown planks. 4th phase at 0.15. Death = building collapses, `CONDemned`

17. **Time-Thief** — TIME RING. Slow crawl, creates time-freeze bubble (`stasis`: slow player to 0.25, reverse furniture velocity). Throws alarm clock. Must move before ring hits + dodge hurl. Death = clock stops, sparks

18. **Toybox Titan** — SPAWN ESCALATION. Slow crawl, summons toys (`gnat` → `mini` → `nested`) every 8s (escalates at 3rd spawn). Must kill toys + dodge slam. Death = crank breaks, stars

19. **Dishwasher Demon** — FLOOD + PLATE ROLL. Slow crawl, creates water puddles (`seeps`), throws plates down wet floor (rolls, slippery). Must not chase through water + dodge rolling plates. Death = drains, splash sound

20. **King of Cardboard** — 3 FORMS (tank/chopper/robot with red/yellow/blue ring). Crawls → swoops (1.7x speed, 320 lunge) → throws. Announces `TANK!`/`CHOPPER!`/`ROBOT!`. Must react instantly to form change. 4th phase at 0.15 (nested + shockwave). Death = all 3 collapse, `FLAT-PACKED!`

---

Every boss: unique star mechanic, no shared template. All existing sound/particle only. Self-damage guard (own furniture never hurts). Design doc + batch customization committed to `main`.
