import { el, esc, icon, on, debounce, plural } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { segmented } from '../ui/components.js';
import { normalize, transliterate, hasGreek, foldLatin } from '../lib/greek.js';
import { entryRow, matchEntry } from './index.js';

const LIMIT = { index: 40, text: 120, words: 60 };

async function allTexts(cat) {
  const jobs = cat.works.flatMap(w => w.available.map(b => store.text(w.id, b).then(t => ({ work: w, book: b, text: t }))));
  return Promise.all(jobs);
}

function markEnglish(text, q) {
  if (!q) return esc(text);
  const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  let out = '', i = 0;
  for (const m of text.matchAll(re)) { out += esc(text.slice(i, m.index)) + `<mark>${esc(m[0])}</mark>`; i = m.index + m[0].length; }
  return out + esc(text.slice(i));
}

function markGreek(line, test) {
  return line.tk.map(([w, pre, post], k) => `${esc(pre)}${test(w, k) ? `<mark>${esc(w)}</mark>` : esc(w)}${esc(post)}`).join(' ');
}

export async function render(route, { setQuery }) {
  const cat = await store.catalog();
  let q = route.query.q ?? '';
  let scope = route.query.in ?? 'all';
  const lemma = route.query.lemma ?? '';
  const texts = await allTexts(cat);

  const view = el(`<div class="view">
    <header class="page-head" style="padding-bottom:10px">
      <h1 class="large-title" data-title-anchor>${lemma ? esc(lemma) : 'Search'}</h1>
      ${lemma ? '<p class="page-sub">Every line in which this word appears, in any form.</p>' : '<p class="page-sub">Names, Greek words (with or without accents, or transliterated: <i>menin</i>), and phrases in either language.</p>'}
    </header>
    ${lemma ? '' : `<div style="display:flex;flex-direction:column;gap:10px">
      <label class="search-field" for="search-q">${icon('search')}<input id="search-q" type="search" placeholder="μῆνις, Achilles, hecatomb…" value="${esc(q)}" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"><button class="clear" type="button" aria-label="Clear" ${q ? '' : 'hidden'}>${icon('x')}</button></label>
      <div data-seg></div></div>`}
    <div class="results"></div>
  </div>`);
  const results = view.querySelector('.results');
  const input = view.querySelector('#search-q');

  const lineRow = (t, line, gHtml, eHtml) => `<a class="occ" href="#/read/${t.work.id}/${t.book}?l=${line.n}">
    <span class="on">${esc(t.work.citation.abbr)} ${t.book}.${line.n}</span><span class="g" lang="grc">${gHtml}</span><span class="e">${eHtml}</span></a>`;

  function lemmaResults() {
    let html = '', count = 0;
    for (const t of texts) {
      const lx = new Set(t.text.lex.map((a, i) => a[0] === lemma ? i : -1).filter(i => i >= 0));
      if (!lx.size) continue;
      const lines = t.text.lines.filter(l => l.tk.some(tk => lx.has(tk[3])));
      count += lines.length;
      const gloss = t.text.lemmas.find(l => l[0] === lemma);
      html += `<div class="section-head" style="margin-top:8px"><h2 class="section-title small">${esc(t.work.title)} ${t.book}${gloss ? ` · “${esc(gloss[1])}” · ${plural(gloss[2], 'occurrence')}` : ''}</h2></div>
        <div class="list">${lines.map(l => lineRow(t, l, markGreek(l, (w, k) => lx.has(l.tk[k][3])), esc(l.en))).join('')}</div>`;
    }
    results.innerHTML = count ? html : `<div class="list"><div class="list-empty">No lines contain ${esc(lemma)}.</div></div>`;
  }

  function draw() {
    if (lemma) return lemmaResults();
    const query = q.trim();
    if (!query) {
      const recent = store.prefs.recent ?? [];
      results.innerHTML = `${recent.length ? `<div class="section-head" style="margin-top:18px"><h2 class="section-title small">Recent</h2></div>
        <div class="chips wrap">${recent.map(r => `<button class="chip" type="button" data-q="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}
        <div class="section-head" style="margin-top:22px"><h2 class="section-title small">Try</h2></div>
        <div class="chips wrap">${['μῆνις', 'menin', 'Thetis', 'hecatomb', 'ἄποινα', 'scepter', 'Olympus', 'honor', 'κύνεσσιν', 'rosy-fingered'].map(r => `<button class="chip" type="button" data-q="${esc(r)}">${esc(r)}</button>`).join('')}</div>`;
      return;
    }
    const greek = hasGreek(query);
    const nq = normalize(query);
    const fq = foldLatin(query);
    const parts = [];

    if (scope === 'all' || scope === 'index') {
      const hits = cat.entries.map(e => [e, matchEntry(e, query)]).filter(([, s]) => s > 0)
        .sort((a, b) => b[1] - a[1] || b[0].lines - a[0].lines).map(([e]) => e);
      if (hits.length) parts.push(`<section class="section" style="margin-top:18px"><div class="section-head"><h2 class="section-title small">Index</h2><span class="muted num" style="font-size:13px">${hits.length}</span></div>
        <div class="list">${hits.slice(0, scope === 'index' ? LIMIT.index : 6).map(e => entryRow(e, cat)).join('')}</div>
        ${scope === 'all' && hits.length > 6 ? `<button class="more-btn" type="button" data-scope="index">All ${hits.length} index results</button>` : ''}</section>`);
    }

    if (scope === 'all' || scope === 'words') {
      const words = [];
      for (const t of texts) for (const l of t.text.lemmas) {
        const lemmaNorm = normalize(l[0]);
        const score = greek ? (lemmaNorm === nq ? 3 : lemmaNorm.startsWith(nq) ? 2 : 0)
          : (l[1].toLowerCase().split(/[\s,;/]+/).includes(query.toLowerCase()) ? 2 : foldLatin(transliterate(l[0])).startsWith(fq) && fq.length > 2 ? 1 : 0);
        if (score) words.push([t, l, score]);
      }
      // Also match inflected forms: a Greek query that is a form in the text points to its lemma.
      if (greek) for (const t of texts) for (const line of t.text.lines) for (const tk of line.tk) {
        if (tk[3] >= 0 && normalize(tk[0]) === nq) {
          const lem = t.text.lex[tk[3]][0];
          if (!words.some(([, l]) => l[0] === lem)) { const l = t.text.lemmas.find(x => x[0] === lem); if (l) words.push([t, l, 4]); }
        }
      }
      words.sort((a, b) => b[2] - a[2] || b[1][2] - a[1][2]);
      if (words.length) parts.push(`<section class="section" style="margin-top:18px"><div class="section-head"><h2 class="section-title small">Greek words</h2><span class="muted num" style="font-size:13px">${words.length}</span></div>
        <div class="list">${words.slice(0, scope === 'words' ? LIMIT.words : 5).map(([t, l]) => `<a class="row lemma-row" href="#/search?lemma=${encodeURIComponent(l[0])}"><span class="row-main"><span class="row-title"><span class="grc">${esc(l[0])}</span><span class="row-greek" style="font-family:var(--ui);font-size:15px">${esc(l[1])}</span></span></span><span class="row-meta">${l[2]}×</span>${icon('chevron', 'chev')}</a>`).join('')}</div>
        ${scope === 'all' && words.length > 5 ? `<button class="more-btn" type="button" data-scope="words">All ${words.length} words</button>` : ''}</section>`);
    }

    if (scope === 'all' || scope === 'text') {
      let rows = [], total = 0;
      for (const t of texts) for (const line of t.text.lines) {
        let gHtml = null, eHtml = null;
        if (greek) {
          if (normalize(line.grc).includes(nq)) gHtml = markGreek(line, w => normalize(w).includes(nq));
        } else {
          if (line.en.toLowerCase().includes(query.toLowerCase())) eHtml = markEnglish(line.en, query);
          if (fq.length > 2 && line.tk.some(([w]) => foldLatin(transliterate(w)).startsWith(fq))) gHtml = markGreek(line, w => foldLatin(transliterate(w)).startsWith(fq));
        }
        if (gHtml || eHtml) { total++; if (rows.length < (scope === 'text' ? LIMIT.text : 12)) rows.push(lineRow(t, line, gHtml ?? esc(line.grc), eHtml ?? esc(line.en))); }
      }
      if (total) parts.push(`<section class="section" style="margin-top:18px"><div class="section-head"><h2 class="section-title small">Lines</h2><span class="muted num" style="font-size:13px">${total}</span></div>
        <div class="list">${rows.join('')}</div>
        ${scope === 'all' && total > rows.length ? `<button class="more-btn" type="button" data-scope="text">All ${total} lines</button>` : ''}</section>`);
    }
    results.innerHTML = parts.join('') || `<div class="list" style="margin-top:18px"><div class="list-empty">Nothing matches “${esc(query)}”.</div></div>`;
  }

  const remember = debounce(() => {
    const v = q.trim();
    if (v.length < 2) return;
    store.setPref('recent', [v, ...(store.prefs.recent ?? []).filter(r => r !== v)].slice(0, 8));
  }, 1200);

  if (!lemma) {
    const seg = segmented([['all', 'All'], ['index', 'Index'], ['text', 'Lines'], ['words', 'Words']], scope, v => { scope = v; setQuery({ in: v === 'all' ? '' : v }); draw(); }, 'Search in');
    view.querySelector('[data-seg]').append(seg);
    const clear = view.querySelector('.clear');
    input.addEventListener('input', debounce(() => { q = input.value; clear.hidden = !q; setQuery({ q }); draw(); remember(); }, 120));
    clear.addEventListener('click', () => { input.value = ''; q = ''; clear.hidden = true; setQuery({ q: '' }); draw(); input.focus(); });
    on(view, 'click', '[data-q]', (e, b) => { input.value = b.dataset.q; q = b.dataset.q; view.querySelector('.clear').hidden = false; setQuery({ q }); draw(); });
    on(view, 'click', '[data-scope]', (e, b) => {
      scope = b.dataset.scope;
      seg.querySelector(`[data-v="${scope}"]`)?.click();
    });
  }
  draw();
  return {
    title: lemma || 'Search', el: view,
    mount: ({ restore }) => {
      window.scrollTo(0, restore ?? 0);
      if (input && !q && window.matchMedia('(hover: hover)').matches) input.focus({ preventScroll: true });
    },
  };
}
