import type { Progress } from "@/lib/types";

const FUTURE_SKEW_MS = 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;
const DEVICE_RE = /^[\w-]{8,80}$/;

export function parseProgress(body: unknown, now = Date.now()): Progress | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Partial<Progress>;
  if (typeof value.charOffset !== "number" || !Number.isFinite(value.charOffset) || value.charOffset < 0) {
    return null;
  }
  if (value.charOffset > 100_000_000) return null;
  if (typeof value.snippet !== "string" || value.snippet.length > 100) return null;
  if (typeof value.updatedAt !== "number" || !Number.isFinite(value.updatedAt)) return null;
  if (value.updatedAt > now + FUTURE_SKEW_MS || value.updatedAt < now - MAX_AGE_MS) return null;
  if (typeof value.deviceId !== "string" || !DEVICE_RE.test(value.deviceId)) return null;
  return {
    charOffset: Math.floor(value.charOffset),
    snippet: value.snippet,
    updatedAt: value.updatedAt,
    deviceId: value.deviceId,
  };
}
