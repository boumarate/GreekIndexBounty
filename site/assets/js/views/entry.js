import { el, esc, icon, on, plural, kindIcon } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { enhanceArticle } from '../ui/components.js';
import { entryRow } from './index.js';
import { ALL, within, label as scopeLabel, longLabel, chooseScope, remember, presentIn, scopeTree, treeScopes, pickerHtml } from '../lib/scope.js';

/** Wrap character ranges of `text` in <mark>. */
export function mark(text, ranges = []) {
  if (!ranges.length) return esc(text);
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  let out = '', i = 0;
  for (const [s, e] of sorted) {
    if (s < i) continue;
    out += esc(text.slice(i, s)) + `<mark>${esc(text.slice(s, e))}</mark>`;
    i = e;
  }
  return out + esc(text.slice(i));
}

const REL_LABEL = r => r.replace(/^./, c => c.toUpperCase());
const slug = t => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** A note shown under its own section heading has its headings lowered a level. */
const demote = html => html.replace(/<(\/?)h3\b/g, '<$1h4').replace(/<(\/?)h2\b/g, '<$1h3');

/** Previous and next story in mythic time: by period, then order within it, then place in the text. */
function storyNav(cat, e) {
  const periodIndex = new Map(cat.periods.map((p, i) => [p.id, i]));
  const stories = cat.entries.filter(x => x.kind === 'story').sort((a, b) =>
    (periodIndex.get(a.period) ?? 99) - (periodIndex.get(b.period) ?? 99) || (a.order ?? 999) - (b.order ?? 999) || a.firstKey.localeCompare(b.firstKey));
  const i = stories.findIndex(x => x.id === e.id);
  const row = (x, label) => x ? `<a class="row" href="#/entry/${esc(x.id)}"><span class="row-main"><span class="row-sub one" style="font-size:12px;color:var(--text-3)">${label} · ${esc(cat.by.periods.get(x.period)?.label ?? '')}</span><span class="row-title"><span>${esc(x.title)}</span></span></span>${icon('chevron', 'chev')}</a>` : '';
  const prev = row(stories[i - 1], 'Earlier in mythic time'), next = row(stories[i + 1], 'Later in mythic time');
  return prev || next ? `<section class="section"><div class="section-head"><h2 class="section-title">In mythic time</h2><a class="section-link" href="#/myths?p=${esc(e.period)}">Timeline</a></div><div class="list">${prev}${next}</div></section>` : '';
}
const OCC_PAGE = 12;

export async function render(route, { setQuery }) {
  const id = route.parts[0];
  const [cat, e] = await Promise.all([store.catalog(), store.entry(id)]);
  const record = cat.by.entries.get(id) ?? e;
  const kind = cat.by.kinds.get(e.kind);
  const tags = e.tags.map(t => cat.by.tags.get(t)).filter(Boolean);
  const period = e.period ? cat.by.periods.get(e.period) : null;
  const mode = e.mode ? cat.by.modes.get(e.mode) : null;
  const ent = x => cat.by.entries.get(x);
  const link = x => ent(x) ? `<a class="wl" href="#/entry/${esc(x)}">${esc(ent(x).title)}</a>` : esc(x);
  const work = wid => cat.by.works.get(wid);
  const notes = e.notes ?? [];

  // ── Scope ────────────────────────────────────────────────────────────────
  // Scope: author › work › book, shown when the entry appears in more than one place.
  const present = [...new Set([...Object.keys(record.in ?? {}), ...(record.notes ?? [])])];
  const tree = scopeTree(present, cat);
  const picking = present.length > 1;
  let S = picking ? chooseScope(route.query.in, treeScopes(tree)) : ALL;
  if (route.query.in && route.query.in === S) remember(S);
  const inS = (w, b) => S === ALL || within(`${w}.${b}`, S, cat);

  const storyMeta = e.kind === 'story' ? `<div class="entry-stats" style="gap:10px;align-items:center">
      ${period ? `<a class="period-badge" href="#/myths?p=${period.id}">${icon('amphora')}<span>${esc(period.label)}</span><span class="grc">${esc(period.greek)}</span></a>` : ''}
      ${mode ? `<span class="mode-pill ${mode.id}">${esc(mode.label)}</span>` : ''}
      ${e.narrator ? `<span>Told by ${link(e.narrator)}</span>` : ''}</div>` : '';
  const ofLine = e.of?.length && e.kind !== 'story'
    ? `<div class="entry-stats"><span>${e.kind === 'epithet' ? 'Epithet of' : 'About'} ${e.of.map(link).join(', ')}</span></div>` : '';

  const view = el(`<div class="view">
    <header class="entry-head">
      <div class="chips wrap">
        <a class="chip kind" href="#/index?k=${esc(e.kind)}" style="--h:${kind?.hue ?? 262}">${icon(kindIcon(kind?.icon))}${esc(kind?.one ?? e.kind)}</a>
        ${tags.map(t => `<a class="chip tag" href="#/tags/${esc(t.id)}">#${esc(t.label.toLowerCase())}</a>`).join('')}
      </div>
      <h1 class="large-title" data-title-anchor>${esc(e.title)}</h1>
      ${e.greek ? `<div class="entry-greek"><span class="grc" lang="grc">${esc(e.greek)}</span>${e.translit ? `<span class="rom">${esc(e.translit)}</span>` : ''}</div>` : ''}
      ${storyMeta}${ofLine}
      ${e.summaryHtml ? `<p class="lead article" style="font-size:18px">${e.summaryHtml}</p>` : ''}
      ${picking ? '<div class="scope-picker"></div>' : ''}
      <div class="entry-scoped-head"></div>
      ${e.source ? `<div class="entry-stats"><span>Source: <b>${esc(e.source)}</b></span></div>` : ''}
      <nav class="toc" aria-label="On this page"></nav>
    </header>
    <div class="entry-body"></div>
  </div>`);
  const scopedHead = view.querySelector('.entry-scoped-head');
  const picker = view.querySelector('.scope-picker');
  const lineCount = s => s === ALL ? record.lines : Object.entries(record.in ?? {}).reduce((t, [k, [c]]) => t + (within(k, s, cat) ? c : 0), 0);
  const drawPicker = () => { if (picker) picker.innerHTML = pickerHtml(tree, S, cat, { counts: lineCount }); };
  drawPicker();
  const body = view.querySelector('.entry-body');
  const toc = view.querySelector('.toc');
  let byBook = new Map();

  const occRow = o => {
    const w = work(o.work);
    const via = o.via === 'ref' ? '<span class="via">by reference</span>' : o.via === 'en' ? '<span class="via">in translation</span>' : '';
    return `<a class="occ" href="#/read/${o.work}/${o.book}?l=${o.n}"><span class="on">${esc(w?.citation.abbr ?? '')} ${o.book}.${o.n}${via}${o.forms?.length ? `<span style="font-weight:500;color:var(--text-2);font-family:var(--greek);letter-spacing:0;font-size:13px">${esc(o.forms.join(', '))}</span>` : ''}</span>
      <span class="g" lang="grc">${mark(o.grc, o.hg)}</span><span class="e">${mark(o.en, o.he)}</span></a>`;
  };
  const rowsOf = ids => ids.map(ent).filter(Boolean).map(x => entryRow(x, cat, { meta: 'none' })).join('');
  const section = (title, inner, extra = '') => inner ? `<section class="section"><div class="section-head"><h2 class="section-title">${title}</h2>${extra}</div>${inner}</section>` : '';
  const presentS = x => x && (S === ALL || presentIn(x, S, cat));

  const draw = () => {
    // Header: what the entry is in this scope, and how much of it there is.
    const occ = e.occurrences.filter(o => inS(o.work, o.book));
    const speeches = e.speeches.filter(sp => inS(sp.work, sp.book));
    const shown = S === ALL ? notes : notes.filter(n => within(n.scope, S, cat));
    const first = occ[0] ?? null;
    const stats = [
      occ.length ? `<span><b>${occ.length}</b> ${occ.length === 1 ? 'line' : 'lines'}${S !== ALL ? ` in ${esc(scopeLabel(S, cat))}` : ''}</span>` : '',
      (() => { const m = occ.filter(o => o.via === 'grc').length; return m && m !== occ.length ? `<span><b>${m}</b> named in Greek</span>` : ''; })(),
      speeches.length ? `<span>speaks <b>${speeches.reduce((s, sp) => s + sp.to - sp.from + 1, 0)}</b> lines in <b>${speeches.length}</b> ${speeches.length === 1 ? 'speech' : 'speeches'}</span>` : '',
      first ? `<span>first at <a href="#/read/${first.work}/${first.book}?l=${first.n}"><b>${first.book}.${first.n}</b></a></span>` : '',
    ].filter(Boolean).join('');
    const leads = S === ALL ? [] : shown.filter(n => n.scope === S && n.summaryHtml);
    scopedHead.innerHTML = `${leads.map(n => `<p class="scope-lead article"><span class="scope-tag">${esc(scopeLabel(n.scope, cat))}</span>${n.summaryHtml}</p>`).join('')}
      ${stats ? `<div class="entry-stats">${stats}</div>` : ''}
      ${S !== ALL && !occ.length && !shown.length ? `<p class="footnote-text">Not named in ${esc(longLabel(S, cat))}.</p>` : ''}`;

    // The article: whole, with the notes of the scope in place (everything, or an author or a work as a
    // whole); or, in a book, that book's notes first and the general article folded away.
    const noteSection = n => `<section class="note-part" data-fnscope data-scope="${esc(n.scope)}"><h2 id="in-${slug(scopeLabel(n.scope, cat))}">${esc(n.heading ?? `In ${scopeLabel(n.scope, cat)}`)}</h2>${demote(n.html)}</section>`;
    const base = e.html ?? '';
    // A note may be only a summary. At a book, that summary already leads the header; elsewhere it
    // stands as the note's section.
    const hasBody = n => !!n.html?.replace(/<[^>]+>/g, '').trim();
    let article;
    if (S === ALL || cat.by.scopes.get(S)?.kind !== 'book') {
      const parts = shown.map(n => hasBody(n) ? n : { ...n, html: n.summaryHtml ? `<p>${n.summaryHtml}</p>` : '' })
        .filter(hasBody).map(noteSection).join('');
      article = base.includes('notes-slot') ? base.replace('<div class="notes-slot"></div>', parts) : base + parts;
      article = article ? `<div class="article" data-fnscope>${article}</div>` : '';
    } else {
      const general = base.replace('<div class="notes-slot"></div>', '');
      const full = shown.filter(hasBody);
      const one = full.length === 1 && full[0].scope === S;
      const scoped = one
        ? `<div class="article note-part" data-fnscope><div class="scope-eyebrow">${esc(full[0].heading ?? `In ${scopeLabel(S, cat)}`)}</div>${full[0].html}</div>`
        : full.length ? `<div class="article">${full.map(noteSection).join('')}</div>` : '';
      const generalTitles = (e.headings ?? []).filter(h => h.level === 2).map(h => h.text);
      article = scoped && general.trim()
        ? `${scoped}<details class="general-part"><summary><span class="gp-title">About ${esc(e.title)}</span><span class="gp-sub">${esc(generalTitles.slice(0, 5).join(' · ') || 'The general article')}</span>${icon('chevron', 'chev')}</summary><div class="article" data-fnscope>${general}</div></details>`
        : scoped || (general.trim() ? `<div class="article" data-fnscope>${general}</div>` : '');
    }

    // Everything computed from the text, limited to the scope.
    const relGroups = new Map();
    for (const r of e.relations) {
      if (S !== ALL && r.scopes?.length && !r.scopes.some(s => within(s, S, cat))) continue;
      if (!relGroups.has(r.rel)) relGroups.set(r.rel, []);
      relGroups.get(r.rel).push(r);
    }
    const relations = [...relGroups].map(([rel, list]) => list.map((r, i) => {
      const t = ent(r.id);
      return `<a class="row" href="#/entry/${esc(r.id)}"><span class="row-main"><span class="row-sub one" style="font-size:12.5px;color:var(--text-3)">${i === 0 ? esc(REL_LABEL(rel)) : '&nbsp;'}</span>
        <span class="row-title"><span>${esc(t?.title ?? r.id)}</span>${t?.greek ? `<span class="row-greek">${esc(t.greek)}</span>` : ''}</span></span>
        ${r.refs?.length ? `<span class="row-meta" style="font-size:13px">${esc(r.refs.join(', '))}</span>` : ''}${icon('chevron', 'chev')}</a>`;
    }).join('')).join('');
    const speechRows = speeches.map(s => {
      const w = work(s.work);
      return `<a class="row speech-row" href="#/read/${s.work}/${s.book}?l=${s.from}-${s.to}"><span class="row-main">
        <span class="row-title"><span>To ${s.to_whom.map(x => esc(ent(x)?.title ?? x)).join(', ')}</span></span>
        <span class="row-sub one">${esc(w?.citation.abbr ?? '')} ${s.book}.${s.from}–${s.to} · ${plural(s.to - s.from + 1, 'line')}${s.kind ? ` · ${esc(s.kind)}` : ''}</span></span>${icon('chevron', 'chev')}</a>`;
    }).join('');
    const passages = (e.passages ?? []).filter(p => inS(p.work, p.book)).map(p => `<a class="row" href="${esc(p.href)}"><span class="row-main"><span class="row-title"><span>${esc(p.label || p.short)}</span></span>${p.label ? `<span class="row-sub one">${esc(p.short)}</span>` : ''}</span>${icon('chevron', 'chev')}</a>`).join('');
    const epithets = e.epithets.filter(x => presentS(ent(x)));
    const stories = e.stories.filter(x => presentS(ent(x)));
    const anecdotes = e.anecdotes.filter(x => { const a = ent(x); return a && (S === ALL || !Object.keys(a.in ?? {}).length || presentIn(a, S, cat)); });
    const mentioned = [...new Set([
      ...(e.backlinks ?? []).filter(x => presentS(ent(x))),
      ...(e.noteBacklinks ?? []).filter(b => S === ALL || b.scopes.some(s => within(s, S, cat))).map(b => b.id),
    ])].sort((a, b) => (ent(a)?.title ?? a).localeCompare(ent(b)?.title ?? b));
    byBook = new Map();
    for (const o of occ) { const k = `${o.work} ${o.book}`; if (!byBook.has(k)) byBook.set(k, []); byBook.get(k).push(o); }

    body.innerHTML = `${article}
      ${e.participants?.length ? section('In this story', `<div class="list">${rowsOf(e.participants)}</div>`) : ''}
      ${section('Key passages', passages ? `<div class="list">${passages}</div>` : '')}
      ${section('Family & relations', relations ? `<div class="list">${relations}</div>` : '')}
      ${section('Epithets', epithets.length ? `<div class="list">${rowsOf(epithets)}</div>` : '')}
      ${section('Stories', stories.length ? `<div class="list">${rowsOf(stories)}</div>` : '')}
      ${section('Speeches', speechRows ? `<div class="list">${speechRows}</div>` : '')}
      ${section('Anecdotes & notes', anecdotes.length ? `<div class="list">${rowsOf(anecdotes)}</div>` : '')}
      ${occ.length ? `<section class="section" id="occurrences"><div class="section-head"><h2 class="section-title">Occurrences</h2><span class="muted num" style="font-size:15px">${occ.length}</span></div>
        ${[...byBook].map(([k, list]) => {
          const [wid, b] = k.split(' ');
          return `<div class="section-title small" style="margin:0 4px 8px">${esc(work(wid)?.title ?? wid)} ${b}</div>
            <div class="list occ-list" data-total="${list.length}">${list.slice(0, OCC_PAGE).map(occRow).join('')}
            ${list.length > OCC_PAGE ? `<button class="more-btn" type="button" data-more="${esc(k)}">Show all ${list.length}</button>` : ''}</div>`;
        }).join('')}</section>` : ''}
      ${section('Mentioned in', mentioned.length ? `<div class="list">${rowsOf(mentioned)}</div>` : '')}
      ${e.kind === 'story' ? storyNav(cat, e) : ''}`;
    enhanceArticle(body, e);
    buildToc();
  };

  /** Contents: the article's top-level sections as they now stand (folded ones left out). */
  function buildToc() {
    const h2s = [...body.querySelectorAll('.article h2[id]')].filter(h => !h.closest('details:not([open])'));
    toc.innerHTML = h2s.length >= 3 ? h2s.map(h => `<a class="chip" href="#/entry/${esc(id)}?s=${esc(h.id)}" data-s="${esc(h.id)}">${esc(h.textContent)}</a>`).join('') : '';
    toc.hidden = h2s.length < 3;
  }

  on(view, 'click', '[data-more]', (ev, b) => {
    const list = byBook.get(b.dataset.more);
    b.parentElement.innerHTML = list.map(occRow).join('');
  });
  on(view, 'click', '.toc [data-s]', (ev, a) => {
    ev.preventDefault();
    scrollToSection(a.dataset.s);
  });
  on(view, 'click', '.scope-chip', (ev, b) => {
    if (b.dataset.scope === S) return;
    S = b.dataset.scope;
    remember(S);
    setQuery({ in: S === ALL ? '' : S, s: '' });
    drawPicker();
    draw();
  });
  view.addEventListener('toggle', ev => { if (ev.target.matches?.('details.general-part')) buildToc(); }, true);
  function scrollToSection(s) {
    const h = view.querySelector(`#${CSS.escape(s)}`);
    if (!h) return;
    const closed = h.closest('details:not([open])');
    if (closed) closed.open = true;
    window.scrollTo({ top: h.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
  }

  draw();
  return {
    title: e.title,
    el: view,
    mount: ({ restore }) => {
      if (restore !== undefined) window.scrollTo(0, restore);
      else if (route.query.s) requestAnimationFrame(() => scrollToSection(route.query.s));
      else window.scrollTo(0, 0);
    },
  };
}
