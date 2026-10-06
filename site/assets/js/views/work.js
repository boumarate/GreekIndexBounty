import { el, esc, icon } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { BOOK_LETTERS } from './library.js';

export async function render(route) {
  const cat = await store.catalog();
  const w = cat.by.works.get(route.parts[0]);
  if (!w) throw new Error(`No work called “${route.parts[0]}”.`);
  const author = cat.by.authors.get(w.author);
  const view = el(`<div class="view">
    <header class="page-head">
      <div class="eyebrow">${esc(author?.name ?? '')}</div>
      <h1 class="large-title" data-title-anchor>${esc(w.title)} <span style="font-family:var(--greek-display);font-weight:400;color:var(--text-2)">${esc(w.greek)}</span></h1>
      <p class="page-sub">${esc(w.summary)}</p>
    </header>
    <dl class="kv">
      <dt>Genre</dt><dd>${esc(w.genre)}</dd><dt>Meter</dt><dd>${esc(w.meter)}</dd><dt>Date</dt><dd>${esc(w.date)}</dd>
      <dt>Books</dt><dd>${w.bookCount} (${w.available.length} available)</dd><dt>Citation</dt><dd>${esc(w.citation.abbr)} book.line, e.g. ${esc(w.citation.abbr)} 1.1</dd>
    </dl>
    <section class="section"><div class="section-head"><h2 class="section-title small">Books</h2></div>
      <div class="list">${Array.from({ length: w.bookCount }, (_, i) => {
        const b = i + 1, ok = w.available.includes(b), meta = w.books[b] ?? {};
        const inner = `<span class="book-letter" style="width:36px;height:44px;font-size:22px;${ok ? '' : 'opacity:.45'}">${BOOK_LETTERS[i]}</span>
          <span class="row-main"><span class="row-title"><span>Book ${b}${meta.title ? ` · ${esc(meta.title)}` : ''}</span>${meta.greek ? `<span class="row-greek">${esc(meta.greek)}</span>` : ''}</span>
          <span class="row-sub">${ok ? esc(meta.summary ?? '') : 'Not yet translated'}</span></span>`;
        return ok ? `<a class="row" href="#/read/${w.id}/${b}">${inner}${icon('chevron', 'chev')}</a>` : `<div class="row" style="color:var(--text-3)">${inner}</div>`;
      }).join('')}</div>
    </section>
    <section class="section"><div class="section-head"><h2 class="section-title small">Editions</h2></div>
      <div class="list">${w.editions.map(e => `<div class="row"><span class="row-main"><span class="row-title"><span>${esc(e.label)} · ${esc(e.name)}</span></span><span class="row-sub">${esc(e.credit)}</span></span></div>`).join('')}</div>
      <p class="footnote-text"><a href="#/about">Translation conventions and notes</a></p>
    </section>
  </div>`);
  return { title: w.title, el: view };
}
