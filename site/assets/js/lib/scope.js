// Scopes: the part of the library an article is studied at. An author ("homer"), a work ("homer.iliad"),
// or a book of a work ("homer.iliad.2"); ALL is everything. The choice is remembered as the study scope.
import * as store from './store.js';

export const ALL = 'all';

const def = (cat, id) => cat.by.scopes.get(id);

/** Is scope s the same as S or inside it? */
export function within(s, S, cat) {
  if (S === ALL || s === S) return true;
  for (let p = def(cat, s)?.parent; p; p = def(cat, p)?.parent) if (p === S) return true;
  return false;
}

export const bookScope = (work, book) => `${work}.${book}`;
export const label = (S, cat) => S === ALL ? 'All' : def(cat, S)?.label ?? S;
export const longLabel = (S, cat) => S === ALL ? 'Everything' : def(cat, S)?.long ?? def(cat, S)?.label ?? S;

/** Is a catalog entry present in scope S (it occurs there, or has a note or passage there)? */
export function presentIn(e, S, cat) {
  if (S === ALL) return true;
  return Object.keys(e.in ?? {}).some(s => within(s, S, cat)) || (e.notes ?? []).some(s => within(s, S, cat));
}

/** Lines a catalog entry occurs in within scope S. */
export function linesIn(e, S, cat) {
  if (S === ALL) return e.lines;
  let n = 0;
  for (const [s, [c]] of Object.entries(e.in ?? {})) if (within(s, S, cat)) n += c;
  return n;
}

/** Sort key of a catalog entry's first appearance within scope S. */
export function firstKeyIn(e, S, cat) {
  if (S === ALL) return e.firstKey;
  for (const [s, [, first]] of Object.entries(e.in ?? {})) {
    if (!within(s, S, cat)) continue;
    const d = def(cat, s);
    return `${d?.work ?? s} ${String(d?.book ?? 0).padStart(3, '0')}.${String(first || 99999).padStart(5, '0')}`;
  }
  return '~';
}

/** The scope to show: an explicit ?in=, else the remembered study scope, else everything. */
export function chooseScope(requested, available) {
  if (requested && (requested === ALL || available.includes(requested))) return requested;
  const pref = store.prefs.scope;
  return pref && available.includes(pref) ? pref : ALL;
}

export function remember(S) { store.setPref('scope', S); }

/** The book in hand: the book being studied, else the last one read, else the newest available. */
export function currentBook(cat) {
  const d = cat.by.scopes.get(store.prefs.scope);
  if (d?.kind === 'book') return { work: d.work, book: d.book };
  const last = store.prefs.lastRead;
  if (last && cat.by.works.get(last.work)?.available.includes(last.book)) return { work: last.work, book: last.book };
  const w = cat.works.find(x => x.available.length);
  return w ? { work: w.id, book: w.available.at(-1) } : null;
}

/**
 * The picker's tree for a set of present scopes: the authors present, each author's works, and each
 * work's books, in library order. A scope's ancestors count as present (a Book 3 note puts its entry
 * in the Iliad and in Homer too).
 */
export function scopeTree(present, cat) {
  const def = id => cat.by.scopes.get(id);
  const rank = new Map(cat.scopes.map((s, i) => [s.id, i]));
  const sorted = xs => [...xs].sort((a, b) => (rank.get(a) ?? 999) - (rank.get(b) ?? 999));
  const authors = new Map(), works = new Map();
  const addAuthor = a => { if (!authors.has(a)) authors.set(a, new Set()); return authors.get(a); };
  const addWork = w => {
    if (!works.has(w)) { works.set(w, new Set()); const a = def(w)?.parent; if (a) addAuthor(a).add(w); }
    return works.get(w);
  };
  for (const s of present) {
    const d = def(s);
    if (d?.kind === 'book') addWork(d.work).add(s);
    else if (d?.kind === 'work') addWork(s);
    else if (d?.kind === 'author') addAuthor(s);
  }
  return {
    authors: sorted(authors.keys()),
    works: new Map([...authors].map(([a, ws]) => [a, sorted(ws)])),
    books: new Map([...works].map(([w, bs]) => [w, sorted(bs)])),
  };
}

/** Every scope the picker can land on, for validating ?in= and the remembered scope. */
export const treeScopes = tree => [...tree.authors, ...[...tree.works.values()].flat(), ...[...tree.books.values()].flat()];

/**
 * Up to three rows, one per level: All and the authors; then the chosen author's works, led by
 * "About" (the author as a whole); then the chosen work's books by number, led by "About" (the work
 * as a whole). A row appears once its parent is chosen, so the rows read as a path: Homer › Iliad › 3.
 */
export function pickerHtml(tree, S, cat, { counts = () => 0, all = 'All', aboutAuthor = 'About', aboutWork = 'About' } = {}) {
  const def = id => cat.by.scopes.get(id);
  const e = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const on = id => S !== ALL && (S === id || within(S, id, cat));
  const name = id => def(id)?.label ?? id;
  const chip = (id, label, selected, n = 0, attrs = '') =>
    `<button class="scope-chip" type="button" role="tab" data-scope="${e(id)}" aria-selected="${selected}"${attrs}>${label}${n ? `<span class="n">${n}</span>` : ''}</button>`;
  const row = (cls, label, chips) => `<div class="scope-bar${cls}" role="tablist" aria-label="${e(label)}">${chips.join('')}</div>`;
  const author = tree.authors.find(on);
  const works = author ? tree.works.get(author) ?? [] : [];
  const work = works.find(on);
  const books = work ? tree.books.get(work) ?? [] : [];
  return [
    row('', 'Author', [chip(ALL, e(all), S === ALL, counts(ALL)), ...tree.authors.map(a => chip(a, e(name(a)), on(a), counts(a)))]),
    author ? row(' works', `${name(author)}, by work`, [chip(author, e(aboutAuthor), S === author, 0, ` title="${e(name(author))} as a whole"`),
      ...works.map(w => chip(w, e(name(w)), on(w), counts(w)))]) : '',
    work ? row(' books', `${name(work)}, by book`, [chip(work, e(aboutWork), S === work, 0, ` title="${e(name(work))} as a whole"`),
      ...books.map(b => chip(b, e(def(b)?.book ?? b), S === b, 0, ` aria-label="Book ${e(def(b)?.book ?? '')}" title="${e(def(b)?.long ?? b)}"`))]) : '',
  ].join('');
}
