export function formatBytes(size: number): string {
  if (!Number.isFinite(size) || size < 0) return "";
  if (size < 1024) return `${Math.round(size)} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatWhen(timestamp: number, now = Date.now()): string {
  const delta = Math.max(0, now - timestamp);
  if (delta < 60_000) return "gerade eben";
  if (delta < 60 * 60_000) {
    const minutes = Math.floor(delta / 60_000);
    return `vor ${minutes} Minute${minutes === 1 ? "" : "n"}`;
  }
  if (delta < 24 * 60 * 60_000) {
    const hours = Math.floor(delta / (60 * 60_000));
    return `vor ${hours} Stunde${hours === 1 ? "" : "n"}`;
  }
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}
