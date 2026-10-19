import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <header className="page-header">
        <h1>Buch nicht gefunden</h1>
      </header>
      <p className="muted">Diese Datei liegt nicht in der Bibliothek.</p>
      <Link className="button primary" href="/">
        Zur Bibliothek
      </Link>
    </main>
  );
}
