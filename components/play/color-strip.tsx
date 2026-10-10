/** A solid rainbow divider between the Play page's colour bands. Flat hues only. */
const STRIP_HUES = ["#f5b83d", "#ff5f7a", "#b08bff", "#5aa9ff", "#3fd0c0", "#7ddc6f"];

export function ColorStrip() {
  return (
    <div aria-hidden className="flex h-1.5">
      {STRIP_HUES.map((hue) => (
        <span key={hue} className="h-full flex-1" style={{ backgroundColor: hue }} />
      ))}
    </div>
  );
}
