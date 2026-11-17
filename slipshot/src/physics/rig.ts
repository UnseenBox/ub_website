// Articulated stickman rig. Coordinates are in meters in the standing pose:
// feet touch y = 0, the character faces +x for facing = +1.
// Limbs are capsules (box + two end circles), the head is a circle, and each
// foot is a flat box joined to its shin by an ankle. `left`/`right` name the
// body sides; the front (aiming) arm is the one on the facing side.

export type PartName =
  | 'head'
  | 'torso'
  | 'pelvis'
  | 'thighL'
  | 'thighR'
  | 'shinL'
  | 'shinR'
  | 'footL'
  | 'footR'
  | 'upperArmL'
  | 'upperArmR'
  | 'lowerArmL'
  | 'lowerArmR';

export interface PartSpec {
  name: PartName;
  /** Body centre in the standing pose (x forward, y up, feet at 0). */
  center: { x: number; y: number };
  /** Capsule end points in body-local space. */
  a?: { x: number; y: number };
  b?: { x: number; y: number };
  /** Capsule or circle radius. */
  radius: number;
  mass: number;
  circle?: boolean;
  /** Flat box half-sizes (feet). */
  box?: { hx: number; hy: number };
  /** Friction of this part's fixtures. Feet grip more than limbs. */
  friction: number;
  linearDamping: number;
  angularDamping: number;
}

export interface JointSpec {
  parent: PartName;
  child: PartName;
  parentAnchor: { x: number; y: number };
  childAnchor: { x: number; y: number };
  /** Relative angle limits (child minus parent) for facing +1, in radians. */
  lower: number;
  upper: number;
  /** Peak motor torque in N*m. */
  torque: number;
}

const BODY = { friction: 0.5, linearDamping: 0.12, angularDamping: 0.4 };

export const PART_SPECS: PartSpec[] = [
  { name: 'pelvis', center: { x: 0, y: 1.0 }, a: { x: -0.06, y: 0 }, b: { x: 0.06, y: 0 }, radius: 0.12, mass: 7, ...BODY },
  { name: 'torso', center: { x: 0, y: 1.29 }, a: { x: 0, y: -0.17 }, b: { x: 0, y: 0.17 }, radius: 0.15, mass: 13, ...BODY },
  { name: 'head', center: { x: 0, y: 1.63 }, radius: 0.17, mass: 3.5, circle: true, friction: 0.5, linearDamping: 0.12, angularDamping: 0.6 },
  { name: 'thighL', center: { x: -0.07, y: 0.735 }, a: { x: 0, y: 0.215 }, b: { x: 0, y: -0.215 }, radius: 0.085, mass: 6, ...BODY, angularDamping: 0.45 },
  { name: 'thighR', center: { x: 0.07, y: 0.735 }, a: { x: 0, y: 0.215 }, b: { x: 0, y: -0.215 }, radius: 0.085, mass: 6, ...BODY, angularDamping: 0.45 },
  { name: 'shinL', center: { x: -0.07, y: 0.31 }, a: { x: 0, y: 0.21 }, b: { x: 0, y: -0.21 }, radius: 0.07, mass: 3, ...BODY, angularDamping: 0.5 },
  { name: 'shinR', center: { x: 0.07, y: 0.31 }, a: { x: 0, y: 0.21 }, b: { x: 0, y: -0.21 }, radius: 0.07, mass: 3, ...BODY, angularDamping: 0.5 },
  { name: 'footL', center: { x: -0.04, y: 0.04 }, box: { hx: 0.11, hy: 0.04 }, radius: 0, mass: 0.9, friction: 0.95, linearDamping: 0.12, angularDamping: 0.5 },
  { name: 'footR', center: { x: 0.1, y: 0.04 }, box: { hx: 0.11, hy: 0.04 }, radius: 0, mass: 0.9, friction: 0.95, linearDamping: 0.12, angularDamping: 0.5 },
  { name: 'upperArmL', center: { x: -0.17, y: 1.27 }, a: { x: 0, y: 0.15 }, b: { x: 0, y: -0.15 }, radius: 0.055, mass: 2, friction: 0.5, linearDamping: 0.1, angularDamping: 0.6 },
  { name: 'upperArmR', center: { x: 0.17, y: 1.27 }, a: { x: 0, y: 0.15 }, b: { x: 0, y: -0.15 }, radius: 0.055, mass: 2, friction: 0.5, linearDamping: 0.1, angularDamping: 0.6 },
  { name: 'lowerArmL', center: { x: -0.17, y: 0.98 }, a: { x: 0, y: 0.14 }, b: { x: 0, y: -0.14 }, radius: 0.05, mass: 1.2, friction: 0.5, linearDamping: 0.1, angularDamping: 0.6 },
  { name: 'lowerArmR', center: { x: 0.17, y: 0.98 }, a: { x: 0, y: 0.14 }, b: { x: 0, y: -0.14 }, radius: 0.05, mass: 1.2, friction: 0.5, linearDamping: 0.1, angularDamping: 0.6 },
];

export const JOINT_SPECS: JointSpec[] = [
  // Neck: head to torso.
  { parent: 'torso', child: 'head', parentAnchor: { x: 0, y: 0.17 }, childAnchor: { x: 0, y: -0.17 }, lower: -1.0, upper: 1.0, torque: 30 },
  // Waist: torso to pelvis. Wide enough to sit the torso up from a lying pelvis.
  { parent: 'pelvis', child: 'torso', parentAnchor: { x: 0, y: 0.12 }, childAnchor: { x: 0, y: -0.17 }, lower: -1.4, upper: 1.4, torque: 220 },
  // Hips: pelvis to thighs. Forward flexion is positive.
  { parent: 'pelvis', child: 'thighL', parentAnchor: { x: -0.07, y: -0.05 }, childAnchor: { x: 0, y: 0.215 }, lower: -0.8, upper: 1.7, torque: 340 },
  { parent: 'pelvis', child: 'thighR', parentAnchor: { x: 0.07, y: -0.05 }, childAnchor: { x: 0, y: 0.215 }, lower: -0.8, upper: 1.7, torque: 340 },
  // Knees: thighs to shins. Knees only bend backward.
  { parent: 'thighL', child: 'shinL', parentAnchor: { x: 0, y: -0.215 }, childAnchor: { x: 0, y: 0.21 }, lower: -2.2, upper: 0.1, torque: 240 },
  { parent: 'thighR', child: 'shinR', parentAnchor: { x: 0, y: -0.215 }, childAnchor: { x: 0, y: 0.21 }, lower: -2.2, upper: 0.1, torque: 240 },
  // Ankles: shin to foot. The ankle is where the foot's flat base meets the shin.
  { parent: 'shinL', child: 'footL', parentAnchor: { x: 0, y: -0.21 }, childAnchor: { x: -0.03, y: 0.06 }, lower: -0.9, upper: 0.9, torque: 260 },
  { parent: 'shinR', child: 'footR', parentAnchor: { x: 0, y: -0.21 }, childAnchor: { x: -0.03, y: 0.06 }, lower: -0.9, upper: 0.9, torque: 260 },
  // Shoulders: torso to upper arms. Forward raise is positive; overhead is allowed.
  { parent: 'torso', child: 'upperArmL', parentAnchor: { x: -0.17, y: 0.13 }, childAnchor: { x: 0, y: 0.15 }, lower: -1.5, upper: 3.3, torque: 70 },
  { parent: 'torso', child: 'upperArmR', parentAnchor: { x: 0.17, y: 0.13 }, childAnchor: { x: 0, y: 0.15 }, lower: -1.5, upper: 3.3, torque: 70 },
  // Elbows: upper arm to forearm.
  { parent: 'upperArmL', child: 'lowerArmL', parentAnchor: { x: 0, y: -0.15 }, childAnchor: { x: 0, y: 0.14 }, lower: -0.1, upper: 2.5, torque: 30 },
  { parent: 'upperArmR', child: 'lowerArmR', parentAnchor: { x: 0, y: -0.15 }, childAnchor: { x: 0, y: 0.14 }, lower: -0.1, upper: 2.5, torque: 30 },
];

/** Small lift applied on spawn so feet do not start inside the ground. */
export const SPAWN_LIFT = 0.04;
