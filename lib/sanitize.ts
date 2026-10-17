import sanitizeHtml from "sanitize-html";

const SAFE_CSS_VALUE = [
  /^(?![\s\S]*(?:expression\s*\(|javascript\s*:|-moz-binding|behavior\s*:|@import|-o-link))[^;{}]*$/i,
];

const CSS_PROPS = [
  "color",
  "background",
  "background-color",
  "background-image",
  "font",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "text-align",
  "text-indent",
  "text-decoration",
  "text-transform",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "white-space",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "width",
  "height",
  "max-width",
  "min-width",
  "max-height",
  "min-height",
  "display",
  "float",
  "clear",
  "vertical-align",
  "list-style",
  "list-style-type",
  "list-style-position",
  "text-shadow",
  "box-shadow",
  "opacity",
  "overflow",
  "overflow-x",
  "overflow-y",
  "quotes",
  "page-break-before",
  "page-break-after",
  "break-before",
  "break-after",
];

const allowedStyles: Record<string, Record<string, RegExp[]>> = {
  "*": Object.fromEntries(CSS_PROPS.map((property) => [property, SAFE_CSS_VALUE])),
};

const ALLOWED_TAGS = [
  "html",
  "head",
  "body",
  "title",
  "style",
  "article",
  "section",
  "main",
  "header",
  "footer",
  "nav",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "br",
  "hr",
  "div",
  "span",
  "blockquote",
  "pre",
  "code",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "em",
  "strong",
  "b",
  "i",
  "u",
  "s",
  "sub",
  "sup",
  "small",
  "mark",
  "a",
  "img",
  "figure",
  "figcaption",
  "picture",
  "source",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "colgroup",
  "col",
  "ruby",
  "rt",
  "rp",
  "q",
  "cite",
  "abbr",
  "time",
  "wbr",
];

export function scrubCss(css: string): string {
  return css
    .replace(/<\/style/gi, "")
    .replace(/expression\s*\(/gi, "blocked(")
    .replace(/javascript\s*:/gi, "blocked:")
    .replace(/@import[\s\S]*?;/gi, "")
    .replace(/-moz-binding\s*:[^;}]*/gi, "")
    .replace(/behavior\s*:[^;}]*/gi, "");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (match, digits: string) => {
      const code = Number(digits);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : match;
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

export function extractTitle(html: string, filename: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const text = decodeEntities((match?.[1] ?? "").replace(/<[^>]+>/g, ""))
    .replace(/\s+/g, " ")
    .trim();
  if (text) return text.slice(0, 180);
  const fromFile = filename.replace(/\.html?$/i, "").replace(/\s+/g, " ").trim();
  return (fromFile || "Ohne Titel").slice(0, 180);
}

export function cleanFilename(name: string): string {
  const base = (name.split(/[/\\]/).pop() ?? "roman.html").replace(/[\u0000-\u001f]/g, "").trim();
  const limited = (base || "roman.html").slice(0, 180);
  return /\.html?$/i.test(limited) ? limited : `${limited}.html`;
}

export function prepareNovel(html: string, filename: string): { title: string; styles: string; body: string } {
  const title = extractTitle(html, filename);
  const sanitized = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": ["class", "id", "title", "lang", "style"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height"],
      source: ["src", "srcset", "type"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
      ol: ["start", "type"],
      li: ["value"],
      time: ["datetime"],
      col: ["span"],
    },
    allowedStyles,
    allowedSchemes: ["http", "https", "mailto", "data"],
    allowedSchemesByTag: {
      img: ["http", "https", "data"],
      source: ["http", "https", "data"],
    },
    allowProtocolRelative: false,
    allowVulnerableTags: true,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          rel: "noopener noreferrer",
        },
      }),
    },
  });

  const styles = [...sanitized.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => scrubCss(match[1] ?? ""))
    .join("\n");
  const withoutStyle = sanitized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  const bodyMatch = withoutStyle.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = (bodyMatch ? bodyMatch[1] : withoutStyle)
    .replace(/<\/?(?:html|head|body|title)\b[^>]*>/gi, "")
    .trim();

  const plain = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!plain) throw new Error("Die Datei enthält keinen Text");

  return { title, styles, body };
}
