const DEVICE_KEY = "lesestand-device";
const DEVICE_RE = /^[\w-]{8,80}$/;

export function getDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing && DEVICE_RE.test(existing)) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, created);
  return created;
}
