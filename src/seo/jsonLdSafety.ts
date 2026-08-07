/**
 * react-helmet-async renders <script> children by writing the raw string straight
 * into innerHTML (client) or splicing it unescaped into the SSR HTML string — it does
 * NOT protect against a literal "</script>" (or "<!--", "<style>", etc.) inside the
 * content breaking out of the script tag and being parsed as real, executing markup.
 * JSON-LD payloads here can carry externally-influenced text (job listings ingested
 * via Apify, blog post titles/tags), so every JSON-LD blob must go through this
 * escaping before being handed to a <script> child — never JSON.stringify() directly.
 */
export function safeJsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}
