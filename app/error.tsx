"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <header className="page-header">
        <h1>Etwas ist schiefgelaufen</h1>
      </header>
      <p className="muted">{error.message || "Die Seite konnte nicht geladen werden."}</p>
      <button type="button" className="primary" onClick={reset}>
        Nochmal versuchen
      </button>
    </main>
  );
}
