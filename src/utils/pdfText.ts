// jsPDF's built-in fonts hold Western European characters only. One character
// outside them makes jsPDF write the whole line in a second encoding, which
// applicant tracking systems read as "D e v e l o p e d".
const REPLACEMENTS: Record<string, string> = {
  '₹': 'Rs. ', '→': '->', '←': '<-', '⇒': '=>', '≥': '>=', '≤': '<=', '≠': '!=', '≈': '~', '−': '-',
  '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...', '™': '', '€': 'EUR ',
  '●': '•', '▪': '•', '◦': '•', '‣': '•', '✓': '', '✔': '',
  ' ': ' ', ' ': ' ', ' ': ' ', '­': '', '‐': '-', '‑': '-',
};

const UNSUPPORTED = /[^\x20-\x7e\n\t¡-ÿ•]/gu;

// ponytail: scripts such as Devanagari or Telugu are dropped from the PDF (the Word
// file keeps them); embedding a Unicode font is the way to support them.
export const toPdfText = (value: string): string =>
  value
    .replace(/./gsu, (char) => REPLACEMENTS[char] ?? char)
    .replace(/(Rs\.|EUR)\s+(?=\d)/g, '$1 ')
    .replace(UNSUPPORTED, (char) => char.normalize('NFKD').replace(UNSUPPORTED, ''));

/** Applies toPdfText to every string in a resume, leaving its shape alone. */
export const toPdfSafe = <T>(value: T): T => {
  if (typeof value === 'string') return toPdfText(value) as T;
  if (Array.isArray(value)) return value.map(toPdfSafe) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, toPdfSafe(item)])) as T;
  }
  return value;
};
