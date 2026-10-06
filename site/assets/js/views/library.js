import { el, esc, icon } from '../lib/dom.js';
import * as store from '../lib/store.js';
export const BOOK_LETTERS = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';

export async function render() {
  const cat = await store.catalog();
  const units = cat.bounties.units;
  const open = units.filter(b => b.status === 'open');
  const books = cat.works.reduce((n, w) => n + w.available.length, 0);
  const last = store.prefs.lastRead;
  const lastWork = last && cat.by.works.get(last.work);
  const canResume = lastWork?.available.includes(last.book);
  const view = el(`<div class="view library-view">
    <header class="page-head library-hero">
      <div class="eyebrow"><span class="status-dot"></span> An open library, built together</div>
      <h1 class="large-title" data-title-anchor>Every word.<br><span>A world to discover.</span></h1>
      <p class="page-sub">Greek literature, carefully translated and deeply connected. One book at a time, from the first line to the smallest detail.</p>
      <div class="btn-row"><a class="btn" href="#/bounties">Explore the bounties ${icon('arrow')}</a><a class="btn plain" href="#/about">How it works ${icon('chevron')}</a></div>
    </header>
    <div class="library-metrics" aria-label="Library progress">
      <div><strong>${books}</strong><span>books available</span></div>
      <div><strong>${cat.stats.articles.toLocaleString()}</strong><span>articles written</span></div>
      <div><strong>${open.length}</strong><span>open bounties</span></div>
      <div><strong>${open.reduce((n, b) => n + b.rewardSats, 0).toLocaleString()} <small>sats</small></strong><span>offered · ${open.some(b => b.funding === 'pending') ? 'funding pending' : 'see bounty terms'}</span></div>
    </div>
    ${canResume ? `<a class="continue" href="#/read/${esc(last.work)}/${last.book}?l=${last.n}">${icon('book')}<span class="row-main"><span class="eyebrow">Continue reading</span>${esc(lastWork.title)} ${last.book}.${last.n}</span>${icon('chevron')}</a>` : ''}
    <section class="section">
      <div class="section-head"><h2 class="section-title">The library</h2><span class="section-caption">Beginning with Homer</span></div>
      ${cat.works.map(w => `<article class="work-card collection-card">
        <div class="work-head"><div class="volume-mark" aria-hidden="true">${esc(w.greek?.[0] ?? 'Α')}</div><div class="row-main"><div class="eyebrow">${esc(cat.by.authors.get(w.author)?.name)} · ${esc(w.genre)}</div><h3 class="work-title">The ${esc(w.title)} <span lang="grc">${esc(w.greek)}</span></h3><p class="muted">${w.bookCount} books. A complete translation, lexicon, and connected index.</p></div><span class="status-pill">${w.available.length} / ${w.bookCount} ready</span></div>
        <div class="book-grid" aria-label="Books of the ${esc(w.title)}">${Array.from({ length: w.bookCount }, (_, i) => {
          const b = i + 1, ready = w.available.includes(b);
          return `<a class="book-tile ${ready ? 'available' : 'planned'}" href="${ready ? `#/read/${w.id}/${b}` : `#/bounties?work=${encodeURIComponent(w.id)}&unit=${b}`}" aria-label="${esc(w.title)} Book ${b}: ${ready ? 'read now' : 'view bounty'}"><span lang="grc">${BOOK_LETTERS[i] ?? b}</span><span class="bn">${String(b).padStart(2, '0')}</span></a>`;
        }).join('')}</div>
        <div class="collection-foot"><span>${w.available.length ? `${w.available.length} books ready to read` : 'The shelves are ready. The first book is still to come.'}</span><a href="#/work/${w.id}">View collection ${icon('chevron')}</a></div>
      </article>`).join('')}
    </section>
    <section class="section"><div class="section-head"><h2 class="section-title">More than a translation</h2></div>
      <div class="discovery-grid">
        <a href="#/index">${icon('index')}<h3>A connected index</h3><p>People, places, ideas, and every detail worth understanding.</p><span>${cat.stats.entries} entries ${icon('chevron')}</span></a>
        <a href="#/tags">${icon('tag')}<h3>Follow a thread</h3><p>Explore language, mythology, and the texture of everyday life.</p><span>${cat.tags.length} starting tags ${icon('chevron')}</span></a>
        <a href="#/myths">${icon('amphora')}<h3>Stories within stories</h3><p>Trace the myths remembered, retold, and woven through the text.</p><span>Explore the timeline ${icon('chevron')}</span></a>
      </div>
    </section>
    <footer class="library-footer"><span>Built on Pinakes. Made for close reading.</span><a href="${esc(cat.bounties.repository)}">View on GitHub ${icon('arrow')}</a></footer>
  </div>`);
  return { title: 'Library', el: view };
}
