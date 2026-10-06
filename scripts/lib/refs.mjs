// Citation references: "1.396-406", "Il. 1.5", "iliad 1.396–1.406", "homer.iliad 2.1".
// A reference is normalized to { work, book, from, toBook, to } and printed canonically as
// "homer.iliad 1.396-406" (the form stored in the quote registry).

export class RefError extends Error {}

export function makeWorkResolver(works) {
  const aliases = new Map();
  for (const w of works) {
    aliases.set(w.id.toLowerCase(), w.id);
    aliases.set(w.title.toLowerCase(), w.id);
    for (const a of w.aliases ?? []) aliases.set(a.toLowerCase(), w.id);
  }
  return name => aliases.get(String(name).toLowerCase().replace(/\s+/g, ' ').trim());
}

const RANGE = /^(\d+)\.(\d+)(?:\s*[-–—]\s*(?:(\d+)\.)?(\d+))?$/;

/** Parse a reference; `defaultWork` is used when the string names no work. */
export function parseRef(input, resolveWork, defaultWork) {
  const text = String(input).trim();
  const m = text.match(/^(.*?)\s*(\d+\.\d+(?:\s*[-–—]\s*(?:\d+\.)?\d+)?)$/);
  if (!m) throw new RefError(`Not a reference: "${input}"`);
  const [, workPart, range] = m;
  const work = workPart ? resolveWork(workPart.replace(/,$/, '')) : defaultWork;
  if (!work) throw new RefError(`Unknown work in reference: "${input}"`);
  const r = range.replace(/\s+/g, '').match(RANGE);
  const book = +r[1], from = +r[2];
  const toBook = r[3] ? +r[3] : book;
  const to = r[4] ? +r[4] : from;
  if (toBook < book || (toBook === book && to < from)) throw new RefError(`Backwards range: "${input}"`);
  return { work, book, from, toBook, to };
}

export function formatRange({ book, from, toBook, to }, dash = '-') {
  if (toBook !== book) return `${book}.${from}${dash}${toBook}.${to}`;
  if (to !== from) return `${book}.${from}${dash}${to}`;
  return `${book}.${from}`;
}

export const canonicalRef = r => `${r.work} ${formatRange(r)}`;

/** Expand a (single-book) reference into line keys like "1.396". */
export function refLines(r) {
  if (r.toBook !== r.book) throw new RefError(`Cross-book ranges are not supported yet: ${canonicalRef(r)}`);
  const out = [];
  for (let n = r.from; n <= r.to; n++) out.push(`${r.book}.${n}`);
  return out;
}
