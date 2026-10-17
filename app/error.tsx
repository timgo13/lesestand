"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main>
      <header>
        <h1>Etwas ist schiefgelaufen</h1>
      </header>
      <p>{error.message || "Die Seite konnte nicht geladen werden."}</p>
      <button type="button" onClick={reset}>
        Nochmal versuchen
      </button>
    </main>
  );
}
