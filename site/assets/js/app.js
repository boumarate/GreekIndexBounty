// GreekIndexBounty app shell: hash router, navigation bar, tab bar / sidebar, view lifecycle.
import { el, esc, icon, $ } from './lib/dom.js';
import * as store from './lib/store.js';
import { closeSheet } from './ui/components.js';
import { currentBook } from './lib/scope.js';

const VIEWS = {
  '': () => import('./views/library.js'),
  read: () => import('./views/reader.js'),
  work: () => import('./views/work.js'),
  book: () => import('./views/book.js'),
  index: () => import('./views/index.js'),
  entry: () => import('./views/entry.js'),
  myths: () => import('./views/myths.js'),
  tags: () => import('./views/tags.js'),
  search: () => import('./views/search.js'),
  vocab: () => import('./views/vocab.js'),
  about: () => import('./views/about.js'),
  bounties: () => import('./views/bounties.js'),
  quotes: () => import('./views/quotes.js'),
};

const TABS = [
  { id: 'library', label: 'Library', icon: 'library', href: '#/', roots: ['', 'read', 'work', 'book', 'vocab', 'about', 'quotes', 'bounties'] },
  { id: 'index', label: 'Index', icon: 'index', href: '#/index', roots: ['index'] },
  { id: 'myths', label: 'Myths', icon: 'amphora', href: '#/myths', roots: ['myths'] },
  { id: 'tags', label: 'Tags', icon: 'tag', href: '#/tags', roots: ['tags'] },
  { id: 'search', label: 'Search', icon: 'search', href: '#/search', roots: ['search'] },
];

const state = {
  tab: null,
  lastInTab: {},      // tab id → last hash visited in that tab
  history: [],        // visited hashes, for push/pop direction and back labels
  titles: {},         // hash → title (for back-button labels)
  scroll: {},         // hash → scrollY
  current: null,      // { hash, view }
  renderId: 0,
};

export function parseRoute(hash = location.hash) {
  const h = hash.replace(/^#/, '') || '/';
  const [path, query = ''] = h.split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { hash: `#${h}`, path, name: parts[0] ?? '', parts: parts.slice(1), query: Object.fromEntries(new URLSearchParams(query)) };
}

export function go(href, { replace = false } = {}) {
  const target = href.startsWith('#') ? href : `#${href}`;
  if (replace) { history.replaceState(null, '', target); route(); }
  else if (location.hash === target) route();
  else location.hash = target;
}

/** Update the query string of the current route without re-rendering. */
export function setQuery(params) {
  const r = parseRoute();
  const q = new URLSearchParams({ ...r.query, ...params });
  for (const [k, v] of [...q]) if (v === '' || v === 'undefined' || v === 'null') q.delete(k);
  const hash = `#${r.path}${q.toString() ? `?${q}` : ''}`;
  history.replaceState(null, '', hash);
  if (state.current) state.current.hash = hash;
  if (state.history.length) state.history[state.history.length - 1] = hash;
  const tab = tabFor(r.name);
  if (tab) state.lastInTab[tab] = hash;
}

function tabFor(name) {
  return TABS.find(t => t.roots.includes(name))?.id ?? null;
}

// ── Chrome ──────────────────────────────────────────────────────────────────
const navbar = $('#navbar'), navLeft = $('#nav-left'), navTitle = $('#nav-title'), navRight = $('#nav-right');
const host = $('#view');

function renderTabs() {
  $('#tabbar').innerHTML = TABS.map(t =>
    `<a class="tab" href="${t.href}" data-tab="${t.id}">${icon(t.icon)}<span>${t.label}</span></a>`).join('');
}

async function renderSidebar() {
  const cat = await store.catalog().catch(() => null);
  const count = { index: cat?.stats.entries, myths: cat?.stats.stories, tags: cat?.tags.filter(t => t.count).length };
  $('#sidebar').innerHTML = `
    <a class="brand" href="#/"><span class="brand-mark">γι<span class="brand-dot">.</span></span><span class="brand-sub">Greek Index<span>Bounty</span></span></a>
    <nav class="side-nav">${TABS.map(t => `<a class="side-link" href="${t.href}" data-tab="${t.id}">${icon(t.icon)}<span>${t.label}</span>${count[t.id] ? `<span class="count">${count[t.id]}</span>` : ''}</a>`).join('')}</nav>
    ${cat ? `<div><div class="side-heading">The project</div><nav class="side-nav"><div data-reading style="display:contents">${readingLinks(cat)}</div>
      <a class="side-link" href="#/bounties">${icon('sparkles')}<span>Bounties</span></a>
      <a class="side-link" href="#/quotes">${icon('quote')}<span>Quotes</span><span class="count">${cat.stats.passages ?? cat.stats.quotes}</span></a>
      <a class="side-link" href="#/about">${icon('info')}<span>About the project</span></a></nav></div>` : ''}
    <div class="side-foot">${cat ? `${cat.stats.lines.toLocaleString()} lines · ${cat.stats.entries.toLocaleString()} index entries · ${(cat.stats.passages ?? cat.stats.quotes).toLocaleString()} passages quoted` : ''}</div>`;
}

/**
 * The sidebar's reading rows: one row per work, not per book, and shortcuts for the book in hand (the
 * book being studied, else the last one read). Redrawn on every navigation, since both change.
 */
function readingLinks(cat) {
  const last = store.prefs.lastRead;
  const cur = currentBook(cat);
  return `${last && cat.by.works.get(last.work) ? `<a class="side-link" href="#/read/${esc(last.work)}/${last.book}?l=${last.n}">${icon('scroll')}<span>Continue: ${esc(cat.by.works.get(last.work).title)} ${last.book}.${last.n}</span></a>` : ''}
    ${cat.works.filter(w => w.available.length).map(w => `<a class="side-link" href="#/work/${w.id}">${icon('book')}<span>${esc(w.title)}</span><span class="count">${w.available.length} of ${w.bookCount}</span></a>`).join('')}
    ${cur ? `<a class="side-link" href="#/book/${esc(cur.work)}/${cur.book}">${icon('compass')}<span>Book ${cur.book} at a glance</span></a>
    <a class="side-link" href="#/vocab/${esc(cur.work)}/${cur.book}">${icon('textformat')}<span>Vocabulary · Book ${cur.book}</span></a>` : ''}`;
}

async function refreshReading() {
  const box = document.querySelector('#sidebar [data-reading]');
  const cat = box && await store.catalog().catch(() => null);
  if (cat) box.innerHTML = readingLinks(cat);
}

function markTab(tab) {
  document.querySelectorAll('[data-tab]').forEach(a => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

document.addEventListener('click', e => {
  const a = e.target.closest('a[data-tab]');
  if (!a || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  const tab = a.dataset.tab, t = TABS.find(x => x.id === tab);
  // Tapping the active tab pops to its root; tapping another tab restores where you were there.
  go(state.tab === tab ? t.href : (state.lastInTab[tab] ?? t.href));
});

let titleObserver = null;
function watchTitle(anchor) {
  titleObserver?.disconnect();
  navbar.classList.remove('show-title');
  if (!anchor) { navbar.classList.add('show-title'); return; }
  titleObserver = new IntersectionObserver(([entry]) => {
    navbar.classList.toggle('show-title', !entry.isIntersecting && entry.boundingClientRect.top < 60);
  }, { rootMargin: '-52px 0px 0px 0px' });
  titleObserver.observe(anchor);
}

const onScroll = () => navbar.classList.toggle('scrolled', window.scrollY > 4);
window.addEventListener('scroll', onScroll, { passive: true });

function setChrome(view, route, backHash) {
  navTitle.textContent = view.title ?? '';
  navbar.classList.toggle('wide', !!view.wide);
  navbar.classList.toggle('solid', !!view.solidBar);
  navLeft.innerHTML = '';
  if (backHash) {
    const label = state.titles[backHash] ?? 'Back';
    const b = el(`<button class="nav-btn nav-back" type="button">${icon('back')}<span>${esc(label.length > 18 ? 'Back' : label)}</span></button>`);
    b.addEventListener('click', () => history.back());
    navLeft.append(b);
  }
  navRight.innerHTML = '';
  for (const action of view.actions ?? []) {
    const b = el(`<button class="nav-btn" type="button" aria-label="${esc(action.label)}" title="${esc(action.label)}">${icon(action.icon)}</button>`);
    b.addEventListener('click', e => action.run(e.currentTarget));
    navRight.append(b);
  }
  document.title = view.title && route.name ? `${view.title} · GreekIndexBounty` : 'GreekIndexBounty';
}

// ── Routing ─────────────────────────────────────────────────────────────────
async function route() {
  const r = parseRoute();
  const id = ++state.renderId;
  closeSheet();
  document.querySelectorAll('.popover, .selection-bar').forEach(p => p.remove());

  // Direction: going to the previous entry of our own history is a pop.
  const prev = state.current?.hash;
  if (prev) state.scroll[prev] = window.scrollY;
  let back = false;
  const h = state.history;
  if (h.length >= 2 && h[h.length - 2] === r.hash) { h.pop(); back = true; }
  else if (h[h.length - 1] !== r.hash) h.push(r.hash);
  if (h.length > 60) h.splice(0, h.length - 60);

  const tab = tabFor(r.name);
  if (tab) state.tab = tab;
  else if (!state.tab) state.tab = r.name === 'entry' ? 'index' : 'library';
  state.lastInTab[state.tab] = r.hash;
  markTab(state.tab);

  const load = VIEWS[r.name];
  let view;
  try {
    if (!load) throw new Error(`There is no page at ${r.hash}.`);
    const mod = await load();
    view = await mod.render(r, { go, setQuery, back });
  } catch (err) {
    console.error(err);
    view = { title: 'Not found', el: el(`<div class="view"><div class="page-head"><h1 class="large-title">Something went wrong</h1></div><div class="error-box">${esc(err.message)}</div></div>`) };
  }
  if (id !== state.renderId) return; // a newer navigation won

  state.current?.view?.unmount?.();
  state.current = { hash: r.hash, view };
  state.titles[r.hash] = view.title ?? '';
  const isTabRoot = ['', 'index', 'myths', 'tags', 'search'].includes(r.name) && !r.parts.length;
  const backHash = !isTabRoot && h.length >= 2 ? h[h.length - 2] : null;

  host.replaceChildren(view.el);
  view.el.classList.add(back ? 'view-back' : 'view-enter');
  setChrome(view, r, backHash);

  const restore = back ? state.scroll[r.hash] : undefined;
  if (view.mount) await view.mount({ back, restore });
  else window.scrollTo(0, restore ?? 0);
  watchTitle(view.el.querySelector('[data-title-anchor]'));
  onScroll();
  refreshReading();
  if (!back) host.focus({ preventScroll: true });
}

window.addEventListener('hashchange', route);
window.addEventListener('keydown', e => {
  if (e.key === '/' && !e.target.closest('input, textarea') && !e.metaKey) { e.preventDefault(); go('#/search'); }
});

store.applyTheme();
renderTabs();
renderSidebar().then(() => markTab(state.tab));
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
route();
