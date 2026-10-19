// Das Buch bringt eigene Styles mit. Diese Regeln sorgen dafür, dass sie die Seite
// (Hintergrund, Schrift, Spaltenbreite, Leiste) nicht kaputt machen und der Text lesbar bleibt.
export const READER_GUARD_CSS = `
  html, body {
    display: block !important;
    visibility: visible !important;
    height: auto !important;
    min-height: 100% !important;
    overflow-x: hidden !important;
    overflow-y: auto !important;
    background-color: var(--background-color) !important;
    color: var(--color) !important;
    font-family: var(--font-family) !important;
  }
  body {
    width: min(100% - 2rem, var(--column-width)) !important;
    margin: 0 auto !important;
  }
  .topbar {
    display: flex !important;
    position: fixed !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
    z-index: 2147483646 !important;
    background-color: color-mix(in srgb, var(--background-color) 88%, transparent) !important;
    color: var(--color) !important;
    font-family: var(--ui-font) !important;
  }
  .novel, .novel * {
    user-select: text !important;
    -webkit-user-select: text !important;
  }
  .novel img, .novel video, .novel canvas {
    max-width: 100% !important;
    height: auto !important;
  }
`;
