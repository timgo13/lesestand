const PUBLIC_MESSAGES = new Set([
  "Upstash Redis ist nicht konfiguriert",
  "BLOB_READ_WRITE_TOKEN fehlt",
  "APP_PASSWORD fehlt",
  "AUTH_SECRET fehlt",
  "Ungültiger Speicherpfad",
  "Ungültige Dateiadresse",
  "Dateiadresse passt nicht zum Speicherpfad",
  "Hochgeladene Datei wurde nicht gefunden",
  "Buchdatei ist beschädigt",
  "Ungültiger Dateiname",
  "Die Datei enthält keinen Text",
  "Datei ist zu groß",
]);

export function publicError(error: unknown, fallback: string): string {
  if (error instanceof Error && PUBLIC_MESSAGES.has(error.message)) return error.message;
  console.error(error);
  return fallback;
}
