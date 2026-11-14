/** Fixed full-viewport scanlines, vignette and a faint flicker. Never intercepts input. */
export function CrtOverlay() {
  return (
    <div className="crt-overlay no-print" aria-hidden="true">
      <div className="crt-scanlines" />
      <div className="crt-vignette" />
      <div className="crt-flicker" />
    </div>
  );
}
