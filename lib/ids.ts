const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INCOMING_RE = /^incoming\/[a-zA-Z0-9._-]{1,200}\.html$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function isIncomingPath(pathname: string): boolean {
  return INCOMING_RE.test(pathname) && !pathname.includes("..");
}
