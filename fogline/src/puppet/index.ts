// Every puppet creature, by the `look` an enemy definition asks for.

import { brood } from './creatures/brood';
import { brute } from './creatures/brute';
import { crimson } from './creatures/crimson';
import { gorger } from './creatures/gorger';
import { hound } from './creatures/hound';
import { screamer } from './creatures/screamer';
import { stalker } from './creatures/stalker';
import { wraith } from './creatures/wraith';
import type { Creature } from './types';

export const CREATURES: Record<string, Creature> = { crimson, screamer, hound, gorger, wraith, stalker, brood, brute };

/** The texture key of a creature's part atlas. */
export const atlasKey = (look: string): string => `puppet_${look}`;
