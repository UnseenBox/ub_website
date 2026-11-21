import { WeaponDef, WeaponViewModel } from '../data/weapons';
import { VIEW } from '../game/config';

/** Fully resolved view-model tuning (a weapon's overrides applied to the defaults). */
export type ResolvedViewModel = Required<WeaponViewModel>;

/** Matching geometry for the procedural 300×400 view models. */
export const DEFAULT_VIEW_MODEL: ResolvedViewModel = {
  pivotX: VIEW.centerX + 150,
  pivotY: 792,
  scale: 1.22,
  muzzleX: 150,
  muzzleY: 8,
  ejectX: 183,
  ejectY: 210,
  aimX: 0.36,
  aimY: 0.06,
  maxRot: 1,
  sway: 1,
  reloadTilt: 1,
  // Drop far enough to fully clear the view during weapon switches.
  switchDrop: 760,
  muzzleLock: false,
  muzzleLockX: 0,
  muzzleLockY: 0,
  barrelAlign: false,
  tailX: 150,
  tailY: 400,
  anchorX: VIEW.centerX + 150,
  anchorY: 792,
  muzzleGap: 70,
};

export function resolveViewModel(def: WeaponDef): ResolvedViewModel {
  return { ...DEFAULT_VIEW_MODEL, ...def.viewModel };
}

export interface ViewModelPoseInput {
  model: ResolvedViewModel;
  /** Source texture size in pixels. */
  textureWidth: number;
  textureHeight: number;
  /** Raw mouse aim that the gun rotates toward. */
  aimX: number;
  aimY: number;
  /** Crosshair position in screen space. */
  cursorX: number;
  cursorY: number;
  kick: number;
  kickRot: number;
  tilt: number;
  dropY: number;
  swayX: number;
  swayY: number;
}

export interface ViewModelPose {
  pivotX: number;
  pivotY: number;
  rotation: number;
  scale: number;
  muzzleX: number;
  muzzleY: number;
  ejectX: number;
  ejectY: number;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/**
 * Work out where the view-model texture, muzzle and ejection port go.
 *
 * The default models pivot from a low stock point and follow only a fraction of
 * the aim. Models with `muzzleLock` instead solve the pivot so the muzzle stays
 * near the crosshair. With `barrelAlign` the barrel axis is also rotated to
 * point at the crosshair, so the gun visibly aims where the shots land.
 */
export function computeViewModelPose(input: ViewModelPoseInput): ViewModelPose {
  const { model, textureWidth, textureHeight } = input;
  const scale = model.scale + input.kick * 0.002;
  const gx = clamp(input.aimX, 0, VIEW.width);
  const gy = clamp(input.aimY, 0, VIEW.hudTop);
  const baseRot = clamp(
    Math.atan2(gx - model.pivotX, model.pivotY - gy),
    -model.maxRot,
    model.maxRot,
  );
  let baseRotation = baseRot;
  let lockTargetX = 0;
  let lockTargetY = 0;
  if (model.muzzleLock && model.barrelAlign) {
    // Aim the barrel axis straight at the crosshair. The aim line comes from a
    // distant anchor far below the screen (so the gun only turns a little as the
    // crosshair sweeps across the view). The muzzle sits on that line short of the
    // crosshair, as close as `muzzleGap` but pushed back as far as needed to keep
    // the stock and arms anchored near the bottom of the screen.
    const cx = clamp(input.cursorX, 0, VIEW.width);
    const cy = clamp(input.cursorY, 0, VIEW.hudTop);
    let ux = cx - model.anchorX;
    let uy = cy - model.anchorY;
    const len = Math.hypot(ux, uy) || 1;
    ux /= len;
    uy /= len;
    // Angle of a direction measured clockwise from "up" (screen y points down).
    const aimAngle = Math.atan2(ux, -uy);
    const axisAngle = Math.atan2(model.muzzleX - model.tailX, -(model.muzzleY - model.tailY));
    baseRotation = aimAngle - axisAngle;
    const cosR = Math.cos(baseRotation);
    const sinR = Math.sin(baseRotation);
    const lmx = (model.muzzleX - textureWidth / 2) * scale;
    const lmy = (model.muzzleY - textureHeight) * scale;
    const rotMuzzleY = lmx * sinR + lmy * cosR;
    const restY = model.pivotY + (cy - 300) * model.aimY;
    const upward = Math.max(0.2, -uy);
    const gap = Math.max(model.muzzleGap, (restY + rotMuzzleY - cy) / upward);
    lockTargetX = cx - ux * gap;
    lockTargetY = cy - uy * gap;
  }
  const rotation = baseRotation + input.tilt + input.kickRot;

  const halfW = textureWidth / 2;
  const localMuzzleX = (model.muzzleX - halfW) * scale;
  const localMuzzleY = (model.muzzleY - textureHeight) * scale;

  let pivotX: number;
  let pivotY: number;
  if (model.muzzleLock) {
    const rot = model.barrelAlign ? baseRotation : baseRot;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const rotatedX = localMuzzleX * cos - localMuzzleY * sin;
    const rotatedY = localMuzzleX * sin + localMuzzleY * cos;
    const targetX = model.barrelAlign ? lockTargetX : clamp(input.cursorX, 0, VIEW.width) + model.muzzleLockX;
    const targetY = model.barrelAlign ? lockTargetY : clamp(input.cursorY, 0, VIEW.hudTop) + model.muzzleLockY;
    pivotX = targetX - rotatedX + input.swayX;
    pivotY = targetY - rotatedY + input.kick + input.dropY + input.swayY;
  } else {
    pivotX = model.pivotX + (gx - VIEW.centerX) * model.aimX + input.swayX;
    pivotY = model.pivotY + (gy - 300) * model.aimY + input.kick + input.dropY + input.swayY;
  }

  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const muzzleX = pivotX + localMuzzleX * cos - localMuzzleY * sin;
  const muzzleY = pivotY + localMuzzleX * sin + localMuzzleY * cos;
  const localEjectX = (model.ejectX - halfW) * scale;
  const localEjectY = (model.ejectY - textureHeight) * scale;
  const ejectX = pivotX + localEjectX * cos - localEjectY * sin;
  const ejectY = pivotY + localEjectX * sin + localEjectY * cos;

  return { pivotX, pivotY, rotation, scale, muzzleX, muzzleY, ejectX, ejectY };
}
