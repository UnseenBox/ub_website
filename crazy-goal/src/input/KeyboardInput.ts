import type { Command, InputSink } from './InputSink';

const KEYS: Readonly<Record<string, Command>> = {
  KeyR: 'restart',
  // No Escape: in a browser it also leaves fullscreen (CrazyGames asks games not to use it). P pauses.
  KeyP: 'pause',
  KeyM: 'mute',
  KeyF: 'air',
  KeyQ: 'bendLeft',
  KeyE: 'bendRight',
  // W and S, or the arrow keys, raise and lower the lob.
  KeyW: 'heightUp',
  KeyS: 'heightDown',
  ArrowUp: 'heightUp',
  ArrowDown: 'heightDown',
  F3: 'debug',
  Space: 'confirm',
  Enter: 'confirm',
};

export class KeyboardInput {
  constructor(private readonly sink: InputSink) {
    window.addEventListener('keydown', this.onKey);
    // Browsers let a page block Ctrl/Cmd+W only while it holds fullscreen; CrazyGames asks games
    // to use that, since it is too easy to end the match by closing the tab instead of pausing.
    window.addEventListener('keydown', this.guardTabClose, { capture: true });
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keydown', this.guardTabClose, { capture: true });
  }

  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const command = KEYS[e.code];
    if (!command) return;
    e.preventDefault();
    this.sink.gesture();
    this.sink.command(command);
  };

  private readonly guardTabClose = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyW' && document.fullscreenElement) e.preventDefault();
  };
}
