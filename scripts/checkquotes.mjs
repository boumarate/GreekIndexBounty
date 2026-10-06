#!/usr/bin/env node
// Quotation check: every English quotation in an article that is followed by line references, like
//   they veil themselves “in white linen” (3.141)
// must occur in the translation of those lines (give or take a line). Run it after the translation of
// a book changes, to find articles still quoting the old wording. Ellipses (…) split a quotation into
// parts that must each occur. Glosses of a word or two, quotations of other authors, and literal
// renderings of the Greek are reported too; judge those by eye.
//   node scripts/checkquotes.mjs [work id]        (default: the first work with a translation)
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT, walk, loadLibrary } from './lib/content.mjs';

const { works } = loadLibrary();
const workId = process.argv[2];
const work = works.find(w => (workId ? w.id === workId : [...w.texts.values()].some(t => t.editions.en)));
if (!work) { console.error(`No work ${workId ?? 'with a translation'}`); process.exit(1); }
const en = new Map([...work.texts].map(([book, t]) => [book, t.editions.en ?? new Map()]));

const norm = s => s.normalize('NFC').toLowerCase()
  .replace(/[“”"‘’'`/]/g, '').replace(/[—–-]/g, ' ').replace(/[.,;:!?()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
const files = [path.join(CONTENT, 'index'), path.join(CONTENT, 'library')].flatMap(d => walk(d, f => f.endsWith('.md')));

let checked = 0, missing = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/“([^”]{3,300})”[^“”(]{0,40}?\(((?:Il\.\s*|Iliad\s*)?\d+\.\d+[^)]*)\)/g)) {
    const [, quote, refs] = m;
    if (/[Ͱ-Ͽἀ-῿]/.test(quote)) continue; // Greek, not the translation
    const lines = [];
    // References to the Odyssey ("Od. 11.550", "Odyssey 3.440, 24.275") or the Aeneid ("*Aeneid* 12.438–440")
    // are not lines of this work.
    const own = refs.replace(/(?:\bOd\.|\*?Odyssey\*?|\bAen\.|\*?Aeneid\*?)\s*(?:\d+\.\d+(?:[–-]\d+)?(?:,\s*)?)+/g, '');
    for (const [, b, from, to] of own.matchAll(/(?<![\d.])(\d+)\.(\d+)(?:[–-](\d+))?/g)) {
      const rows = en.get(+b);
      if (rows) for (let n = +from - 1; n <= +(to ?? from) + 1; n++) if (rows.has(n)) lines.push(rows.get(n));
    }
    if (!lines.length) continue;
    checked++;
    const hay = norm(lines.join(' '));
    const parts = quote.split(/…|\.\.\./).map(norm).filter(p => p.length > 2);
    if (parts.every(p => hay.includes(p))) continue;
    missing++;
    console.log(`${path.relative(CONTENT, file)}: “${quote}” (${refs})`);
  }
}
console.log(`${checked} quotations checked against the ${work.title} translation; ${missing} not found (glosses and other authors' words included).`);
