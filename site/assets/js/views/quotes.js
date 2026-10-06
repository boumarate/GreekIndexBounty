// Every quoted passage, in text order: the articles that quote it, its card, and its {{quote:…}} tags.
import { el, esc, icon, on, debounce, copyText, plural } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { quoteCard, toast, openSheet } from '../ui/components.js';
import { normalize, hasGreek } from '../lib/greek.js';

const key = q => q.ref.split(/[.-]/).map(n => n.padStart(5, '0')).join('.');

/** Quotes of the same lines under different titles are one passage. The title most articles use leads. */
function passagesOf(quotes) {
  const byRef = new Map();
  for (const [id, v] of Object.entries(quotes)) {
    const k = `${v.work} ${v.ref}`;
    if (!byRef.has(k)) byRef.set(k, { work: v.work, ref: v.ref, short: v.short, href: v.href, variants: [] });
    byRef.get(k).variants.push({ id, title: v.title, used: v.used });
  }
  return [...byRef.values()].map(p => {
    p.variants.sort((a, b) => !a.title - !b.title || b.used.length - a.used.length || a.title.localeCompare(b.title));
    p.used = [...new Set(p.variants.flatMap(v => v.used))];
    p.title = p.variants[0].title;
    return p;
  }).sort((a, b) => a.work.localeCompare(b.work) || key(a).localeCompare(key(b)));
}

export async function render(route, { setQuery }) {
  const [cat, quotes] = await Promise.all([store.catalog(), store.quotes()]);
  let q = route.query.q ?? '';
  const list = passagesOf(quotes);
  const texts = new Map();
  for (const v of list) {
    const [book] = v.ref.split('.');
    const k = `${v.work}/${book}`;
    if (!texts.has(k)) texts.set(k, await store.text(v.work, +book));
  }
  const linesOf = v => {
    const [book, range] = v.ref.split('.');
    const [a, b = a] = range.split('-').map(Number);
    return texts.get(`${v.work}/${book}`).lines.filter(l => l.n >= a && l.n <= b).map(l => ({ n: `${book}.${l.n}`, grc: l.grc, en: l.en }));
  };
  const tagCount = Object.keys(quotes).length;

  const view = el(`<div class="view">
    <header class="page-head" style="padding-bottom:8px">
      <h1 class="large-title" data-title-anchor>Quotes</h1>
      <p class="page-sub">${plural(list.length, 'passage')} quoted in the articles, in the order of the text.${tagCount > list.length ? ' Some are quoted under more than one title.' : ''} Tap one to see it, copy its <code>{{quote:…}}</code> tag, or open it in the reader.</p>
    </header>
    <div class="index-tools"><label class="search-field" for="quote-q">${icon('search')}<input id="quote-q" type="search" placeholder="Filter by words, title, or line" value="${esc(q)}" autocomplete="off"></label></div>
    <div class="list quote-list"></div>
  </div>`);
  const host = view.querySelector('.quote-list');
  const title = id => cat.by.entries.get(id)?.title ?? id;
  const shown = [];

  const draw = () => {
    const needle = q.trim().toLowerCase();
    const rows = list.filter(p => {
      if (!needle) return true;
      const lines = linesOf(p);
      if (hasGreek(needle)) return lines.some(l => normalize(l.grc).includes(normalize(needle)));
      return p.short.toLowerCase().includes(needle) || p.variants.some(v => v.title.toLowerCase().includes(needle)) || lines.some(l => l.en.toLowerCase().includes(needle));
    });
    shown.length = 0;
    shown.push(...rows);
    host.innerHTML = rows.map((p, i) => {
      const first = linesOf(p)[0];
      const titled = p.variants.filter(v => v.title).length;
      return `<button class="row" type="button" data-p="${i}"><span class="row-main">
        <span class="row-sub one" style="font-size:12px;color:var(--text-3)">${esc(p.short)}${p.used.length ? ` · ${esc(p.used.slice(0, 3).map(title).join(', '))}${p.used.length > 3 ? ` +${p.used.length - 3}` : ''}` : ' · not used yet'}</span>
        <span class="row-title"><span>${esc(p.title || first?.en || p.short)}</span></span>
        ${p.title && first ? `<span class="row-sub one serif">${esc(first.en)}</span>` : ''}</span>
        ${titled > 1 ? `<span class="row-meta" style="font-size:13px" title="${titled} titles">${titled} titles</span>` : ''}${icon('chevron', 'chev')}</button>`;
    }).join('') || '<div class="list-empty">No quotes match.</div>';
  };

  on(view, 'click', '[data-p]', (e, b) => {
    const p = shown[+b.dataset.p];
    const lead = p.variants[0];
    const card = quoteCard({ id: lead.id, work: p.work, ref: p.ref, short: p.short, href: p.href, title: lead.title, cite: quotes[lead.id].cite, lines: linesOf(p) });
    const variants = p.variants.length > 1 ? `<div class="section-title small" style="margin:20px 4px 8px">Titles</div>
      <div class="list">${p.variants.map(v => `<button class="row" type="button" data-tag="${esc(v.id)}"><span class="row-main">
        <span class="row-title"><span>${v.title ? esc(v.title) : '<span class="muted">Untitled</span>'}</span></span>
        <span class="row-sub one">${v.used.length ? esc(v.used.map(title).join(', ')) : 'not used yet'}</span></span>
        <span class="row-meta" style="font-size:14px;color:var(--accent)">Copy tag</span></button>`).join('')}</div>` : '';
    const body = el(`<div>
      <div class="qhost"></div>
      <div class="btn-row" style="margin-top:4px"><button class="btn" type="button" data-tag="${esc(lead.id)}">${icon('quote')}Copy quote tag</button><a class="btn plain" href="${esc(p.href)}">${icon('book')}Read in context</a></div>
      ${variants}
      ${p.used.length ? `<div class="section-title small" style="margin:20px 4px 8px">Quoted in</div><div class="list">${p.used.map(id => `<a class="row" href="#/entry/${esc(id)}"><span class="row-main"><span class="row-title"><span>${esc(title(id))}</span></span></span>${icon('chevron', 'chev')}</a>`).join('')}</div>` : ''}
      <p class="footnote-text" style="margin-top:14px">Tag: <code style="user-select:all">{{quote:${esc(lead.id)}}}</code></p>
    </div>`);
    body.querySelector('.qhost').append(card);
    on(body, 'click', '[data-tag]', async (ev, t) => { if (await copyText(`{{quote:${t.dataset.tag}}}`)) toast('Quote tag copied'); });
    const sheet = openSheet({ title: lead.title || p.short, content: body });
    body.querySelectorAll('a').forEach(a => a.addEventListener('click', () => sheet.close(true)));
  });
  view.querySelector('#quote-q').addEventListener('input', debounce(e => { q = e.target.value; setQuery({ q }); draw(); }, 100));
  draw();
  return { title: 'Quotes', el: view };
}
