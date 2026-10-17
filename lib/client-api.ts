export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { ...init, cache: "no-store" });
  if (response.status === 401 && typeof window !== "undefined") {
    const next = `${window.location.pathname}${window.location.search}`;
    window.location.href = `/login?next=${encodeURIComponent(next)}`;
  }
  return response;
}

export function readError(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data && typeof data.error === "string") {
    return data.error;
  }
  return fallback;
}
