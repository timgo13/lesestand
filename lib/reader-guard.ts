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
    font-family: var(--font-family), serif !important;
  }
  body {
    width: min(95%, var(--column-width)) !important;
    margin: 0 auto !important;
  }
  .topbar, .banner {
    background-color: var(--background-color) !important;
    color: var(--color) !important;
    font-family: var(--font-family), serif !important;
    visibility: visible !important;
    opacity: 1 !important;
    pointer-events: auto !important;
  }
  .topbar {
    display: flex !important;
    position: fixed !important;
    z-index: 2147483646 !important;
  }
  .banner {
    display: block !important;
    position: fixed !important;
    z-index: 2147483645 !important;
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
