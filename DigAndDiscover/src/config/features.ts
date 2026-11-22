/**
 * Feature switch for the retention update (dream intro, new loading screen, one monthly debt
 * payment with warnings, daily goals).
 *
 * It is ON in the dev server, in the CrazyGames Basic Launch build and in the unseenbox.com website build (mode `website`, no CrazyGames SDK) (`build:crazygames-basic`).
 * It is OFF in the full CrazyGames build (`build:crazygames`) and in the default build, so those
 * keep the old behaviour until the changes are moved over on purpose.
 *
 * To move the update to the full build: make `v2` true for mode `crazygames` as well (see
 * RETENTION_UPDATE_REMINDER.md in the project root).
 *
 * `import.meta.env?.` keeps this module safe in the headless node simulations (dev/*.ts), where
 * there is no Vite environment and the switch is simply off.
 */
const env = (import.meta as unknown as { env?: { DEV?: boolean; MODE?: string } }).env;

export const FEATURES = {
  v2: env?.DEV === true || env?.MODE === 'crazygames-basic' || env?.MODE === 'website',
} as const;
