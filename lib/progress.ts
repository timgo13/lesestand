import type { ProgressInput } from "@/lib/types";

const MAX_OFFSET = 100_000_000;
const MAX_SNIPPET = 200;

export function parseProgress(body: unknown): ProgressInput | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Partial<ProgressInput>;
  if (typeof value.charOffset !== "number" || !Number.isFinite(value.charOffset)) return null;
  if (value.charOffset < 0 || value.charOffset > MAX_OFFSET) return null;
  const snippet = typeof value.snippet === "string" ? value.snippet.slice(0, MAX_SNIPPET) : "";
  return { charOffset: Math.floor(value.charOffset), snippet };
}
