#!/usr/bin/env node
// Homograph check: for every index entry and each of its Greek patterns, the lexicon lemmas of the
// words the pattern matches. A pattern that catches words of two unrelated lemmas usually has caught
// a homograph: θεῶν "of the gods" and θέων "running" (6.54) differ only by accent, and ἰῷ "arrow" is
// also ἰῷ "one" (6.422). Lemmas that differ in capitalization (a name and a common word) or share
// fewer than four leading letters are reported; families like εὔχομαι, εὐχωλή are mostly passed over.
// Fix what it finds with `=`, `^`, `!` or `except:` (docs/index-guide.md). Only books with a lexicon
// are checked.
//   node scripts/homographs.mjs [book]        (a book number limits the report to that book's lines)
import { loadLibrary, loadEntries, loadNotes } from './lib/content.mjs';
import { compilePatterns, matchTokens } from './lib/concordance.mjs';
import { tokenize, normalize } from './lib/greek.mjs';
import { makeWorkResolver, parseRef, refLines } from './lib/refs.mjs';

const onlyBook = process.argv[2] ? Number(process.argv[2]) : null;
const { works } = loadLibrary();
const resolveWork = makeWorkResolver(works);
const arr = v => (v == null ? [] : [].concat(v)).map(String);

// Each entry's patterns and excepted lines, with the forms and exceptions its notes add.
const entries = new Map();
for (const e of loadEntries()) {
  entries.set(e.id, { id: e.id, file: e.file, work: e.data.work ?? 'homer.iliad', grc: arr(e.data.grc), except: arr(e.data.except).map(s => [s, e.data.work ?? 'homer.iliad']) });
}
for (const n of loadNotes()) {
  const e = entries.get(n.entryId);
  if (!e) continue;
  e.grc.push(...arr(n.data.grc));
  e.except.push(...arr(n.data.except).map(s => [s, n.scope.work ?? e.work]));
}

const cap = w => w[0] !== w[0].toLowerCase();
const shared = (a, b) => { const x = normalize(a), y = normalize(b); let i = 0; while (i < x.length && x[i] === y[i]) i++; return i; };
let reported = 0;
for (const work of works) {
  const books = [...work.texts].filter(([, t]) => t.lexicon && t.editions.grc);
  if (!books.length) continue;
  for (const e of entries.values()) {
    if (!e.grc.length) continue;
    const excepted = new Set();
    for (const [spec, w] of e.except) {
      try { const r = parseRef(spec, resolveWork, w); if (r.work === work.id) refLines(r).forEach(k => excepted.add(k)); } catch { /* the build reports bad references */ }
    }
    let pats;
    try { pats = compilePatterns(e.grc); } catch { continue; }
    const byPattern = new Map(); // pattern source → lemma → ["6.54 θέων", …]
    for (const [book, t] of books) {
      for (const [n, line] of t.editions.grc) {
        if (excepted.has(`${book}.${n}`)) continue;
        const lex = t.lexicon[n];
        const tokens = tokenize(line).map(tok => ({ ...tok, norm: normalize(tok.word) }));
        if (!lex || lex.length !== tokens.length) continue;
        for (const h of matchTokens(tokens, pats)) {
          if (h.end - h.start !== 1) continue; // phrases rarely catch a homograph
          const lemmas = byPattern.get(h.pattern.source) ?? new Map();
          byPattern.set(h.pattern.source, lemmas);
          const l = lex[h.start].l;
          lemmas.set(l, [...(lemmas.get(l) ?? []), { book, text: `${book}.${n} ${tokens[h.start].word}` }]);
        }
      }
    }
    for (const [source, lemmas] of byPattern) {
      if (lemmas.size < 2) continue;
      const ranked = [...lemmas].sort((a, b) => b[1].length - a[1].length);
      const [main] = ranked[0];
      const odd = ranked.slice(1)
        .filter(([l]) => cap(l) !== cap(main) || shared(l, main) < 4)
        .filter(([, hits]) => !onlyBook || hits.some(h => h.book === onlyBook));
      if (!odd.length) continue;
      reported++;
      console.log(`${e.file}: ${source} is ${main} (×${ranked[0][1].length}), but also`);
      for (const [l, hits] of odd) console.log(`   ${l}: ${hits.slice(0, 8).map(h => h.text).join(', ')}${hits.length > 8 ? ', …' : ''}`);
    }
  }
}
console.log(`${reported} pattern${reported === 1 ? '' : 's'} catching more than one lemma.`);
