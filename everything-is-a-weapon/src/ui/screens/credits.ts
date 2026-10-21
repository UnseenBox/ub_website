/**
 * The credits card lives outside #screens in index.html, so it only needs
 * wiring once — the lobby bar shows it, the panel opens over everything.
 */
export function installCredits(): void {
  const button = document.getElementById('menu-credits-btn');
  const panel = document.getElementById('menu-credits-panel');
  const close = document.getElementById('menu-credits-close');
  if (!button || !panel) return;

  const open = (): void => {
    panel.hidden = false;
    close?.focus();
  };
  const shut = (): void => {
    panel.hidden = true;
    button.focus();
  };

  button.addEventListener('click', open);
  close?.addEventListener('click', shut);
  panel.addEventListener('click', (event) => {
    if (event.target === panel) shut();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) shut();
  });
}
