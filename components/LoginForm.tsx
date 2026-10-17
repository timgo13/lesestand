"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Anmeldung fehlgeschlagen");
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("Keine Verbindung zum Server");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <header>
        <h1>Lesestand</h1>
      </header>
      <form onSubmit={onSubmit}>
        <p>Derselbe Zugangscode auf Handy und PC.</p>
        <label htmlFor="password">Zugangscode</label>
        <input
          id="password"
          type="password"
          name="password"
          autoComplete="current-password"
          autoFocus
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={pending}>
          {pending ? "Wird geprüft…" : "Öffnen"}
        </button>
      </form>
    </>
  );
}
