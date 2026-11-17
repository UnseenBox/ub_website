# SLIPSHOT: physics prototype

A one-input slime-launcher prototype. Articulated ragdolls, slime that changes
friction through the physics engine, and a short wave loop with upgrades.

## Run it

```bash
cd slipshot
npm install
npm run dev        # http://localhost:5173 (or the port you pass with -- --port)
npm run build      # type-check and production build
```

## Controls

One pointer, same code path for mouse and touch (Pointer Events):

1. Press and hold anywhere on the game area.
2. Drag backwards. The arm and the dashed trajectory show the aim.
3. Drag length sets the power. Release to fire.

## What is in the prototype

- **Ragdolls** (`src/physics/rig.ts`, `Ragdoll.ts`): 13 Planck bodies per character
  (head, torso, pelvis, two thighs, two shins, two feet, two upper arms, two
  forearms), connected by revolute joints with angle limits and capped motor torque.
  The player and enemies use the same rig, with limits mirrored for facing.
- **Balance**: each joint runs a velocity servo toward a target angle. Balance is
  an ankle strategy: the legs lean so the centre of mass moves back over the feet.
  Stagger and lying weaken the joints, then they recover as the torso rises.
- **Projectiles** (`Projectile.ts`): dynamic bullet bodies (continuous collision),
  with a shooter's own parts sharing its negative collision group so it cannot hit
  itself.
- **Slime** (`SlimeSystem.ts`, `friction.ts`): a pre-solve hook sets
  `Contact.setFriction()` on any contact with a coated character, coated object, or
  puddle. Puddles are real fixtures on the terrain body and are removed cleanly when
  they expire.
- **Combat** (`game/Combat.ts`): projectile damage scales with approach speed and
  body part. Body impacts do damage only above a closing-speed threshold, so landing
  a fall hurts and resting contact does not.
- **Enemy AI** (`ai/EnemyAI.ts`, `ai/ballistics.ts`): tracks the player with its
  front arm, solves a low-arc shot with the same integrator as the aim preview,
  then fires after a windup. Aim noise and reload shrink as the waves go on.
- **Progression** (`game/Progression.ts`): a KO scores points. A cleared wave opens
  the upgrade screen: POWER (launch speed), SPLAT SIZE (impact radius) and DURATION
  (slime and puddle lifetime). Waves grow from one enemy to three.
- **Rendering** (`render/`): Canvas 2D with a y-up world transform, interpolated
  between fixed physics steps. Pooled droplets and floating numbers. Camera framing
  that keeps the player, living enemies and the slime in view, plus trauma shake.

## Known limitations

- **Falls are harder to recover from than they should be.** A light stumble
  recovers. A heavy hit, or a slime slip that drops a character, usually leaves it
  down. There is no stepping or get-up sequence yet, so a fully flat character
  stays flat. The player can still shoot from the ground; the enemy AI only fires
  from a standing pose.
- Portrait phones show a small arena. Landscape is much better.
- No audio.
- Planck 1.5.1 declares Node 24 or later. It runs on Node 22 with an install warning.
