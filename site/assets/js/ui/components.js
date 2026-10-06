// Shared UI: sheets, toasts, popover menus, segmented controls, quote cards, entity quick-look.
import { el, esc, icon, copyText, on, kindIcon } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { quoteId } from '../lib/uuid.js';

// ── Toasts ──────────────────────────────────────────────────────────────────
export function toast(message, iconName = 'check') {
  const host = document.getElementById('toasts');
  const t = el(`<div class="toast">${icon(iconName)}<span>${esc(message)}</span></div>`);
  host.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 260); }, 2200);
}

// ── Sheets ──────────────────────────────────────────────────────────────────
let current = null;

export function closeSheet() { current?.close(); }

/** Open a bottom sheet (a centered card on wide screens). Returns { el, body, close }. */
export function openSheet({ title = '', content = '', onClose, className = '' } = {}) {
  current?.close(true);
  const host = document.getElementById('sheets');
  const scrim = el('<div class="scrim"></div>');
  const sheet = el(`<section class="sheet ${className}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">
    <div class="sheet-grabber"></div>
    <header class="sheet-head"><div class="sheet-title">${esc(title)}</div>
      <button class="sheet-close" type="button" aria-label="Close">${icon('x')}</button></header>
    <div class="sheet-body"></div></section>`);
  const body = sheet.querySelector('.sheet-body');
  if (typeof content === 'string') body.innerHTML = content; else if (content) body.append(content);
  host.append(scrim, sheet);
  const previousFocus = document.activeElement;
  requestAnimationFrame(() => { scrim.classList.add('open'); sheet.classList.add('open'); sheet.focus({ preventScroll: true }); });

  let closed = false;
  const close = (instant = false) => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    if (current?.el === sheet) current = null;
    const done = () => { scrim.remove(); sheet.remove(); };
    if (instant) done();
    else {
      scrim.classList.remove('open'); sheet.classList.remove('open');
      sheet.style.transform = '';
      setTimeout(done, 380);
    }
    onClose?.();
    if (!instant && previousFocus?.focus) previousFocus.focus({ preventScroll: true });
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  scrim.addEventListener('click', () => close());
  sheet.querySelector('.sheet-close').addEventListener('click', () => close());

  // Drag the grabber or header down to dismiss (phone layout only).
  let startY = null, dy = 0;
  const handle = e => e.target.closest('.sheet-grabber, .sheet-head') && !e.target.closest('button');
  sheet.addEventListener('pointerdown', e => {
    if (!handle(e) || window.innerWidth >= 700) return;
    startY = e.clientY; dy = 0; sheet.classList.add('dragging'); sheet.setPointerCapture(e.pointerId);
  });
  sheet.addEventListener('pointermove', e => {
    if (startY === null) return;
    dy = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (startY === null) return;
    startY = null; sheet.classList.remove('dragging');
    if (dy > 110) close(); else sheet.style.transform = '';
  };
  sheet.addEventListener('pointerup', end);
  sheet.addEventListener('pointercancel', end);

  current = { el: sheet, body, close };
  return current;
}

// ── Popover menu ────────────────────────────────────────────────────────────
export function menu(anchor, items) {
  document.querySelectorAll('.popover').forEach(p => p.remove());
  const pop = el(`<div class="popover" role="menu" style="padding:6px;min-width:220px"></div>`);
  for (const it of items) {
    if (it === '-') { pop.append(el('<div style="height:0.5px;background:var(--separator);margin:4px 8px"></div>')); continue; }
    const b = el(`<button class="row" role="menuitem" style="min-height:40px;border-radius:8px;padding:8px 10px;font-size:15px">
      ${it.checked !== undefined ? `<span style="width:18px;color:var(--accent)">${it.checked ? icon('check') : ''}</span>` : ''}
      <span class="row-main">${esc(it.label)}${it.sub ? `<span class="row-sub one" style="font-size:12.5px">${esc(it.sub)}</span>` : ''}</span>
      ${it.icon ? icon(it.icon) : ''}</button>`);
    b.addEventListener('click', () => { pop.remove(); it.action(); });
    pop.append(b);
  }
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), window.innerWidth - w - 12);
  let top = r.bottom + 8;
  if (top + h > window.innerHeight - 12) top = Math.max(12, r.top - h - 8);
  Object.assign(pop.style, { left: `${left}px`, top: `${top}px` });
  const away = e => { if (!pop.contains(e.target)) { pop.remove(); document.removeEventListener('pointerdown', away, true); } };
  setTimeout(() => document.addEventListener('pointerdown', away, true));
  return pop;
}

// ── Segmented control ───────────────────────────────────────────────────────
/** options: [[value, label]]; returns element; calls onChange(value). */
export function segmented(options, value, onChange, label = '') {
  const seg = el(`<div class="segmented" role="group" aria-label="${esc(label)}"><span class="thumb"></span>${options.map(([v, l]) =>
    `<button type="button" data-v="${esc(v)}" aria-pressed="${v === value}">${esc(l)}</button>`).join('')}</div>`);
  const thumb = seg.querySelector('.thumb');
  const place = () => {
    const b = seg.querySelector('[aria-pressed="true"]');
    if (!b) return;
    thumb.style.width = `${b.offsetWidth}px`;
    thumb.style.transform = `translateX(${b.offsetLeft - 2}px)`;
  };
  on(seg, 'click', 'button', (e, b) => {
    seg.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    place();
    onChange(b.dataset.v);
  });
  requestAnimationFrame(place);
  new ResizeObserver(place).observe(seg);
  return seg;
}

export const witnessCitations = lines => lines.filter(l => l.witness).map(l => `\nSupplement ${l.n}: ${l.witness.source.author}, ${l.witness.source.work} ${l.witness.source.locator}; ${l.witness.certainty}; ${l.witness.source.url}`).join('');

// ── Quote cards ─────────────────────────────────────────────────────────────
const VIEW_LABEL = { en: 'English', grc: 'Greek', both: 'Greek + English' };

function linesHtml(q, view) {
  return q.lines.map(line => {
    const n = `<span class="qn">⟦${esc(line.n)}⟧</span>`;
    const g = `<span class="qt-grc" lang="grc">${esc(line.grc)}</span>`;
    const e = `<span class="qt-en" lang="en">${esc(line.en)}</span>`;
    if (view === 'grc') return `<div class="qline">${n}${g}</div>`;
    if (view === 'both') return `<div class="qline">${n}${g}<span></span>${e}</div>`;
    return `<div class="qline">${n}${e}</div>`;
  }).join('');
}

export function quoteCard(q, { view } = {}) {
  let v = view ?? q.view ?? store.prefs.quoteView ?? 'en';
  const card = el(`<figure class="qcard" data-quote="${esc(q.id)}" data-view="${v}">
    ${q.title ? `<figcaption class="qcard-title">${esc(q.title)}</figcaption>` : ''}
    <div class="qcard-lines">${linesHtml(q, v)}</div>
    ${q.lines.some(l => l.witness) ? `<div class="witness-note">${q.lines.filter(l => l.witness).map(l => `Supplement ${esc(l.n)}: ${esc(l.witness.source.author)}, ${esc(l.witness.source.work)} ${esc(l.witness.source.locator)} (${esc(l.witness.certainty)})`).join('<br>')}</div>` : ''}
    <div class="qcard-foot">
      <button class="qcard-menu" type="button" aria-label="Choose text">${esc(VIEW_LABEL[v])} ${icon('updown')}</button>
      <a class="qcard-cite" href="${esc(q.href)}">${esc(q.cite)} ${icon('arrow')}</a>
      <div class="qcard-actions"><button class="qcard-copy" type="button">${icon('copy')}Copy</button></div>
    </div></figure>`);
  const setView = nv => {
    v = nv;
    card.dataset.view = v;
    card.querySelector('.qcard-lines').innerHTML = linesHtml(q, v);
    card.querySelector('.qcard-menu').innerHTML = `${esc(VIEW_LABEL[v])} ${icon('updown')}`;
  };
  card.querySelector('.qcard-menu').addEventListener('click', e => {
    menu(e.currentTarget, [
      { label: 'English', sub: 'Contributor translation', checked: v === 'en', action: () => setView('en') },
      { label: 'Greek', sub: 'Base edition and labeled supplements', checked: v === 'grc', action: () => setView('grc') },
      { label: 'Greek + English', sub: 'Line by line', checked: v === 'both', action: () => setView('both') },
    ]);
  });
  card.querySelector('.qcard-copy').addEventListener('click', e => {
    const textOf = lang => q.lines.map(l => lang === 'grc' ? l.grc : l.en).join('\n');
    menu(e.currentTarget, [
      { label: 'Copy quote tag', sub: `{{quote:${q.id.slice(0, 8)}…}}`, icon: 'quote', action: async () => { if (await copyText(`{{quote:${q.id}}}`)) toast('Quote tag copied'); } },
      { label: 'Copy text', sub: v === 'grc' ? 'Greek, with citation' : 'English, with citation', icon: 'copy', action: async () => {
        const body = v === 'both' ? q.lines.map(l => `${l.grc}\n${l.en}`).join('\n') : textOf(v === 'grc' ? 'grc' : 'en');
        if (await copyText(`${body}\n— ${q.cite}${witnessCitations(q.lines)}`)) toast('Text copied');
      } },
      { label: 'Copy citation', sub: q.cite, icon: 'link', action: async () => { if (await copyText(q.cite)) toast('Citation copied'); } },
    ]);
  });
  return card;
}

/** Replace every <figure class="qcard" data-quote> placeholder inside root. */
export function hydrateQuotes(root, quotes) {
  root.querySelectorAll('figure.qcard[data-quote]').forEach(fig => {
    const q = quotes[fig.dataset.quote];
    if (q) fig.replaceWith(quoteCard(q));
  });
}

/** Register a quote with the dev server when it is running; always returns an insertable tag. */
export async function makeQuoteTag({ work, ref, title }) {
  const readable = `{{quote:${work.replace(/^homer\./, '').replace(/^./, c => c.toUpperCase())} ${ref}${title ? ` | ${title}` : ''}}}`;
  try {
    const r = await fetch('api/quotes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ work, ref, title }) });
    if (r.ok) { const { id } = await r.json(); return { tag: `{{quote:${id}}}`, registered: true }; }
  } catch { /* static hosting: no API */ }
  const id = await quoteId({ work, ref, title });
  return { tag: readable, id, registered: false };
}

// ── Entity quick look ───────────────────────────────────────────────────────
/** A quick look at an entry. With a scope (the book being read), it shows the entry's place in that book. */
export async function peek(id, { scope = null } = {}) {
  const cat = await store.catalog();
  const e = cat.by.entries.get(id);
  if (!e) return;
  const kind = cat.by.kinds.get(e.kind);
  const tags = e.tags.map(t => cat.by.tags.get(t)).filter(Boolean);
  const here = scope && e.in?.[scope];
  const sc = scope && cat.by.scopes.get(scope);
  const note = scope && e.noteSummary?.[scope];
  const multi = Object.keys(e.in ?? {}).length > 1;
  const body = el(`<div>
    <div class="entry-head" style="padding-top:0">
      <div class="chips wrap"><span class="chip kind" style="--h:${kind?.hue ?? 262}">${icon(kindIcon(kind?.icon))}${esc(kind?.one ?? e.kind)}</span>
        ${tags.slice(0, 4).map(t => `<span class="chip tag">#${esc(t.label.toLowerCase())}</span>`).join('')}</div>
      ${e.greek ? `<div class="entry-greek"><span class="grc">${esc(e.greek)}</span>${e.translit ? `<span class="rom">${esc(e.translit)}</span>` : ''}</div>` : ''}
      <p class="lead" style="font-size:16.5px">${esc(e.summary)}</p>
      ${note ? `<p class="scope-lead"><span class="scope-tag">${esc(sc?.label ?? '')}</span>${esc(note)}</p>` : ''}
      <div class="entry-stats">${here && here[0] ? `<span><b>${here[0]}</b> ${here[0] === 1 ? 'line' : 'lines'} in ${esc(sc?.label ?? '')}</span>${here[1] ? `<span>first at <b>${esc(`${sc?.book}.${here[1]}`)}</b></span>` : ''}` : ''}
        ${!here || multi ? `${e.lines ? `<span><b>${e.lines}</b> ${e.lines === 1 ? 'line' : 'lines'}${multi ? ' in all' : ''}</span>` : ''}${!here && e.first ? `<span>first at <b>${esc(e.first)}</b></span>` : ''}` : ''}</div>
    </div>
    <div class="btn-row" style="margin-top:14px"><a class="btn" href="#/entry/${esc(id)}${here && multi ? `?in=${esc(scope)}` : ''}">Open ${esc(kind?.one?.toLowerCase() ?? 'entry')}</a></div>
  </div>`);
  const sheet = openSheet({ title: e.title, content: body });
  body.querySelector('a.btn').addEventListener('click', () => sheet.close(true));
  return sheet;
}

/** Wire in-article behaviors: quote cards, tabs, footnote popovers. */
export function enhanceArticle(root, data) {
  hydrateQuotes(root, data.quotes ?? {});
  root.querySelectorAll('.tabs').forEach(tabs => {
    on(tabs, 'click', '.tabbar button', (e, b) => {
      tabs.querySelectorAll('.tabbar button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
      tabs.querySelectorAll(':scope > .tabpanel').forEach(p => { p.hidden = p.dataset.tab !== b.dataset.tab; });
    });
  });
  on(root, 'click', 'sup.fn button', (e, b) => {
    const note = (b.closest('[data-fnscope]') ?? root).querySelector(`.footnotes li[data-fn="${b.dataset.fn}"]`);
    if (!note) return;
    document.querySelectorAll('.popover').forEach(p => p.remove());
    const pop = el(`<div class="popover article">${note.innerHTML}</div>`);
    document.body.append(pop);
    const r = b.getBoundingClientRect();
    const w = pop.offsetWidth;
    Object.assign(pop.style, { left: `${Math.min(Math.max(12, r.left - w / 2), window.innerWidth - w - 12)}px`, top: `${r.bottom + 8}px` });
    const away = ev => { if (!pop.contains(ev.target) && ev.target !== b) { pop.remove(); document.removeEventListener('pointerdown', away, true); } };
    setTimeout(() => document.addEventListener('pointerdown', away, true));
  });
}
