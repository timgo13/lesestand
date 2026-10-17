function normalizeCharset(label: string): string {
  const value = label.toLowerCase().replaceAll("_", "-");
  if (value === "utf8") return "utf-8";
  if (value === "gb2312" || value === "gb-2312") return "gbk";
  if (value === "iso-8859-1" || value === "latin1" || value === "ascii") return "windows-1252";
  return value;
}

export function decodeHtmlBytes(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }

  const head = new TextDecoder("latin1").decode(bytes.subarray(0, Math.min(bytes.length, 4096)));
  const meta = head.match(/charset\s*=\s*["']?\s*([a-zA-Z0-9._-]+)/i);
  const charset = normalizeCharset(meta?.[1] ?? "utf-8");
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}
