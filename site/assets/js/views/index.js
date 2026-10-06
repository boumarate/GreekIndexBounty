import { el, esc, icon, on, debounce, kindIcon } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { segmented } from '../ui/components.js';
import { normalize, transliterate, hasGreek, foldLatin } from '../lib/greek.js';
import { ALL, presentIn, linesIn, firstKeyIn, remember, label as scopeLabel, scopeTree, treeScopes, pickerHtml } from '../lib/scope.js';

/** Catalog order: ignore leading punctuation and articles ("The sea" files under S). */
export const sortKey = t => t.normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/^[^A-Za-z0-9]+/, '').replace(/^(the|a|an)\s+/i, '');
const letterOf = t => sortKey(t)[0]?.toUpperCase() || '#';

export function entryRow(e, cat, { meta = 'lines', count, first } = {}) {
  const k = cat.by.kinds.get(e.kind);
  const right = meta === 'first' ? (first ?? e.first ?? '') : meta === 'none' ? '' : ((count ?? e.lines) || '');
  return `<a class="row has-icon" href="#/entry/${esc(e.id)}"><span class="row-icon" style="--h:${k?.hue ?? 262}">${icon(kindIcon(k?.icon))}</span>
    <span class="row-main"><span class="row-title"><span>${esc(e.title)}</span>${e.greek ? `<span class="row-greek">${esc(e.greek)}</span>` : ''}</span>
    ${e.summary ? `<span class="row-sub one">${esc(e.summary)}</span>` : ''}</span>
    ${right !== '' ? `<span class="row-meta">${esc(String(right))}</span>` : ''}${icon('chevron', 'chev')}</a>`;
}

/** Score an entry against a query (English, Greek, or transliterated Greek). 0 = no match. */
export function matchEntry(e, q) {
  if (!q) return 1;
  const t = e.title.toLowerCase(), ql = q.toLowerCase();
  if (hasGreek(q)) {
    const g = normalize(e.greek ?? ''), nq = normalize(q);
    return g.startsWith(nq) ? 90 : g.includes(nq) ? 60 : 0;
  }
  if (t === ql) return 100;
  if (t.startsWith(ql)) return 90;
  if (t.split(/[\s(,-]+/).some(w => w.startsWith(ql))) return 75;
  if (e.aliases?.some(a => a.toLowerCase().startsWith(ql))) return 70;
  const tr = foldLatin(transliterate(e.greek ?? '')), fq = foldLatin(ql);
  if (fq.length > 2 && tr.startsWith(fq)) return 65;
  if (t.includes(ql)) return 50;
  if (e.aliases?.some(a => a.toLowerCase().includes(ql))) return 40;
  if (ql.length > 3 && e.summary?.toLowerCase().includes(ql)) return 15;
  return 0;
}

export async function render(route, { setQuery }) {
  const cat = await store.catalog();
  let kind = route.query.k ?? 'all';
  let q = route.query.q ?? '';
  let sort = route.query.sort ?? store.prefs.indexSort ?? 'az';
  const kinds = cat.kinds.filter(k => k.count);
  // Scope: every entry, or only those present in one work or book.
  const tree = scopeTree(cat.scopes.filter(s => s.kind === 'book').map(s => s.id), cat);
  const scopeChoices = [ALL, ...treeScopes(tree)];
  const manyBooks = [...tree.books.values()].flat().length > 1;
  let S = route.query.in ?? store.prefs.scope ?? ALL;
  if (!scopeChoices.includes(S)) S = ALL;
  const inScope = () => cat.entries.filter(e => presentIn(e, S, cat));

  const view = el(`<div class="view">
    <header class="page-head" style="padding-bottom:6px">
      <h1 class="large-title" data-title-anchor>Index</h1>
      <p class="page-sub"></p>
    </header>
    <div class="index-tools">
      ${manyBooks ? '<div class="scope-picker"></div>' : ''}
      <label class="search-field" for="index-q">${icon('search')}<input id="index-q" type="search" placeholder="Filter the index" value="${esc(q)}" autocomplete="off" enterkeyhint="search"><button class="clear" type="button" aria-label="Clear" ${q ? '' : 'hidden'}>${icon('x')}</button></label>
      <div class="chips" role="group" aria-label="Kinds">
        <button class="chip" type="button" data-k="all" aria-pressed="${kind === 'all'}">All <span class="n" data-n="all"></span></button>
        ${kinds.map(k => `<button class="chip" type="button" data-k="${k.id}" aria-pressed="${kind === k.id}">${esc(k.label)} <span class="n" data-n="${k.id}"></span></button>`).join('')}
      </div>
      <div data-sort></div>
    </div>
    <div class="results"></div>
    <nav class="alpha" aria-hidden="true"></nav>
  </div>`);

  const results = view.querySelector('.results');
  const alpha = view.querySelector('.alpha');
  const input = view.querySelector('#index-q');
  const clear = view.querySelector('.clear');

  const counts = () => {
    const pool = inScope();
    view.querySelector('.page-sub').textContent = S === ALL
      ? `${cat.stats.entries.toLocaleString()} entries: every name, place, people, god and creature in the text, and the words, customs, stories and ideas around them.`
      : `${pool.length.toLocaleString()} entries present in ${scopeLabel(S, cat)}, of ${cat.stats.entries.toLocaleString()} in the index.`;
    view.querySelectorAll('[data-n]').forEach(n => { n.textContent = (n.dataset.n === 'all' ? pool : pool.filter(e => e.kind === n.dataset.n)).length; });
    view.querySelectorAll('.chip[data-k]').forEach(c => { c.hidden = c.dataset.k !== 'all' && c.dataset.k !== kind && !pool.some(e => e.kind === c.dataset.k); });
  };
  const draw = () => {
    const lines = e => linesIn(e, S, cat);
    const row = (e, opts) => entryRow(e, cat, { ...opts, count: lines(e), first: S === ALL ? e.first : (() => { const k = firstKeyIn(e, S, cat); const m = k.match(/(\d+)\.(\d+)$/); return m ? `${+m[1]}.${+m[2]}` : ''; })() });
    let list = inScope().filter(e => kind === 'all' || e.kind === kind);
    if (q) list = list.map(e => [e, matchEntry(e, q)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1] || a[0].title.localeCompare(b[0].title)).map(([e]) => e);
    else if (sort === 'freq') list.sort((a, b) => lines(b) - lines(a) || a.title.localeCompare(b.title));
    else if (sort === 'text') list.sort((a, b) => firstKeyIn(a, S, cat).localeCompare(firstKeyIn(b, S, cat)) || a.title.localeCompare(b.title));
    else list.sort((a, b) => sortKey(a.title).localeCompare(sortKey(b.title), 'en', { sensitivity: 'base' }));

    if (!cat.entries.length) { results.innerHTML = `<div class="notice-card"><h2>The index starts here.</h2><p>No researched articles have been submitted yet. Each accepted book will add new articles and connect them to the Greek text.</p><p><a href="#/bounties">Explore the research bounties →</a></p></div>`; alpha.innerHTML = ''; return; }
    if (!list.length) { results.innerHTML = `<div class="list"><div class="list-empty">Nothing in the index matches “${esc(q)}”. Try Greek (μῆνις), a transliteration (menis), or <a href="#/search?q=${encodeURIComponent(q)}">search the text</a>.</div></div>`; alpha.innerHTML = ''; return; }

    if (!q && sort === 'az') {
      const groups = new Map();
      for (const e of list) { const L = letterOf(e.title); if (!groups.has(L)) groups.set(L, []); groups.get(L).push(e); }
      results.innerHTML = [...groups].map(([L, items]) => `<div class="letter-head" id="letter-${L}">${L}</div><div class="list">${items.map(e => row(e)).join('')}</div>`).join('');
      alpha.innerHTML = [...groups.keys()].map(L => `<span data-l="${L}">${L}</span>`).join('');
    } else {
      results.innerHTML = `<div class="list" style="margin-top:8px">${list.map(e => row(e, { meta: sort === 'text' && !q ? 'first' : 'lines' })).join('')}</div>
        <p class="footnote-text">${list.length.toLocaleString()} ${list.length === 1 ? 'entry' : 'entries'}${sort === 'freq' && !q ? ', by number of lines in which each appears' : ''}${sort === 'text' && !q ? ', in order of first appearance' : ''}.</p>`;
      alpha.innerHTML = '';
    }
  };

  const sync = () => setQuery({ k: kind === 'all' ? '' : kind, q, sort: sort === 'az' ? '' : sort, in: S === ALL ? '' : S });
  const picker = view.querySelector('.scope-picker');
  const drawPicker = () => { if (picker) picker.innerHTML = pickerHtml(tree, S, cat, { all: 'All texts', aboutAuthor: 'All works', aboutWork: 'All books' }); };
  drawPicker();
  on(view, 'click', '.scope-chip', (e, b) => {
    S = b.dataset.scope;
    remember(S);
    drawPicker(); counts(); sync(); draw();
  });
  view.querySelector('[data-sort]').append(segmented([['az', 'A–Z'], ['freq', 'Most frequent'], ['text', 'In the text']], sort, v => {
    sort = v; store.setPref('indexSort', v); sync(); draw();
  }, 'Sort'));
  on(view, 'click', '.chip[data-k]', (e, b) => {
    kind = b.dataset.k;
    view.querySelectorAll('.chip[data-k]').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    sync(); draw();
  });
  input.addEventListener('input', debounce(() => { q = input.value.trim(); clear.hidden = !q; sync(); draw(); }, 90));
  clear.addEventListener('click', () => { input.value = ''; q = ''; clear.hidden = true; sync(); draw(); input.focus(); });

  // Alphabet scrubber: drag along the letters to jump.
  const scrub = e => {
    const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-l]');
    if (!t) return;
    const h = view.querySelector(`#letter-${t.dataset.l}`);
    if (h) window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 150);
  };
  alpha.addEventListener('pointerdown', e => { alpha.setPointerCapture(e.pointerId); scrub(e); });
  alpha.addEventListener('pointermove', e => { if (alpha.hasPointerCapture(e.pointerId)) scrub(e); });

  counts();
  draw();
  return { title: 'Index', el: view };
}
