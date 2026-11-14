import type { Command, InputSink } from './InputSink';

const KEYS: Readonly<Record<string, Command>> = {
  KeyR: 'restart',
  // No Escape: in a browser it also leaves fullscreen (CrazyGames asks games not to use it). P pauses.
  KeyP: 'pause',
  KeyM: 'mute',
  KeyF: 'air',
  KeyQ: 'bendLeft',
  KeyE: 'bendRight',
  F3: 'debug',
  Space: 'confirm',
  Enter: 'confirm',
};

export class KeyboardInput {
  constructor(private readonly sink: InputSink) {
    window.addEventListener('keydown', this.onKey);
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const command = KEYS[e.code];
    if (!command) return;
    e.preventDefault();
    this.sink.gesture();
    this.sink.command(command);
  };
}
