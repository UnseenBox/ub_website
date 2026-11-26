// Shared texture keys that are referenced by more than one scene or a test.

export const MENU_BG_TEXTURE = 'menu_bg';
export const MENU_BUTTONS_TEXTURE = 'menu_buttons';

export const MENU_BUTTON_FRAMES = {
  continue: 'btn_continue',
  newGame: 'btn_new_game',
  armory: 'btn_armory',
  settings: 'btn_settings',
  store: 'btn_store',
} as const;

/** The supplied Act 1 painting, and the map texture cropped from it for the map screen. */
export const MAP_VALLEY_ART = 'map_valley_art';
export const MAP_VALLEY_TEXTURE = 'valley_map_1';
