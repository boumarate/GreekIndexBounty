import { el, esc, icon, on, throttle, copyText, plural } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { openSheet, closeSheet, peek, toast, segmented, quoteCard, makeQuoteTag, witnessCitations } from '../ui/components.js';
import { BOOK_LETTERS } from './library.js';

// ── Parse labels ────────────────────────────────────────────────────────────
const ABBR = {
  'nom.': 'nominative', 'gen.': 'genitive', 'dat.': 'dative', 'acc.': 'accusative', 'voc.': 'vocative',
  'sg.': 'singular', 'pl.': 'plural', 'du.': 'dual', 'masc.': 'masculine', 'fem.': 'feminine', 'neut.': 'neuter',
  'pres.': 'present', 'impf.': 'imperfect', 'fut.': 'future', 'aor.': 'aorist', 'pf.': 'perfect', 'plpf.': 'pluperfect',
  'ind.': 'indicative', 'subj.': 'subjunctive', 'opt.': 'optative', 'imper.': 'imperative', 'imperat.': 'imperative',
  'inf.': 'infinitive', 'part.': 'participle', 'act.': 'active', 'mid.': 'middle', 'pass.': 'passive', 'mid./pass.': 'middle/passive',
  'adj.': 'adjective', 'adv.': 'adverb', 'prep.': 'preposition', 'conj.': 'conjunction', 'pron.': 'pronoun', 'pers.': 'personal',
  'rel.': 'relative', 'dem.': 'demonstrative', 'interj.': 'interjection', 'comp.': 'comparative', 'superl.': 'superlative',
  'refl.': 'reflexive', 'poss.': 'possessive', 'indef.': 'indefinite', 'interr.': 'interrogative', 'numeral': 'numeral',
};
const PERSON = { 1: '1st', 2: '2nd', 3: '3rd' };

export function expandParse(p = '') {
  const [pos, morph = ''] = p.split(' · ');
  const posLabel = pos.split(/\s+/).map(w => ABBR[w] ?? w).join(' ');
  const parts = [];
  const tokens = morph.replace(/(\d)\s+(sg\.|pl\.|du\.)/g, '$1_$2').split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const m = t.match(/^(\d)_(sg\.|pl\.|du\.)$/);
    if (m) parts.push(`${PERSON[m[1]]} person ${ABBR[m[2]]}`);
    else parts.push(ABBR[t] ?? t);
  }
  return { pos: posLabel, parts };
}

function greekHtml(line, nameIds) {
  return line.tk.map(([w, pre, post, , ents], k) => {
    const nm = ents.some(id => nameIds.has(id));
    return `${esc(pre)}<span class="w${nm ? ' nm' : ''}" data-k="${k}">${esc(w)}</span>${esc(post)}`;
  }).join(' ');
}

function englishHtml(line, nameIds) {
  let out = '', i = 0;
  for (const [s, e, id] of line.es) {
    out += esc(line.en.slice(i, s));
    out += `<span class="${nameIds.has(id) ? 'en-nm' : 'en-tm'}" data-e="${esc(id)}">${esc(line.en.slice(s, e))}</span>`;
    i = e;
  }
  return out + esc(line.en.slice(i));
}

export function parseRange(s) {
  const m = String(s ?? '').match(/^(\d+)(?:-(\d+))?$/);
  if (!m) return null;
  const a = +m[1], b = m[2] ? +m[2] : a;
  return { from: Math.min(a, b), to: Math.max(a, b) };
}

export async function render(route, { go }) {
  const [workId, bookStr] = route.parts;
  const book = Number(bookStr);
  const [cat, text] = await Promise.all([store.catalog(), store.text(workId, book)]);
  const work = cat.by.works.get(workId);
  const p = store.prefs;
  const nameIds = new Set(cat.entries.filter(e => cat.by.kinds.get(e.kind)?.names).map(e => e.id));
  const lineByN = new Map(text.lines.map(l => [l.n, l]));
  const speechAt = new Map(text.speeches.map(s => [s.from, s]));
  const afterSpeech = new Set(text.speeches.map(s => s.to + 1));
  const lemmaIndex = new Map(text.lemmas.map(l => [l[0], l]));
  // Word counts in the work's other available books, loaded the first time a word is looked up.
  let otherCounts = null;
  const countsElsewhere = () => otherCounts ??= Promise.all((work.available ?? []).filter(b => b !== book)
    .map(b => store.text(workId, b).then(t => [b, new Map(t.lemmas.map(l => [l[0], l[2]]))]))).then(list => new Map(list));
  const title = id => cat.by.entries.get(id)?.title ?? id.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
  const sceneOf = n => text.scenes.find(s => n >= s.from && n <= s.to);
  const speechOf = n => text.speeches.find(s => n >= s.from && n <= s.to);
  const dayOf = n => text.days.find(d => n >= d.from && n <= d.to);
  const abbr = work.citation.abbr;
  const cite = (a, b = a) => `${abbr} ${book}.${a}${b !== a ? `–${b}` : ''}`;

  // ── Markup ───────────────────────────────────────────────────────────────
  const lineHtml = line => {
    const n = line.n;
    const sp = speechAt.get(n);
    const para = sp || afterSpeech.has(n);
    const speaker = sp ? `<div class="speaker"><a data-e="${esc(sp.speaker)}" role="button" tabindex="0">${esc(title(sp.speaker))}</a>${sp.to_whom?.length ? `<span class="arrow">→</span><span>${(sp.to_whom ?? []).map(title).map(esc).join(', ')}</span>` : ''}</div>` : '';
    return `${speaker}<div class="line${para ? ' para' : ''}" id="l-${n}" data-n="${n}">
      <button class="n${n % 5 === 0 || n === 1 ? '' : ' dim'}" type="button" aria-label="Line ${n}">${n}</button>
      <div class="txt"><div class="g" lang="grc">${greekHtml(line, nameIds)}</div><div class="e" lang="en">${englishHtml(line, nameIds)}</div>${line.witness ? `<details class="witness-note"><summary>Supplement · ${esc(line.witness.source.author)}, ${esc(line.witness.source.work)} ${esc(line.witness.source.locator)}</summary><p>${esc(line.witness.editorialNote)}</p><p>${esc(line.witness.basis)} · ${esc(line.witness.certainty)}</p><a href="${esc(line.witness.source.url)}" target="_blank" rel="noopener">View witness source</a></details>` : ''}</div></div>`;
  };
  const scenes = text.scenes.length ? text.scenes : [{ from: text.lines[0].n, to: text.lines.at(-1).n, title: '' }];
  const body = scenes.map((s, i) => {
    const d = dayOf(s.from);
    const lines = text.lines.filter(l => l.n >= s.from && l.n <= s.to);
    return `<section class="scene" id="scene-${i}" data-from="${s.from}">
      ${s.title ? `<header class="scene-head"><div class="scene-title">${esc(s.title)}</div>
        <div class="scene-meta">Lines ${s.from}–${s.to}${d ? ` · ${esc(d.label)}` : ''}</div>
        ${s.summary ? `<p class="scene-summary">${esc(s.summary)}</p>` : ''}</header>` : ''}
      ${lines.map(lineHtml).join('')}</section>`;
  }).join('');

  const view = el(`<div class="view">
    <article class="reader" data-mode="${p.mode}" data-layout="${p.layout}" data-numbers="${p.numbers}" data-names="${p.names ? 'on' : 'off'}" style="--read-size:${p.size}rem">
      <header class="reader-head">
        <div class="reader-title">
          <div class="book-letter">${BOOK_LETTERS[book - 1] ?? book}</div>
          <div><div class="eyebrow">${esc(work.title)} · Book ${book}</div>
            <h1 data-title-anchor>${esc(text.title)}</h1>
            ${text.greek ? `<div class="grc">${esc(text.greek)}</div>` : ''}</div>
        </div>
        <p class="lead" style="font-size:16px;color:var(--text-2)">${esc(text.summary)}</p>
        <div class="reader-meta">${text.lines.length} lines · Greek of ${esc(text.editions[0]?.name ?? '')} · English by ${esc(text.editions[1]?.name ?? '')}. Tap a Greek word to parse it, a name to look it up, a line number to quote.</div>
      </header>
      <div class="reader-body">${body}</div>
      ${(() => {
        const avail = work.available ?? [];
        const nav = (b, dir) => avail.includes(b) ? `<a class="book-nav ${dir}" href="#/read/${esc(workId)}/${b}"><span class="bn-label">${dir === 'next' ? 'Next' : 'Previous'} · Book ${b}</span><span class="bn-title">${esc(work.books?.[b]?.title ?? `Book ${b}`)}</span></a>` : '';
        const links = nav(book - 1, 'prev') + nav(book + 1, 'next');
        return links ? `<nav class="book-nav-row" aria-label="Books">${links}</nav>` : '';
      })()}
      <footer class="reader-foot">${text.editions.map(e => `<div><b>${esc(e.label)}.</b> ${esc(e.credit)}</div>`).join('')}</footer>
    </article></div>`);
  const reader = view.querySelector('.reader');
  const applyPrefs = () => {
    reader.dataset.mode = p.mode;
    reader.dataset.layout = window.innerWidth >= 900 ? p.layout : 'stacked';
    reader.dataset.numbers = p.numbers;
    reader.dataset.names = p.names ? 'on' : 'off';
    reader.style.setProperty('--read-size', `${p.size}rem`);
    view.querySelectorAll('.speaker').forEach(s => { s.hidden = !p.speakers; });
    view.querySelectorAll('.scene-summary').forEach(s => { s.hidden = p.summaries === false; });
  };
  applyPrefs();

  // ── Selection for quoting ────────────────────────────────────────────────
  let sel = null, bar = null;
  const paint = () => {
    view.querySelectorAll('.line.sel, .line.sel-start, .line.sel-end').forEach(l => l.classList.remove('sel', 'sel-start', 'sel-end'));
    if (!sel) return;
    for (let n = sel.from; n <= sel.to; n++) view.querySelector(`#l-${n}`)?.classList.add('sel');
    view.querySelector(`#l-${sel.from}`)?.classList.add('sel-start');
    view.querySelector(`#l-${sel.to}`)?.classList.add('sel-end');
  };
  const endSelection = () => { sel = null; paint(); bar?.remove(); bar = null; };
  const showBar = () => {
    bar?.remove();
    const count = sel.to - sel.from + 1;
    bar = el(`<div class="selection-bar" role="toolbar" aria-label="Quote selection">
      <div><div class="label">${esc(cite(sel.from, sel.to))}</div><div class="hint">${count === 1 ? 'Tap another line number to extend' : plural(count, 'line')}</div></div>
      <button class="btn small" type="button" data-act="quote">${icon('quote')}Quote</button>
      <button class="sheet-close" type="button" data-act="cancel" aria-label="Cancel">${icon('x')}</button></div>`);
    bar.querySelector('[data-act="quote"]').addEventListener('click', () => quoteSheet(sel.from, sel.to));
    bar.querySelector('[data-act="cancel"]').addEventListener('click', endSelection);
    document.body.append(bar);
  };
  const startSelection = n => { sel = { from: n, to: n, anchor: n }; paint(); showBar(); };
  const extendSelection = n => { sel = { anchor: sel.anchor, from: Math.min(sel.anchor, n), to: Math.max(sel.anchor, n) }; paint(); showBar(); };

  function quoteSheet(from, to) {
    const q = {
      id: '', title: '', cite: `${cat.by.authors.get(work.author)?.name}, ${work.title} ${book}.${from}${to !== from ? `–${to}` : ''}`,
      href: `#/read/${workId}/${book}?l=${from}${to !== from ? `-${to}` : ''}`,
      lines: text.lines.filter(l => l.n >= from && l.n <= to).map(l => ({ n: `${book}.${l.n}`, grc: l.grc, en: l.en, ...(l.witness ? { witness: l.witness } : {}) })),
    };
    const ref = `${book}.${from}${to !== from ? `-${to}` : ''}`;
    const body = el(`<div>
      <label class="eyebrow" for="quote-title" style="display:block;margin:4px 0 6px">Title (optional)</label>
      <div class="search-field" style="margin-bottom:6px"><input id="quote-title" type="text" placeholder="e.g. The nod of Zeus" autocomplete="off"></div>
      <div class="qhost"></div>
      <div class="btn-row" style="margin-top:6px">
        <button class="btn" type="button" data-act="tag">${icon('quote')}Copy quote tag</button>
        <button class="btn plain" type="button" data-act="text">${icon('copy')}Copy text</button>
      </div>
      <p class="footnote-text">The quote tag works in any article in <code>content/index</code>. With <code>npm run dev</code> running it is registered automatically; otherwise run <code>npm run quotes</code> after pasting.</p>
    </div>`);
    const qhost = body.querySelector('.qhost');
    const drawCard = () => qhost.replaceChildren(quoteCard({ ...q, title: body.querySelector('#quote-title').value.trim() }));
    drawCard();
    body.querySelector('#quote-title').addEventListener('input', drawCard);
    body.querySelector('[data-act="tag"]').addEventListener('click', async () => {
      const { tag, registered } = await makeQuoteTag({ work: workId, ref, title: body.querySelector('#quote-title').value.trim() || undefined });
      if (await copyText(tag)) toast(registered ? 'Quote registered and copied' : 'Quote tag copied');
    });
    body.querySelector('[data-act="text"]').addEventListener('click', async () => {
      const v = qhost.querySelector('.qcard')?.dataset.view ?? 'en';
      const lines = q.lines.map(l => v === 'grc' ? l.grc : v === 'both' ? `${l.grc}\n${l.en}` : l.en).join('\n');
      if (await copyText(`${lines}\n— ${q.cite}${witnessCitations(q.lines)}`)) toast('Text copied');
    });
    openSheet({ title: `Quote ${cite(from, to)}`, content: body, onClose: endSelection });
  }

  // ── Sheets ───────────────────────────────────────────────────────────────
  const chip = id => {
    const e = cat.by.entries.get(id);
    if (!e) return '';
    const k = cat.by.kinds.get(e.kind);
    return `<button class="chip kind" type="button" data-peek="${esc(id)}" style="--h:${k?.hue ?? 262}">${esc(e.title)}</button>`;
  };
  const here = `${workId}.${book}`;
  const wirePeeks = root => on(root, 'click', '[data-peek]', (e, b) => peek(b.dataset.peek, { scope: here }));

  function wordSheet(line, k) {
    const [w, , , lx, ents] = line.tk[k];
    const a = lx >= 0 ? text.lex[lx] : null;
    const tokenEl = view.querySelector(`#l-${line.n} .w[data-k="${k}"]`);
    tokenEl?.classList.add('active');
    const lemma = a?.[0];
    const info = lemma ? lemmaIndex.get(lemma) : null;
    const parse = a ? expandParse(a[2]) : null;
    const others = info ? info[3].filter(n => n !== line.n) : [];
    const ctx = line.tk.map(([word, pre, post], i) => `${esc(pre)}${i === k ? `<mark>${esc(word)}</mark>` : esc(word)}${esc(post)}`).join(' ');
    const body = el(`<div>
      <div class="word-head">
        <div class="word-form" lang="grc">${esc(w)}</div>
        ${a ? `<div class="word-lemma" lang="grc">${esc(lemma)}${info ? ` <span style="font-family:var(--ui);font-size:13px;color:var(--text-3)">· ${plural(info[2], 'time')} in Book ${book}</span>` : ''}${info?.[4] && (work.available ?? []).some(b => b < book) ? ` <span class="new-word">New in Book ${book}</span>` : ''}</div>
          <div class="word-books" hidden></div>
          <div class="word-gloss">${esc(a[1])}</div>
          <div class="parse"><span class="pos">${esc(parse.pos)}</span>${parse.parts.map(x => `<span>${esc(x)}</span>`).join('')}</div>
          ${a[3] ? `<div class="note">${esc(a[3])}</div>` : ''}` : '<div class="muted" style="margin-top:6px">This word has not been analyzed yet.</div>'}
      </div>
      ${ents.length ? `<div class="section" style="margin-top:6px"><div class="section-title small" style="margin-bottom:8px">In the index</div><div class="chips wrap">${ents.map(chip).join('')}</div></div>` : ''}
      <div class="section" style="margin-top:18px"><div class="section-title small" style="margin-bottom:8px">${esc(cite(line.n))}</div>
        <div class="ctx-line"><div class="g" lang="grc">${ctx}</div><div class="e">${esc(line.en)}</div></div></div>
      ${others.length ? `<div class="section" style="margin-top:18px"><div class="section-title small" style="margin-bottom:8px">Also in Book ${book}</div>
        <div class="list">${others.slice(0, 8).map(n => {
          const l = lineByN.get(n);
          return `<button class="row" type="button" data-jump="${n}"><span class="row-main"><span class="row-sub one" style="font-size:12px;color:var(--text-3)">${esc(cite(n))}</span><span class="grc" style="font-size:16px">${esc(l.grc)}</span></span></button>`;
        }).join('')}</div>
        ${others.length > 8 ? `<a class="btn plain small" style="margin-top:10px" href="#/search?lemma=${encodeURIComponent(lemma)}">All ${others.length + 1} lines with ${esc(lemma)}</a>` : ''}</div>` : ''}
    </div>`);
    wirePeeks(body);
    on(body, 'click', '[data-jump]', (e, b) => { closeSheet(); jump(+b.dataset.jump, true); });
    openSheet({ title: a ? `${a[0]} · ${a[1]}` : w, content: body, onClose: () => tokenEl?.classList.remove('active') });
    if (lemma && (work.available ?? []).length > 1) countsElsewhere().then(map => {
      const box = body.querySelector('.word-books');
      const parts = (work.available ?? []).map(b => [b, b === book ? (info?.[2] ?? 0) : (map.get(b)?.get(lemma) ?? 0)]);
      const total = parts.reduce((t, [, c]) => t + c, 0);
      box.innerHTML = `${esc(work.title)}: ${plural(total, 'time')} · ${parts.map(([b, c]) => `<span${b === book ? ' class="here"' : ''}>Book ${b} <b>${c}</b></span>`).join(' · ')}`;
      box.hidden = false;
    }).catch(() => {});
  }

  function lineSheet(n) {
    const line = lineByN.get(n);
    const sc = sceneOf(n), sp = speechOf(n), d = dayOf(n);
    const ents = line.le.filter(id => cat.by.entries.has(id));
    const names = ents.filter(id => nameIds.has(id)), others = ents.filter(id => !nameIds.has(id));
    const passages = (line.lp ?? []).filter(id => cat.by.entries.has(id));
    const body = el(`<div>
      <div class="ctx-line"><div class="g" lang="grc" style="font-size:19px">${esc(line.grc)}</div><div class="e" style="margin-top:4px">${esc(line.en)}</div></div>
      <div class="btn-row" style="margin-top:14px">
        <button class="btn small" type="button" data-act="quote1">${icon('quote')}Quote line</button>
        <button class="btn small secondary" type="button" data-act="range">Quote a passage…</button>
        <button class="btn small plain" type="button" data-act="copy">${icon('copy')}Copy</button>
      </div>
      <div class="list" style="margin-top:18px">
        ${sc ? `<button class="row" type="button" data-jump="${sc.from}"><span class="row-main"><span class="row-sub one" style="font-size:12px;color:var(--text-3)">Scene · ${sc.from}–${sc.to}${d ? ` · ${esc(d.label)}` : ''}</span><span class="row-title"><span>${esc(sc.title)}</span></span></span>${icon('chevron', 'chev')}</button>` : ''}
        ${sp ? `<button class="row" type="button" data-jump="${sp.from}"><span class="row-main"><span class="row-sub one" style="font-size:12px;color:var(--text-3)">Speech · ${sp.from}–${sp.to}${sp.kind ? ` · ${esc(sp.kind)}` : ''}</span><span class="row-title"><span>${esc(title(sp.speaker))} → ${(sp.to_whom ?? []).map(title).map(esc).join(', ')}</span></span></span>${icon('chevron', 'chev')}</button>` : ''}
      </div>
      ${names.length ? `<div class="section" style="margin-top:18px"><div class="section-title small" style="margin-bottom:8px">Names</div><div class="chips wrap">${names.map(chip).join('')}</div></div>` : ''}
      ${others.length ? `<div class="section" style="margin-top:14px"><div class="section-title small" style="margin-bottom:8px">Also indexed</div><div class="chips wrap">${others.map(chip).join('')}</div></div>` : ''}
      ${passages.length ? `<div class="section" style="margin-top:14px"><div class="section-title small" style="margin-bottom:8px">Part of</div><div class="chips wrap">${passages.map(chip).join('')}</div></div>` : ''}
    </div>`);
    wirePeeks(body);
    on(body, 'click', '[data-jump]', (e, b) => { closeSheet(); jump(+b.dataset.jump, true); });
    body.querySelector('[data-act="quote1"]').addEventListener('click', () => { sel = { from: n, to: n, anchor: n }; paint(); quoteSheet(n, n); });
    body.querySelector('[data-act="range"]').addEventListener('click', () => { closeSheet(); startSelection(n); });
    body.querySelector('[data-act="copy"]').addEventListener('click', async () => {
      if (await copyText(`${line.grc}\n${line.en}\n— ${cite(n)}${witnessCitations([line])}`)) toast('Line copied');
    });
    openSheet({ title: cite(n), content: body });
  }

  function contentsSheet() {
    const body = el(`<div>
      <form class="search-field" style="margin-bottom:16px" data-goto>${icon('search')}<input id="goto-line" type="number" inputmode="numeric" min="1" max="${text.lines.at(-1).n}" placeholder="Go to line (1–${text.lines.at(-1).n})"></form>
      <div class="section-title small" style="margin:0 4px 8px">Scenes</div>
      <div class="list">${text.scenes.map(s => `<button class="row" type="button" data-jump="${s.from}"><span class="row-main"><span class="row-title"><span>${esc(s.title)}</span><span class="row-meta" style="margin-left:auto;font-size:13px">${s.from}–${s.to}</span></span><span class="row-sub">${esc(s.summary ?? '')}</span></span></button>`).join('')}</div>
      <div class="section-title small" style="margin:22px 4px 8px">Speeches</div>
      <div class="list">${text.speeches.map(s => `<button class="row speech-row" type="button" data-jump="${s.from}"><span class="row-main"><span class="row-title"><span>${esc(title(s.speaker))} <span class="muted">→ ${s.to_whom.map(title).map(esc).join(', ')}</span></span></span><span class="row-sub one">${s.from}–${s.to} · ${plural(s.to - s.from + 1, 'line')}${s.kind ? ` · ${esc(s.kind)}` : ''}</span></span></button>`).join('')}</div>
      <div class="section-title small" style="margin:22px 4px 8px">Days</div>
      <div class="list">${text.days.map(d => `<button class="row" type="button" data-jump="${d.from}"><span class="row-main"><span class="row-title"><span>${esc(d.label)}</span><span class="row-meta" style="margin-left:auto;font-size:13px">${d.from}–${d.to}</span></span><span class="row-sub">${esc(d.note)}</span></span></button>`).join('')}</div>
      <div class="list" style="margin-top:22px"><a class="row" href="#/book/${workId}/${book}"><span class="row-main"><span class="row-title"><span>Book ${book} at a glance</span></span></span>${icon('chevron', 'chev')}</a><a class="row" href="#/vocab/${workId}/${book}"><span class="row-main"><span class="row-title"><span>Vocabulary of Book ${book}</span></span></span>${icon('chevron', 'chev')}</a></div>
    </div>`);
    on(body, 'click', '[data-jump]', (e, b) => { closeSheet(); jump(+b.dataset.jump, false, true); });
    body.querySelector('[data-goto]').addEventListener('submit', e => {
      e.preventDefault();
      const n = +body.querySelector('#goto-line').value;
      if (lineByN.has(n)) { closeSheet(); jump(n, true); }
    });
    body.querySelectorAll('a.row').forEach(a => a.addEventListener('click', () => closeSheet()));
    openSheet({ title: `Contents · Book ${book}`, content: body });
  }

  function displaySheet() {
    const body = el(`<div style="display:flex;flex-direction:column;gap:18px">
      <div><div class="section-title small" style="margin:0 4px 8px">Text</div><div data-seg="mode"></div></div>
      <div class="wide-only"><div class="section-title small" style="margin:0 4px 8px">Layout</div><div data-seg="layout"></div></div>
      <div><div class="section-title small" style="margin:0 4px 8px">Size</div>
        <div style="display:flex;align-items:center;gap:12px"><span style="font-size:14px" aria-hidden="true">A</span><input id="read-size" type="range" min="0.95" max="1.7" step="0.01" value="${p.size}" aria-label="Text size"><span style="font-size:22px" aria-hidden="true">A</span></div></div>
      <div><div class="section-title small" style="margin:0 4px 8px">Line numbers</div><div data-seg="numbers"></div></div>
      <div class="list">
        ${[['names', 'Highlight names'], ['speakers', 'Speaker labels'], ['summaries', 'Scene summaries']].map(([k, label]) => `<label class="row" for="pref-${k}"><span class="row-main"><span class="row-title"><span>${label}</span></span></span>
          <span class="toggle"><input id="pref-${k}" type="checkbox" data-pref="${k}" ${p[k] !== false ? 'checked' : ''}><span></span></span></label>`).join('')}
      </div>
      <div><div class="section-title small" style="margin:0 4px 8px">Appearance</div><div data-seg="theme"></div></div>
    </div>`);
    const set = (k, v) => { store.setPref(k, v); applyPrefs(); };
    body.querySelector('[data-seg="mode"]').append(segmented([['grc', 'Greek'], ['both', 'Both'], ['en', 'English']], p.mode, v => set('mode', v), 'Text'));
    body.querySelector('[data-seg="layout"]').append(segmented([['stacked', 'Interlinear'], ['parallel', 'Side by side']], p.layout, v => set('layout', v), 'Layout'));
    body.querySelector('[data-seg="numbers"]').append(segmented([['five', 'Every 5th'], ['all', 'Every line'], ['off', 'Hidden']], p.numbers, v => set('numbers', v), 'Line numbers'));
    body.querySelector('[data-seg="theme"]').append(segmented([['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], p.theme, v => {
      store.setPref('theme', v);
      if (v === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
    }, 'Appearance'));
    if (window.innerWidth < 900) body.querySelector('.wide-only').hidden = true;
    body.querySelector('#read-size').addEventListener('input', e => set('size', +e.target.value));
    on(body, 'change', '[data-pref]', (e, input) => set(input.dataset.pref, input.checked));
    openSheet({ title: 'Display', content: body });
  }

  // ── Interaction ──────────────────────────────────────────────────────────
  on(view, 'click', '.line .n', (e, b) => {
    const n = +b.closest('.line').dataset.n;
    if (sel) extendSelection(n); else lineSheet(n);
  });
  on(view, 'click', '.line .w', (e, w) => {
    const line = lineByN.get(+w.closest('.line').dataset.n);
    wordSheet(line, +w.dataset.k);
  });
  on(view, 'click', '.en-nm, .en-tm, .speaker a[data-e]', (e, a) => peek(a.dataset.e, { scope: here }));

  // Hover a Greek word (on devices with a pointer) for its headword and gloss.
  const gloss = el('<div class="chart-tip word-tip" role="tooltip" hidden></div>');
  document.body.append(gloss);
  if (window.matchMedia('(hover: hover)').matches) {
    on(view, 'pointerover', '.line .w', (e, w) => {
      const line = lineByN.get(+w.closest('.line').dataset.n);
      const a = text.lex[line.tk[+w.dataset.k][3]];
      if (!a) return;
      gloss.innerHTML = `<span class="grc">${esc(a[0])}</span> · ${esc(a[1])}`;
      gloss.hidden = false;
      const r = w.getBoundingClientRect();
      gloss.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - gloss.offsetWidth / 2), window.innerWidth - gloss.offsetWidth - 8)}px`;
      gloss.style.top = `${r.top - gloss.offsetHeight - 6}px`;
    });
    on(view, 'pointerout', '.line .w', () => { gloss.hidden = true; });
  }
  const hideGloss = () => { gloss.hidden = true; };
  on(view, 'keydown', '.speaker a[data-e]', (e, a) => { if (e.key === 'Enter') peek(a.dataset.e, { scope: here }); });

  function jump(n, flash = false, top = false) {
    const target = view.querySelector(top ? `.scene[data-from="${n}"]` : `#l-${n}`) ?? view.querySelector(`#l-${n}`);
    if (!target) return;
    const y = target.getBoundingClientRect().top + window.scrollY - (top ? 60 : window.innerHeight * 0.3);
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    if (flash && !top) {
      const line = view.querySelector(`#l-${n}`);
      line.classList.remove('flash'); void line.offsetWidth; line.classList.add('flash');
    }
  }

  const saveProgress = throttle(() => {
    const navBottom = 60;
    const lines = view.querySelectorAll('.line');
    let lo = 0, hi = lines.length - 1, found = null;
    while (lo <= hi) { // first line whose top is below the navbar
      const mid = (lo + hi) >> 1;
      if (lines[mid].getBoundingClientRect().top >= navBottom) { found = lines[mid]; hi = mid - 1; } else lo = mid + 1;
    }
    if (!found) return;
    const n = +found.dataset.n;
    store.setPref('lastRead', { work: workId, book, n, scene: sceneOf(n)?.title ?? '' });
    const title = document.getElementById('nav-title');
    if (title) title.textContent = window.scrollY > 300 ? `${work.title} ${book}.${n}` : `${work.title} ${book}`;
  }, 250);
  const progress = el('<div class="read-progress" aria-hidden="true"><i></i></div>');
  const onProgress = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.firstChild.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  };
  const onResize = () => applyPrefs();

  return {
    title: `${work.title} ${book}`,
    el: view,
    actions: [
      { icon: 'contents', label: 'Contents', run: contentsSheet },
      { icon: 'aa', label: 'Display', run: displaySheet },
    ],
    mount: ({ back, restore }) => {
      window.addEventListener('scroll', saveProgress, { passive: true });
      window.addEventListener('scroll', onProgress, { passive: true });
      window.addEventListener('scroll', hideGloss, { passive: true });
      window.addEventListener('resize', onResize);
      document.getElementById('navbar')?.append(progress);
      requestAnimationFrame(onProgress);
      const range = parseRange(route.query.l);
      if (range) {
        for (let n = range.from; n <= range.to; n++) view.querySelector(`#l-${n}`)?.classList.add('hl');
        requestAnimationFrame(() => {
          const first = view.querySelector(`#l-${range.from}`);
          if (first) window.scrollTo(0, Math.max(0, first.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.28));
        });
      } else if (back && restore !== undefined) {
        requestAnimationFrame(() => window.scrollTo(0, restore));
      } else if (p.lastRead?.work === workId && p.lastRead?.book === book && p.lastRead.n > 5) {
        requestAnimationFrame(() => {
          const line = view.querySelector(`#l-${p.lastRead.n}`);
          if (line) window.scrollTo(0, Math.max(0, line.getBoundingClientRect().top + window.scrollY - 70));
        });
      } else window.scrollTo(0, 0);
    },
    unmount: () => {
      window.removeEventListener('scroll', saveProgress);
      window.removeEventListener('scroll', onProgress);
      window.removeEventListener('scroll', hideGloss);
      window.removeEventListener('resize', onResize);
      progress.remove();
      bar?.remove();
      gloss.remove();
    },
  };
}
