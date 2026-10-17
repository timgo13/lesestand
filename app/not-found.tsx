import Link from "next/link";

export default function NotFound() {
  return (
    <main>
      <header>
        <h1>Buch nicht gefunden</h1>
      </header>
      <p>Diese Datei liegt nicht in der Bibliothek.</p>
      <p>
        <Link href="/">Zur Bibliothek</Link>
      </p>
    </main>
  );
}
