#!/usr/bin/env node
// GreekIndexBounty build: content/ → site/data/.
// Validates everything it reads; errors fail the build, warnings are listed in site/data/report.json.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, CONTENT, readJson, loadLibrary, loadEntries, loadNotes, loadQuotes } from './lib/content.mjs';
import { tokenize, normalize, romanize, isCapitalized } from './lib/greek.mjs';
import { compilePatterns, matchTokens, compileEnglish, findEnglish, resolveOverlaps } from './lib/concordance.mjs';
import { renderMarkdown, slugify } from './lib/markdown.mjs';
import { parseRef, makeWorkResolver, formatRange, refLines } from './lib/refs.mjs';
import { quoteId, isUuid } from './lib/uuid.mjs';

const OUT = path.join(ROOT, 'site', 'data');
const arr = v => v === undefined || v === null || v === '' ? [] : Array.isArray(v) ? v : [v];

const INVERSE = {
  father: 'child', mother: 'child', parent: 'child', son: 'parent', daughter: 'parent', child: 'parent',
  husband: 'wife', wife: 'husband', spouse: 'spouse', brother: 'sibling', sister: 'sibling', sibling: 'sibling',
  grandfather: 'grandchild', grandchild: 'grandparent', companion: 'companion', attendant: 'master', master: 'attendant',
  herald: 'master', priest: 'god served', 'god served': 'priest', captor: 'captive', captive: 'captor', ally: 'ally',
  rival: 'rival', ancestor: 'descendant', descendant: 'ancestor', nurse: 'nursling', 'son-in-law': 'father-in-law',
  'father-in-law': 'son-in-law', protector: 'protected', protected: 'protector', favorite: 'patron', patron: 'favorite',
};

function parseRelation(item, file) {
  const m = String(item).match(/^\s*([\w -]+?)\s*:\s*([\w-]+)\s*(?:\(([^)]*)\))?\s*$/);
  if (!m) throw new Error(`${file}: cannot parse relation "${item}" (expected "father: peleus (1.1)")`);
  return { rel: m[1].trim(), id: m[2], refs: m[3] ? m[3].split(/\s*,\s*/).filter(Boolean) : [] };
}

export function build({ write = true, log = console.log } = {}) {
  const started = Date.now();
  const errors = [], warnings = [];
  const error = m => errors.push(m), warn = m => warnings.push(m);

  // ── Taxonomies and library ────────────────────────────────────────────────
  const { authors, works } = loadLibrary();
  const kinds = readJson(path.join(CONTENT, 'kinds.json'));
  const kindById = new Map(kinds.map(k => [k.id, k]));
  const nameKinds = new Set(kinds.filter(k => k.names).map(k => k.id));
  const tagCfg = readJson(path.join(CONTENT, 'tags.json'));
  const tagById = new Map(tagCfg.tags.map(t => [t.id, { ...t }]));
  const periodCfg = readJson(path.join(CONTENT, 'periods.json'));
  const periodById = new Map(periodCfg.periods.map(p => [p.id, p]));
  const modeById = new Map(periodCfg.modes.map(m => [m.id, m]));
  const workById = new Map(works.map(w => [w.id, w]));
  const authorById = new Map(authors.map(a => [a.id, a]));
  const resolveWork = makeWorkResolver(works);

  const shortCite = r => `${workById.get(r.work)?.citation?.abbr ?? r.work} ${formatRange(r, '–')}`;
  const longCite = r => {
    const w = workById.get(r.work);
    return `${authorById.get(w?.author)?.name ?? ''}, ${w?.title ?? r.work} ${formatRange(r, '–')}`.replace(/^, /, '');
  };
  const readerHref = r => `#/read/${r.work}/${r.book}?l=${r.from}${r.to !== r.from ? `-${r.to}` : ''}`;
  const lineText = (work, book, n, ed) => workById.get(work)?.texts.get(book)?.editions[ed]?.get(n);

  // ── Entries ───────────────────────────────────────────────────────────────
  const entries = [];
  const byId = new Map();
  for (const raw of loadEntries()) {
    const d = raw.data;
    if (byId.has(raw.id)) { error(`Duplicate entry id "${raw.id}" in ${raw.file} and ${byId.get(raw.id).file}`); continue; }
    if (!d.title) error(`${raw.file}: missing title`);
    if (!kindById.has(d.kind)) error(`${raw.file}: unknown kind "${d.kind}"`);
    let relations = [];
    try { relations = arr(d.relations).map(r => parseRelation(r, raw.file)); } catch (e) { error(e.message); }
    const e = {
      id: raw.id, file: raw.file, body: raw.body,
      title: d.title ?? raw.id, greek: d.greek ?? '', kind: d.kind, tags: arr(d.tags),
      translit: d.translit ?? (d.greek ? romanize(d.greek) : ''),
      summary: d.summary ?? '', aliases: arr(d.aliases).map(String),
      grc: arr(d.grc).map(String), en: d.en === undefined ? null : arr(d.en).map(String),
      refs: arr(d.refs).map(String), except: arr(d.except).map(String), passages: arr(d.passages).map(String),
      of: arr(d.of), period: d.period ?? null, mode: d.mode ?? null, narrator: d.narrator ?? null,
      participants: arr(d.participants), relations, work: d.work ?? 'homer.iliad',
      source: d.source ?? null, date: d.date ?? null, featured: d.featured === true, sort: d.sort ?? null,
      order: typeof d.order === 'number' ? d.order : null,
      enExtra: [], notes: [],
    };
    if (e.kind === 'story') {
      if (!periodById.has(e.period)) error(`${raw.file}: story needs a known period (got "${e.period}")`);
      if (e.mode && !modeById.has(e.mode)) error(`${raw.file}: unknown story mode "${e.mode}"`);
    } else if (e.period && !periodById.has(e.period)) error(`${raw.file}: unknown period "${e.period}"`);
    for (const t of e.tags) {
      if (!tagById.has(t)) {
        warn(`${raw.file}: tag "${t}" is not defined in content/tags.json`);
        tagById.set(t, { id: t, facet: 'other', label: t.replace(/-/g, ' ') });
      }
    }
    entries.push(e);
    byId.set(e.id, e);
  }

  // Name resolution for [[links]]: id, title, aliases (case-insensitive).
  const names = new Map();
  const addName = (key, id, strong) => {
    const k = key.toLowerCase().trim();
    if (!k) return;
    if (names.has(k) && names.get(k).id !== id) {
      if (strong && !names.get(k).strong) names.set(k, { id, strong });
      else if (strong && names.get(k).strong) warn(`Name "${key}" refers to both ${names.get(k).id} and ${id}; [[${key}]] links to ${names.get(k).id}`);
      return;
    }
    names.set(k, { id, strong });
  };
  for (const e of entries) addName(e.id, e.id, true);
  for (const e of entries) addName(e.title, e.id, true);
  for (const e of entries) e.aliases.forEach(a => addName(a, e.id, false));
  const resolveName = t => names.get(t.toLowerCase().trim())?.id;

  const checkTarget = (e, id, what) => { if (id && !byId.has(id)) warn(`${e.file}: ${what} "${id}" has no entry`); };
  for (const e of entries) {
    e.of.forEach(id => checkTarget(e, id, 'of'));
    e.participants.forEach(id => checkTarget(e, id, 'participant'));
    checkTarget(e, e.narrator, 'narrator');
    e.relations.forEach(r => checkTarget(e, r.id, `relation ${r.rel}`));
  }

  // ── Scopes and scoped notes ──────────────────────────────────────────────
  // A scope is an author, a work, or a book of a work: "homer", "homer.iliad", "homer.iliad.2".
  const scopeDefs = new Map();
  const addScope = s => { if (!scopeDefs.has(s.id)) scopeDefs.set(s.id, s); };
  for (const a of authors) addScope({ id: a.id, kind: 'author', label: a.name ?? a.id });
  for (const w of works) {
    addScope({ id: w.id, kind: 'work', label: w.title, parent: w.author });
    for (const book of w.texts.keys()) addScope({ id: `${w.id}.${book}`, kind: 'book', label: `${w.title} ${book}`, long: `${w.title}, Book ${book}`, parent: w.id, work: w.id, book });
  }
  const scopeOfRef = (spec, work) => {
    try { const r = parseRef(String(spec).split('|')[0].trim(), resolveWork, work); return `${r.work}.${r.book}`; }
    catch { return null; }
  };
  for (const e of entries) for (const r of e.relations) r.scopes = [...new Set(r.refs.map(x => scopeOfRef(x, e.work)).filter(Boolean))];

  const NOTE_KEYS = new Set(['summary', 'heading', 'grc', 'en', 'refs', 'except', 'passages', 'relations']);
  let rawNotes = [];
  try { rawNotes = loadNotes(); } catch (err) { error(err.message); }
  for (const n of rawNotes) {
    const e = byId.get(n.entryId);
    if (!e) { error(`${n.file}: there is no entry "${n.entryId}" for this note`); continue; }
    if (n.scope.book) {
      const w = workById.get(n.scope.work);
      addScope({ id: n.scope.id, kind: 'book', label: `${w.title} ${n.scope.book}`, long: `${w.title}, Book ${n.scope.book}`, parent: w.id, work: w.id, book: n.scope.book });
    }
    for (const k of Object.keys(n.data)) if (!NOTE_KEYS.has(k)) warn(`${n.file}: "${k}" is not used in notes (use ${[...NOTE_KEYS].join(', ')})`);
    const work = n.scope.work ?? e.work;
    // References in a note default to the note's own work; they are stored with the work named.
    const explicit = spec => {
      const [refPart, ...rest] = String(spec).split('|');
      try {
        const r = parseRef(refPart.trim(), resolveWork, work);
        return `${r.work} ${formatRange(r)}${rest.length ? ` | ${rest.join('|').trim()}` : ''}`;
      } catch (err) { error(`${n.file}: ${err.message}`); return null; }
    };
    e.grc.push(...arr(n.data.grc).map(String));
    e.enExtra.push(...arr(n.data.en).map(String));
    e.refs.push(...arr(n.data.refs).map(explicit).filter(Boolean));
    e.except.push(...arr(n.data.except).map(explicit).filter(Boolean));
    e.passages.push(...arr(n.data.passages).map(explicit).filter(Boolean));
    try {
      for (const r of arr(n.data.relations).map(x => parseRelation(x, n.file))) {
        checkTarget({ file: n.file }, r.id, `relation ${r.rel}`);
        r.scopes = [...new Set(r.refs.map(x => scopeOfRef(x, work)).filter(Boolean))];
        const same = e.relations.find(x => x.rel === r.rel && x.id === r.id);
        if (same) { same.refs = [...new Set([...same.refs, ...r.refs])]; same.scopes = [...new Set([...same.scopes, ...r.scopes])]; }
        else e.relations.push(r);
      }
    } catch (err) { error(err.message); }
    e.notes.push({ ...n, work });
  }
  // Scopes in reading order: author, then each of its works, then that work's books.
  const authorIdx = new Map(authors.map((a, i) => [a.id, i])), workIdx = new Map(works.map((w, i) => [w.id, i]));
  const scopeKey = s => s.kind === 'author' ? [authorIdx.get(s.id) ?? 99, -1, -1]
    : [authorIdx.get(workById.get(s.work ?? s.id)?.author) ?? 99, workIdx.get(s.work ?? s.id) ?? 99, s.book ?? -1];
  const byScope = (a, b) => { const x = scopeKey(a), y = scopeKey(b); return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]; };
  const scopeList = [...scopeDefs.values()].sort(byScope);
  const scopeRank = new Map(scopeList.map((s, i) => [s.id, i]));
  for (const e of entries) e.notes.sort((a, b) => scopeRank.get(a.scope.id) - scopeRank.get(b.scope.id));

  // ── Manual references ────────────────────────────────────────────────────
  const manualByLine = new Map(); // "work book.n" → Set(ids)
  const passageByLine = new Map(); // "work book.n" → Set(ids): lines inside an entry's key passages
  const excepted = new Set();       // "id work book.n"
  const refLineKeys = (e, spec) => {
    try {
      const r = parseRef(spec, resolveWork, e.work);
      return refLines(r).map(k => `${r.work} ${k}`);
    } catch (err) { error(`${e.file}: ${err.message}`); return []; }
  };
  for (const e of entries) {
    for (const spec of e.refs) for (const key of refLineKeys(e, spec)) {
      if (!manualByLine.has(key)) manualByLine.set(key, new Set());
      manualByLine.get(key).add(e.id);
    }
    for (const spec of e.except) for (const key of refLineKeys(e, spec)) excepted.add(`${e.id} ${key}`);
    for (const spec of e.passages) for (const key of refLineKeys(e, spec.split('|')[0])) {
      if (!passageByLine.has(key)) passageByLine.set(key, new Set());
      passageByLine.get(key).add(e.id);
    }
  }

  // ── Concordance over every available text ────────────────────────────────
  const compiled = entries.filter(e => e.grc.length).map(e => ({ e, pats: compilePatterns(e.grc) }));
  const patternUse = new Map(compiled.flatMap(c => c.pats.map(p => [`${c.e.id} ${p.source}`, 0])));
  const englishFor = e => [...(e.en ?? (nameKinds.has(e.kind) ? [e.title, ...e.aliases.filter(a => /^\p{Lu}/u.test(a))] : [])), ...e.enExtra];
  const enCompiled = new Map(entries.map(e => [e.id, compileEnglish(englishFor(e))]));
  const nameEntries = entries.filter(e => nameKinds.has(e.kind));
  const occ = new Map(entries.map(e => [e.id, []]));
  const enSeen = new Set(); // "id\u0001form": explicit English forms found on a line where the entry's Greek occurs
  const texts = [];
  const unindexed = [];
  const lemmaCoverage = new Map(); // lemma → { gloss, pos, count, indexed }
  let tokenTotal = 0;

  const allLemmas = new Set();
  for (const work of works) {
    const seenLemmas = new Set(); // lemmas met in the work's earlier books
    for (const [book, text] of work.texts) {
      const grc = text.editions.grc;
      const en = text.editions.en ?? new Map();
      for (const [edId, rows] of Object.entries(text.editions)) {
        for (const n of grc.keys()) if (!rows.has(n)) warn(`${work.id} ${book}.${n}: missing in edition "${edId}"`);
        for (const n of rows.keys()) if (!grc.has(n)) error(`${work.id} ${book}.${n}: edition "${edId}" has a line the Greek lacks`);
      }

      // Lexicon: one analysis per Greek token, deduplicated into a table.
      const lexTable = [], lexIndex = new Map(), lemmaStats = new Map();
      const lexFor = (n, tokens) => {
        const row = text.lexicon?.[String(n)];
        if (!row) { if (text.lexicon) warn(`${work.id} ${book}.${n}: no lexicon row`); return tokens.map(() => -1); }
        if (row.length !== tokens.length) { error(`${work.id} ${book}.${n}: lexicon has ${row.length} tokens, text has ${tokens.length}`); return tokens.map(() => -1); }
        return tokens.map((t, k) => {
          const a = row[k];
          if (a.w !== t.word) { error(`${work.id} ${book}.${n}: lexicon token ${k} is "${a.w}", text has "${t.word}"`); return -1; }
          const key = `${a.l}\u0001${a.g}\u0001${a.p}\u0001${a.n ?? ''}`;
          if (!lexIndex.has(key)) { lexIndex.set(key, lexTable.length); lexTable.push([a.l, a.g, a.p, a.n ?? '']); }
          const s = lemmaStats.get(a.l) ?? { count: 0, lines: new Set(), glosses: new Map() };
          s.count++; s.lines.add(n); s.glosses.set(a.g, (s.glosses.get(a.g) ?? 0) + 1);
          lemmaStats.set(a.l, s);
          return lexIndex.get(key);
        });
      };

      const lines = [];
      for (const n of [...grc.keys()].sort((a, b) => a - b)) {
        const key = `${work.id} ${book}.${n}`;
        const g = grc.get(n), enText = en.get(n) ?? '';
        const tokens = tokenize(g).map(t => ({ ...t, norm: normalize(t.word) }));
        tokenTotal += tokens.length;
        const tokEnts = tokens.map(() => new Set());
        const lineEnts = new Map();
        for (const c of compiled) {
          if (excepted.has(`${c.e.id} ${key}`)) continue;
          const hits = matchTokens(tokens, c.pats);
          for (const q of hits.excluded) patternUse.set(`${c.e.id} ${q.source}`, patternUse.get(`${c.e.id} ${q.source}`) + 1);
          if (!hits.length) continue;
          for (const h of hits) {
            patternUse.set(`${c.e.id} ${h.pattern.source}`, patternUse.get(`${c.e.id} ${h.pattern.source}`) + 1);
            for (let k = h.start; k < h.end; k++) tokEnts[k].add(c.e.id);
          }
          lineEnts.set(c.e.id, {
            via: 'grc',
            forms: [...new Set(hits.map(h => tokens.slice(h.start, h.end).map(t => t.word).join(' ')))],
            hg: hits.map(h => [tokens[h.start].start, tokens[h.end - 1].end]),
          });
        }
        for (const id of manualByLine.get(key) ?? []) if (!lineEnts.has(id)) lineEnts.set(id, { via: 'ref', forms: [], hg: [] });

        const candidates = [];
        for (const id of lineEnts.keys()) {
          const pr = nameKinds.has(byId.get(id).kind) ? 0 : 1;
          for (const s of findEnglish(enText, enCompiled.get(id))) { candidates.push({ ...s, id, priority: pr }); enSeen.add(`${id}\u0001${s.form}`); }
        }
        for (const e of nameEntries) {
          if (lineEnts.has(e.id) || excepted.has(`${e.id} ${key}`)) continue;
          for (const s of findEnglish(enText, enCompiled.get(e.id))) if (/^\p{Lu}/u.test(s.form)) candidates.push({ ...s, id: e.id, priority: 2, enOnly: true });
        }
        const spans = resolveOverlaps(candidates);
        for (const s of spans) if (s.enOnly && !lineEnts.has(s.id)) lineEnts.set(s.id, { via: 'en', forms: [], hg: [] });

        for (const [id, info] of lineEnts) {
          occ.get(id).push({ work: work.id, book, n, via: info.via, forms: info.forms, grc: g, en: enText, hg: info.hg,
            he: spans.filter(s => s.id === id).map(s => [s.start, s.end]) });
        }
        tokens.forEach((t, k) => { if (isCapitalized(t.word) && !tokEnts[k].size) unindexed.push(`${book}.${n} ${t.word}`); });

        const lx = lexFor(n, tokens);
        lx.forEach((li, k) => {
          if (li < 0) return;
          const [lemma, gloss, parse] = lexTable[li];
          const c = lemmaCoverage.get(lemma) ?? { gloss, pos: parse.split(' · ')[0], count: 0, indexed: false };
          c.count++;
          if (tokEnts[k].size) c.indexed = true;
          lemmaCoverage.set(lemma, c);
        });
        lines.push({
          n, grc: g, en: enText,
          ...(text.witnesses?.[n] ? { witness: text.witnesses[n] } : {}),
          tk: tokens.map((t, k) => [t.word, t.pre, t.post, lx[k], [...tokEnts[k]]]),
          es: spans.map(s => [s.start, s.end, s.id]),
          le: [...lineEnts.keys()],
          lp: [...(passageByLine.get(key) ?? [])],
        });
      }

      const s = text.structure;
      for (const sp of s.speeches ?? []) {
        if (!byId.has(sp.speaker)) warn(`${work.id} ${book}: speaker "${sp.speaker}" has no entry`);
        for (const a of sp.to_whom ?? []) if (!byId.has(a)) warn(`${work.id} ${book}: addressee "${a}" has no entry`);
      }
      // [lemma, gloss, count, lines, 1 if the work has not used the word before this book]
      const lemmas = [...lemmaStats].map(([l, st]) => [l, [...st.glosses].sort((a, b) => b[1] - a[1])[0][0], st.count, [...st.lines], seenLemmas.has(l) ? 0 : 1])
        .sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0], 'el'));
      for (const l of lemmaStats.keys()) { seenLemmas.add(l); allLemmas.add(l); }
      const meta = work.books?.[book] ?? {};
      texts.push({
        file: path.join('texts', work.id, `${book}.json`),
        data: {
          work: work.id, book, letter: meta.letter ?? '', title: meta.title ?? `Book ${book}`, greek: meta.greek ?? '',
          summary: meta.summary ?? '',
          editions: work.editions.map(({ id, lang, label, name, credit }) => ({ id, lang, label, name, credit })),
          lines, lex: lexTable, lemmas,
          scenes: s.scenes ?? [], speeches: s.speeches ?? [], days: s.days ?? [],
        },
      });
    }
  }
  for (const [k, count] of patternUse) if (!count) warn(`Form never matches: ${k}`);
  // Explicit English forms that never appear on a line where the entry's Greek does (a changed translation, a typo).
  for (const e of entries) for (const f of [...(e.en ?? []), ...e.enExtra]) {
    if (!enSeen.has(`${e.id}\u0001${f}`) && (e.grc.length || e.refs.length)) warn(`English form never found where the Greek occurs: ${e.id} "${f}"`);
  }

  // ── Quotes and articles ──────────────────────────────────────────────────
  const registry = loadQuotes();
  const quotePayload = new Map();
  const unsaved = [];
  const payloadFor = q => {
    if (quotePayload.has(q.id)) return quotePayload.get(q.id);
    const r = parseRef(`${q.work} ${q.ref}`, resolveWork);
    const lines = refLines(r).map(k => {
      const n = +k.split('.')[1];
      const grcText = lineText(r.work, r.book, n, 'grc');
      if (grcText === undefined) throw new Error(`Quote ${q.id} (${q.work} ${q.ref}) cites a line that is not available: ${k}`);
      const witness = workById.get(r.work)?.texts.get(r.book)?.witnesses?.[n];
      return { n: k, grc: grcText, en: lineText(r.work, r.book, n, 'en') ?? '', ...(witness ? { witness } : {}) };
    });
    const p = { id: q.id, work: q.work, ref: q.ref, title: q.title ?? '', short: shortCite(r), cite: longCite(r), href: readerHref(r), lines,
      ...(q.start ? { start: q.start } : {}), ...(q.end ? { end: q.end } : {}), ...(q.view ? { view: q.view } : {}) };
    quotePayload.set(q.id, p);
    return p;
  };
  const resolveQuote = (spec, e) => {
    if (isUuid(spec)) {
      const q = registry.get(spec.toLowerCase());
      if (!q) throw new Error(`${e.file}: unknown quote id ${spec}`);
      return payloadFor(q);
    }
    const [refPart, ...rest] = spec.split('|');
    const title = rest.join('|').trim() || undefined;
    const r = parseRef(refPart.trim(), resolveWork, e.work);
    const ref = formatRange(r);
    const id = quoteId({ work: r.work, ref, title });
    if (!registry.has(id)) {
      registry.set(id, { id, work: r.work, ref, ...(title ? { title } : {}) });
      unsaved.push(`${e.file}: {{quote:${spec}}}`);
    }
    return payloadFor(registry.get(id));
  };

  // Figures: SVG files under content/figures, inlined so they can use currentColor and follow the theme.
  const figure = file => {
    const base = path.join(CONTENT, 'figures');
    const full = path.resolve(base, file);
    if (!full.startsWith(base + path.sep) || !full.endsWith('.svg') || !fs.existsSync(full) || fs.realpathSync(full) !== full) throw new Error(`Figure not found: ${file}`);
    const svg = fs.readFileSync(full, 'utf8').replace(/<\?xml[^>]*>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
    if (/<\s*\/?\s*(?!svg\b|g\b|path\b|rect\b|circle\b|ellipse\b|line\b|polyline\b|polygon\b|text\b|tspan\b|title\b|desc\b|defs\b|marker\b|clipPath\b)[a-z]/i.test(svg) || /<!|\son\w+\s*=|\bhref\s*=|url\s*\(/i.test(svg)) throw new Error(`Figure uses unsupported active markup: ${file}`);
    return svg;
  };

  const plain = s => s.replace(/\[\[([^\]|#]+)(?:#[^\]|]*)?\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, (_, t) => byId.get(resolveName(t))?.title ?? t)
    .replace(/\{\{[^}]+\}\}/g, '').replace(/[*_`]/g, '').trim();
  const backlinks = new Map(entries.map(e => [e.id, new Set()]));
  const noteBacklinks = new Map(entries.map(e => [e.id, new Map()])); // target → source → Set(scope)
  const missingLinks = [];
  const pages = new Map();
  // Sections that come after the scoped notes when an article is shown whole.
  const LATE = /^(mythology|outside homer|elsewhere in homer|outside book \d+|outside the (iliad|odyssey)|related words|related entries|reception|later tradition)$/i;
  const hooksFor = (e, file, work, scope) => ({
    link: (target, section) => {
      const id = resolveName(target);
      if (!id) { missingLinks.push(`${file}: [[${target}]]`); return { missing: true, label: target }; }
      if (id !== e.id) {
        if (!scope) backlinks.get(id).add(e.id);
        else {
          const m = noteBacklinks.get(id);
          if (!m.has(e.id)) m.set(e.id, new Set());
          m.get(e.id).add(scope);
        }
      }
      return { id, label: byId.get(id).title, href: `#/entry/${id}${section ? `?s=${encodeURIComponent(slugify(section))}` : ''}` };
    },
    quote: spec => resolveQuote(spec, { file, work }),
    ref: spec => { const r = parseRef(spec, resolveWork, work); return { href: readerHref(r), label: shortCite(r) }; },
    figure,
  });
  const wordCount = s => s.split(/\s+/).filter(Boolean).length;
  for (const e of entries) {
    const hooks = hooksFor(e, e.file, e.work, null);
    const article = renderMarkdown(e.body, hooks);
    const summary = renderMarkdown(e.summary, hooks);
    for (const m of [...article.errors, ...summary.errors]) error(`${e.file}: ${m}`);
    let html = article.html;
    if (e.notes.length && !html.includes('notes-slot')) {
      const late = article.headings.find(h => h.level === 2 && LATE.test(h.text));
      html = late ? html.replace(`<h2 id="${late.id}">`, `<div class="notes-slot"></div><h2 id="${late.id}">`) : `${html}<div class="notes-slot"></div>`;
    }
    const notes = e.notes.map(n => {
      const nh = hooksFor(e, n.file, n.work, n.scope.id);
      const prefix = `${slugify(scopeDefs.get(n.scope.id)?.label ?? n.scope.id)}-`;
      const body = renderMarkdown(n.body, nh, { idPrefix: prefix });
      const sum = renderMarkdown(String(n.data.summary ?? ''), nh);
      for (const m of [...body.errors, ...sum.errors]) error(`${n.file}: ${m}`);
      return {
        scope: n.scope.id, heading: n.data.heading ? String(n.data.heading) : null,
        html: body.html, headings: body.headings, quotes: body.quotes,
        summaryHtml: sum.html.replace(/^<p>|<\/p>$/g, ''), summary: plain(String(n.data.summary ?? '')),
        words: wordCount(n.body),
      };
    });
    pages.set(e.id, {
      html, headings: article.headings, quotes: [...new Set([...article.quotes, ...notes.flatMap(n => n.quotes)])],
      summaryHtml: summary.html.replace(/^<p>|<\/p>$/g, ''), notes,
      words: wordCount(e.body) + notes.reduce((s, n) => s + n.words, 0),
    });
  }

  // ── Derived relationships ────────────────────────────────────────────────
  const relationsOf = new Map(entries.map(e => [e.id, []]));
  for (const e of entries) for (const r of e.relations) relationsOf.get(e.id).push({ rel: r.rel, id: r.id, refs: r.refs, scopes: r.scopes ?? [] });
  for (const e of entries) {
    for (const r of e.relations) {
      if (byId.has(r.id)) {
        const inv = INVERSE[r.rel] ?? `${r.rel} of`;
        const list = relationsOf.get(r.id);
        if (!list.some(x => x.id === e.id)) list.push({ rel: inv, id: e.id, refs: r.refs, scopes: r.scopes ?? [], inverse: true });
      }
    }
  }
  const epithetsOf = new Map(), storiesOf = new Map(), anecdotesOf = new Map();
  const push = (map, k, v) => { if (!map.has(k)) map.set(k, []); map.get(k).push(v); };
  for (const e of entries) {
    if (e.kind === 'epithet') e.of.forEach(id => push(epithetsOf, id, e.id));
    if (e.kind === 'story') new Set([...e.participants, e.narrator].filter(Boolean)).forEach(id => push(storiesOf, id, e.id));
    if (e.kind === 'anecdote' || e.kind === 'note') e.of.forEach(id => push(anecdotesOf, id, e.id));
  }
  const speechesOf = new Map(), addressedOf = new Map();
  for (const t of texts) for (const sp of t.data.speeches) {
    const item = { work: t.data.work, book: t.data.book, from: sp.from, to: sp.to, speaker: sp.speaker, to_whom: sp.to_whom ?? [], kind: sp.kind ?? null };
    push(speechesOf, sp.speaker, item);
    for (const a of sp.to_whom ?? []) push(addressedOf, a, item);
  }

  const firstOcc = id => occ.get(id)[0];
  const refSort = o => o ? `${o.work} ${String(o.book).padStart(3, '0')}.${String(o.n).padStart(5, '0')}` : '~';

  // ── Output ───────────────────────────────────────────────────────────────
  const tagCounts = new Map();
  const tagAncestors = id => { const out = []; let t = tagById.get(id); const seen = new Set(); while (t && !seen.has(t.id)) { seen.add(t.id); out.push(t.id); t = tagById.get(t.parent); } return out; };
  for (const e of entries) new Set(e.tags.flatMap(tagAncestors)).forEach(t => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1));

  const passagesOf = new Map(entries.map(e => [e.id, e.passages.map(spec => {
    const [refPart, ...rest] = spec.split('|');
    try {
      const r = parseRef(refPart.trim(), resolveWork, e.work);
      return { ref: formatRange(r), work: r.work, book: r.book, from: r.from, to: r.to, short: shortCite(r), href: readerHref(r), label: rest.join('|').trim() };
    } catch { return null; }
  }).filter(Boolean)]));
  const passageStarts = e => passagesOf.get(e.id).map(p => ({ work: p.work, book: p.book, n: p.from }));
  // Where an entry is present, book by book: [lines it occurs in, first line]. A note, speech or key passage
  // in a book makes the entry present there even without an occurrence.
  const presenceOf = e => {
    const m = {};
    const add = (scope, lines, first) => {
      const cur = m[scope] ?? [0, 0];
      m[scope] = [cur[0] + lines, first && (!cur[1] || first < cur[1]) ? first : cur[1]];
    };
    for (const o of occ.get(e.id)) add(`${o.work}.${o.book}`, 1, o.n);
    for (const n of e.notes) if (n.scope.book) add(n.scope.id, 0, 0);
    for (const sp of speechesOf.get(e.id) ?? []) add(`${sp.work}.${sp.book}`, 0, sp.from);
    for (const p of passagesOf.get(e.id)) add(`${p.work}.${p.book}`, 0, p.from);
    return Object.fromEntries(Object.entries(m).sort((a, b) => (scopeRank.get(a[0]) ?? 999) - (scopeRank.get(b[0]) ?? 999)));
  };
  const catalogEntries = entries.map(e => {
    const o = occ.get(e.id);
    const firstPlace = [o[0], ...passageStarts(e)].filter(Boolean).sort((a, b) => refSort(a).localeCompare(refSort(b)))[0];
    return {
      id: e.id, title: e.title, greek: e.greek, translit: e.translit, kind: e.kind, tags: e.tags,
      summary: plain(e.summary), aliases: e.aliases,
      lines: o.length, mentions: o.filter(x => x.via === 'grc').length,
      first: firstPlace ? `${firstPlace.book}.${firstPlace.n}` : null,
      firstKey: refSort(firstPlace),
      article: e.body.trim().length > 0 || e.notes.length > 0, words: pages.get(e.id).words,
      in: presenceOf(e), ...(e.notes.length ? { notes: e.notes.map(n => n.scope.id) } : {}),
      ...(pages.get(e.id).notes.some(n => n.summary) ? { noteSummary: Object.fromEntries(pages.get(e.id).notes.filter(n => n.summary).map(n => [n.scope, n.summary])) } : {}),
      ...(e.period ? { period: e.period } : {}), ...(e.mode ? { mode: e.mode } : {}), ...(e.narrator ? { narrator: e.narrator } : {}),
      ...(e.of.length ? { of: e.of } : {}), ...(e.participants.length ? { participants: e.participants } : {}),
      ...(e.refs.length ? { refs: e.refs } : {}), ...(e.passages.length ? { passages: e.passages.map(p => p.split('|')[0].trim()) } : {}), ...(e.source ? { source: e.source } : {}), ...(e.featured ? { featured: true } : {}),
      ...(e.sort !== null ? { sort: e.sort } : {}), ...(e.order !== null ? { order: e.order } : {}),
    };
  });

  const entryFiles = entries.map(e => {
    const page = pages.get(e.id);
    const o = occ.get(e.id);
    const speeches = speechesOf.get(e.id) ?? [];
    return {
      file: path.join('entries', `${e.id}.json`),
      data: {
        ...catalogEntries.find(c => c.id === e.id),
        summaryHtml: page.summaryHtml, html: page.html, headings: page.headings,
        notes: page.notes.map(({ quotes, ...n }) => n),
        quotes: Object.fromEntries(page.quotes.map(id => [id, quotePayload.get(id)])),
        occurrences: o.map(({ work, book, n, via, forms, grc, en, hg, he }) => ({ work, book, n, via, forms, grc, en, hg, he })),
        passages: passagesOf.get(e.id),
        relations: relationsOf.get(e.id),
        epithets: epithetsOf.get(e.id) ?? [], stories: storiesOf.get(e.id) ?? [], anecdotes: anecdotesOf.get(e.id) ?? [],
        speeches, addressed: addressedOf.get(e.id) ?? [],
        backlinks: [...backlinks.get(e.id)].sort(),
        noteBacklinks: [...noteBacklinks.get(e.id)].map(([id, sc]) => ({ id, scopes: [...sc].sort((a, b) => scopeRank.get(a) - scopeRank.get(b)) })).sort((a, b) => a.id.localeCompare(b.id)),
        stats: {
          lines: o.length, mentions: o.filter(x => x.via === 'grc').length,
          speeches: speeches.length, spoken: speeches.reduce((s, sp) => s + sp.to - sp.from + 1, 0),
        },
      },
    };
  });

  const quoteUse = new Map();
  for (const [id, page] of pages) for (const q of page.quotes) {
    if (!quoteUse.has(q)) quoteUse.set(q, []);
    quoteUse.get(q).push(id);
  }
  const quotesOut = Object.fromEntries([...registry.values()].map(q => {
    try {
      const p = payloadFor(q);
      return [q.id, { work: p.work, ref: p.ref, title: p.title, short: p.short, cite: p.cite, href: p.href, used: quoteUse.get(q.id) ?? [] }];
    }
    catch (err) { error(err.message); return [q.id, null]; }
  }).filter(([, v]) => v));

  const notesFor = w => {
    const file = path.join(w.dir, 'TRANSLATION.md');
    if (!fs.existsSync(file)) return '';
    const hooks = {
      link: t => { const id = resolveName(t); return id ? { id, label: byId.get(id).title, href: `#/entry/${id}` } : { missing: true, label: t }; },
      quote: spec => resolveQuote(spec, { file: 'TRANSLATION.md', work: w.id }),
      ref: spec => { const r = parseRef(spec, resolveWork, w.id); return { href: readerHref(r), label: shortCite(r) }; },
    };
    const md = fs.readFileSync(file, 'utf8').replace(/^# .*\n/, '');
    return renderMarkdown(md, hooks).html;
  };

  const periodCounts = new Map();
  for (const e of entries) if (e.kind === 'story') periodCounts.set(e.period, (periodCounts.get(e.period) ?? 0) + 1);

  const catalog = {
    bounties: readJson(path.join(ROOT, 'bounties/registry.json')),
    site: { title: 'GreekIndexBounty', greek: 'Πίνακες', built: new Date().toISOString() },
    authors: authors.map(a => ({ ...a, works: works.filter(w => w.author === a.id).map(w => w.id) })),
    works: works.map(w => ({
      id: w.id, author: w.author, title: w.title, greek: w.greek, genre: w.genre, meter: w.meter, date: w.date,
      summary: w.summary, citation: w.citation, display: w.display, bookCount: w.bookCount, books: w.books ?? {},
      available: [...w.texts.keys()], editions: w.editions.map(({ id, lang, label, name, credit }) => ({ id, lang, label, name, credit })),
      lines: [...w.texts.values()].reduce((s, t) => s + t.editions.grc.size, 0),
      notesHtml: notesFor(w),
    })),
    scopes: scopeList,
    kinds: kinds.map(k => ({ ...k, count: entries.filter(e => e.kind === k.id).length })),
    facets: [...tagCfg.facets, ...([...tagById.values()].some(t => t.facet === 'other') ? [{ id: 'other', label: 'Other', summary: '' }] : [])],
    tags: [...tagById.values()].map(t => ({ ...t, count: tagCounts.get(t.id) ?? 0 })),
    ages: periodCfg.ages,
    periods: periodCfg.periods.map(p => ({ ...p, count: periodCounts.get(p.id) ?? 0 })),
    modes: periodCfg.modes,
    entries: catalogEntries,
    stats: {
      entries: entries.length, articles: catalogEntries.filter(c => c.article).length, quotes: registry.size,
      passages: new Set(Object.values(quotesOut).map(q => `${q.work} ${q.ref}`)).size,
      lines: texts.reduce((s, t) => s + t.data.lines.length, 0), tokens: tokenTotal,
      stories: entries.filter(e => e.kind === 'story').length, tags: tagById.size,
      lemmas: allLemmas.size,
    },
  };

  // Content words that no entry covers yet: the index's to-do list, most frequent first.
  const unindexedWords = [...lemmaCoverage].filter(([, c]) => !c.indexed && ['noun', 'adj.', 'verb', 'name'].includes(c.pos))
    .sort((a, b) => b[1].count - a[1].count).map(([lemma, c]) => [lemma, c.gloss, c.pos, c.count]);
  const report = {
    built: catalog.site.built, ms: Date.now() - started, errors, warnings,
    unindexedNames: unindexed, unindexedWords, missingLinks, unsavedQuotes: unsaved, stats: catalog.stats,
  };

  if (write && !errors.length) {
    fs.rmSync(OUT, { recursive: true, force: true });
    const put = (file, data) => {
      const full = path.join(OUT, file);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, JSON.stringify(data));
    };
    put('catalog.json', catalog);
    put('quotes.json', quotesOut);
    put('report.json', report);
    texts.forEach(t => put(t.file, t.data));
    entryFiles.forEach(f => put(f.file, f.data));
  }

  const s = catalog.stats;
  log(`GreekIndexBounty: ${s.entries} entries (${s.articles} articles), ${s.stories} stories, ${s.quotes} quotes, ${s.lines} lines, ${s.lemmas} lemmas — ${report.ms} ms`);
  if (unindexed.length) log(`  ${unindexed.length} capitalized Greek words are not indexed (see site/data/report.json)`);
  if (missingLinks.length) log(`  ${missingLinks.length} [[links]] point to missing entries`);
  if (unsaved.length) log(`  ${unsaved.length} quotes are written as references; run "npm run quotes" to register them`);
  if (warnings.length) log(`  ${warnings.length} warnings`);
  for (const m of errors) log(`  ✗ ${m}`);
  return { errors, warnings, report, registry, unsaved };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const verbose = process.argv.includes('--verbose');
  const { errors, warnings, report } = build({ write: !process.argv.includes('--dry') });
  if (verbose) {
    for (const w of warnings) console.log(`  ! ${w}`);
    for (const u of report.unindexedNames) console.log(`  ? ${u}`);
    for (const m of report.missingLinks) console.log(`  → ${m}`);
  }
  process.exit(errors.length ? 1 : 0);
}
