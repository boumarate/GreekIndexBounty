import { el, esc, icon, on, debounce } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { segmented } from '../ui/components.js';
import { normalize, hasGreek } from '../lib/greek.js';

const POS_GROUPS = [
  ['all', 'All'], ['noun', 'Nouns'], ['verb', 'Verbs'], ['adj.', 'Adjectives'], ['name', 'Names'], ['other', 'Other'],
];

export async function render(route, { setQuery }) {
  const [workId, bookStr] = route.parts;
  const book = Number(bookStr);
  const [cat, text] = await Promise.all([store.catalog(), store.text(workId, book)]);
  const work = cat.by.works.get(workId);
  let pos = route.query.pos ?? 'all';
  let q = route.query.q ?? '';
  let order = route.query.order ?? 'freq';
  // Words the work has not used in an earlier book (every word is new in the first book).
  const hasEarlier = (work.available ?? []).some(b => b < book);
  let fresh = hasEarlier && route.query.new === '1';
  const newCount = text.lemmas.filter(l => l[4]).length;

  // Part of speech per lemma, from its most common analysis.
  const posOf = new Map();
  for (const [l, , p] of text.lex) if (!posOf.has(l)) posOf.set(l, p.split(' · ')[0]);
  const group = l => {
    const p = posOf.get(l) ?? '';
    if (p === 'noun' || p === 'verb' || p === 'adj.' || p === 'name') return p;
    return 'other';
  };
  const max = text.lemmas[0]?.[2] ?? 1;
  const tokens = text.lines.reduce((s, l) => s + l.tk.length, 0);

  const view = el(`<div class="view">
    <header class="page-head" style="padding-bottom:8px">
      <div class="eyebrow">${esc(work.title)} · Book ${book}</div>
      <h1 class="large-title" data-title-anchor>Vocabulary</h1>
      <p class="page-sub">${text.lemmas.length.toLocaleString()} dictionary words make up the ${tokens.toLocaleString()} words of the book. The ${Math.min(100, text.lemmas.length)} most common cover ${Math.round(100 * text.lemmas.slice(0, 100).reduce((s, l) => s + l[2], 0) / tokens)}% of the text.</p>
    </header>
    <div class="index-tools">
      <label class="search-field" for="vocab-q">${icon('search')}<input id="vocab-q" type="search" placeholder="Filter by Greek or English" value="${esc(q)}" autocomplete="off"></label>
      <div class="chips" role="group" aria-label="Part of speech">${POS_GROUPS.map(([v, l]) => `<button class="chip" type="button" data-pos="${v}" aria-pressed="${pos === v}">${l}</button>`).join('')}${hasEarlier ? `<button class="chip" type="button" data-new aria-pressed="${fresh}">New in Book ${book} <span class="n">${newCount}</span></button>` : ''}</div>
      <div data-seg></div>
    </div>
    <div class="list vocab"></div>
  </div>`);
  const list = view.querySelector('.vocab');

  const draw = () => {
    let items = text.lemmas.filter(l => (pos === 'all' || group(l[0]) === pos) && (!fresh || l[4]));
    if (q) items = items.filter(l => hasGreek(q) ? normalize(l[0]).includes(normalize(q)) : l[1].toLowerCase().includes(q.toLowerCase()));
    if (order === 'alpha') items = [...items].sort((a, b) => normalize(a[0]).localeCompare(normalize(b[0]), 'el'));
    list.innerHTML = items.slice(0, 600).map(l => `<a class="row" href="#/search?lemma=${encodeURIComponent(l[0])}">
      <span class="row-main"><span class="row-title"><span class="grc">${esc(l[0])}</span><span class="row-greek" style="font-family:var(--ui);font-size:15px">${esc(l[1])}</span></span>
      <span class="freq-bar"><i style="width:${Math.max(2, (100 * l[2]) / max)}%"></i></span></span>
      <span class="row-meta">${l[2]}</span>${icon('chevron', 'chev')}</a>`).join('') || '<div class="list-empty">No words match.</div>';
  };
  view.querySelector('[data-seg]').append(segmented([['freq', 'By frequency'], ['alpha', 'Alphabetical']], order, v => { order = v; setQuery({ order: v === 'freq' ? '' : v }); draw(); }, 'Order'));
  on(view, 'click', '[data-pos]', (e, b) => {
    pos = b.dataset.pos;
    view.querySelectorAll('[data-pos]').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    setQuery({ pos: pos === 'all' ? '' : pos }); draw();
  });
  on(view, 'click', '[data-new]', (e, b) => {
    fresh = !fresh;
    b.setAttribute('aria-pressed', String(fresh));
    setQuery({ new: fresh ? '1' : '' }); draw();
  });
  view.querySelector('#vocab-q').addEventListener('input', debounce(e => { q = e.target.value.trim(); setQuery({ q }); draw(); }, 100));
  draw();
  return { title: 'Vocabulary', el: view };
}
