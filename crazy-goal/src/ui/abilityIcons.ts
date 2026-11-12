import type { Boost } from '../abilities/Cards';
import fireIcon from '../assets/ui/ability-fire.png';
import magnetIcon from '../assets/ui/ability-magnet.png';
import rubberIcon from '../assets/ui/ability-rubber.png';

/** The hand-drawn circular badge artwork for each boost. */
export const ABILITY_ICON: Readonly<Record<Boost, string>> = {
  fire: fireIcon,
  magnet: magnetIcon,
  rubber: rubberIcon,
};
