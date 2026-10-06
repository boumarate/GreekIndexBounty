// DOM helpers and the icon set (SF Symbols–like strokes drawn on a 24px grid).

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Build an element from an HTML string (one root). */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function frag(html) {
  const t = document.createElement('template');
  t.innerHTML = html;
  return t.content;
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Delegate events: on(root, 'click', '.row', (e, target) => …) */
export function on(root, type, selector, handler, opts) {
  root.addEventListener(type, e => {
    const target = e.target.closest(selector);
    if (target && root.contains(target)) handler(e, target);
  }, opts);
}

const P = {
  library: '<rect x="3.5" y="4" width="4" height="16" rx="1"/><rect x="9.5" y="4" width="4" height="16" rx="1"/><path d="M15.6 5.6l3.4-.9 3.1 11.8-3.4.9z"/>',
  book: '<path d="M3 5.6c3-1.1 6-1.1 9 .8 3-1.9 6-1.9 9-.8v13c-3-1.1-6-1.1-9 .8-3-1.9-6-1.9-9-.8z"/><path d="M12 6.4v13.4"/>',
  index: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.1" fill="currentColor" stroke="none"/>',
  amphora: '<path d="M9 3.2h6M10.2 3.2v2.6c0 1.1-3.7 2.3-3.7 6.7 0 3.9 2.6 6.6 5.5 8.3 2.9-1.7 5.5-4.4 5.5-8.3 0-4.4-3.7-5.6-3.7-6.7V3.2"/><path d="M8.4 7.6C6 7.4 4.6 8.6 4.6 10.3S6 13 7.6 12.6M15.6 7.6c2.4-.2 3.8 1 3.8 2.7S18 13 16.4 12.6M7.4 13.2h9.2"/>',
  tag: '<path d="M3.5 12.2V5A1.5 1.5 0 0 1 5 3.5h7.2l8.4 8.4a1.5 1.5 0 0 1 0 2.1l-6.6 6.6a1.5 1.5 0 0 1-2.1 0z"/><circle cx="8" cy="8" r="1.4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
  back: '<path d="M15 4.5L7.5 12l7.5 7.5"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  updown: '<path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  aa: '<path d="M2.8 18.5L8 5.5l5.2 13M4.6 14h6.8"/><path d="M15 12.4c.6-1.2 1.6-1.8 3-1.8 2 0 3.1 1.1 3.1 3v4.9m0-3.6c-.9-.4-1.9-.6-3-.5-1.6.2-2.9.9-2.9 2.2 0 1.2 1 1.9 2.3 1.9 1.5 0 2.8-.9 3.6-2.2"/>',
  contents: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  quote: '<path d="M10 7.5c-3 .8-5 3.1-5 6.2V17h4.5v-4.4H7c0-1.7 1.2-3 3-3.6zM19 7.5c-3 .8-5 3.1-5 6.2V17h4.5v-4.4H16c0-1.7 1.2-3 3-3.6z"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 8.5V6A2.5 2.5 0 0 0 13 3.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5"/>',
  arrow: '<path d="M7 17L17 7M9 7h8v8"/>',
  ellipsis: '<circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6"/>',
  people: '<circle cx="9" cy="8.5" r="3.4"/><path d="M2.8 19.5c.8-3.4 3.3-5.2 6.2-5.2s5.4 1.8 6.2 5.2"/><path d="M15.5 5.3a3.4 3.4 0 0 1 0 6.4M17.4 14.5c2 .6 3.4 2.2 3.9 5"/>',
  sparkles: '<path d="M11 3.5l1.7 4.9 4.9 1.7-4.9 1.7L11 16.7l-1.7-4.9-4.9-1.7 4.9-1.7z"/><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  map: '<path d="M9 4.2L3.5 6.5v13.3L9 17.5l6 2.3 5.5-2.3V4.2L15 6.5z"/><path d="M9 4.2v13.3M15 6.5v13.3"/>',
  paw: '<circle cx="6.8" cy="10" r="1.8"/><circle cx="10.3" cy="6.4" r="1.8"/><circle cx="14.8" cy="6.6" r="1.8"/><circle cx="18" cy="10.4" r="1.8"/><path d="M12.4 12c2.9 0 5.4 3.4 4.9 5.9-.4 1.9-2.4 2.3-4.3 1.7a3.1 3.1 0 0 0-1.9 0c-1.9.6-3.9.2-4.3-1.7-.5-2.5 2-5.9 5.6-5.9z"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  flame: '<path d="M12 21c-3.9 0-7-2.8-7-6.6 0-3.1 2-5.4 3.6-7 .5 1.6 1.4 2.6 2.4 3C11 7.2 12.4 4.8 15 3c-.4 3 1.2 4.9 2.6 6.6 1.3 1.5 1.4 3 1.4 4.8 0 3.8-3.1 6.6-7 6.6z"/>',
  textformat: '<path d="M3.5 18.5l4.5-12 4.5 12M5.1 14.3h5.8"/><path d="M15 6.5v12M15 13.2c.5-1.6 1.7-2.5 3.2-2.5 1.9 0 3.1 1.5 3.1 3.9s-1.2 3.9-3.1 3.9c-1.5 0-2.7-.9-3.2-2.5"/>',
  lightbulb: '<path d="M9.2 18h5.6M10.2 21h3.6M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  repeat: '<path d="M16.5 2.5l3 3-3 3M4 11.5V9.5a4 4 0 0 1 4-4h11.5M7.5 21.5l-3-3 3-3M20 12.5v2a4 4 0 0 1-4 4H4.5"/>',
  wave: '<path d="M2.5 7.5c2.4-2.8 4.8-2.8 7.2 0s4.8 2.8 7.2 0c1.6-1.9 3.2-2.4 4.8-1.4M2.5 12.5c2.4-2.8 4.8-2.8 7.2 0s4.8 2.8 7.2 0c1.6-1.9 3.2-2.4 4.8-1.4M2.5 17.5c2.4-2.8 4.8-2.8 7.2 0s4.8 2.8 7.2 0c1.6-1.9 3.2-2.4 4.8-1.4"/>',
  scroll: '<path d="M8 20.5h9.5a3 3 0 0 0 3-3V5.5a2 2 0 0 0-2-2H8.5a2 2 0 0 0-2 2V17"/><path d="M6.5 17a1.75 1.75 0 0 0-3.5 0v.6a2.9 2.9 0 0 0 2.9 2.9H8M10 8h7M10 12h7"/>',
  bubble: '<path d="M4 6a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6v8a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4h.5A2.5 2.5 0 0 1 4 14z"/>',
  feather: '<path d="M20.5 3.5c-7.5.3-12.8 5.3-13.8 12.3L5 21"/><path d="M20.5 3.5c-.4 7-5 11.4-12 12.1M9.4 11.2h6.4"/>',
  doc: '<path d="M14 3.5H7A2 2 0 0 0 5 5.5v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8.5z"/><path d="M14 3.5v5h5M8.5 13h7M8.5 16.5h7"/>',
  creature: '<path d="M5.5 20.5c0-6 2.3-11.3 5.4-15.4M10.5 20.5c0-5 1.6-9.2 4.2-12.6M15.5 20.5c0-3.8 1.2-6.9 3.1-9.3"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="0.6" fill="currentColor"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  family: '<circle cx="12" cy="5" r="2.2"/><circle cx="6" cy="19" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="M12 7.2v4.3M6 16.8v-2.3A2.5 2.5 0 0 1 8.5 12h7a2.5 2.5 0 0 1 2.5 2.5v2.3"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  voice: '<path d="M4 6a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 6v8a2.5 2.5 0 0 1-2.5 2.5H11l-5 4v-4h.5A2.5 2.5 0 0 1 4 14z"/><path d="M8.5 8.5h7M8.5 12h4.5"/>',
  sort: '<path d="M7 4v16M3.5 16.5L7 20l3.5-3.5M17 20V4M13.5 7.5L17 4l3.5 3.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  badge: '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 10.5h10M7 14h6"/>',
};

export const icon = (name, cls = '') =>
  `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] ?? P.doc}</svg>`;

/** Kind → icon name; kinds.json carries its own icon ids that map onto this set. */
export const kindIcon = k => ({ sparkles: 'sparkles', person: 'person', people: 'people', creature: 'creature', map: 'map', paw: 'paw',
  cube: 'cube', flame: 'flame', textformat: 'textformat', lightbulb: 'lightbulb', quote: 'quote', repeat: 'repeat', wave: 'wave',
  scroll: 'scroll', bubble: 'bubble', feather: 'feather', doc: 'doc', badge: 'badge' }[k] ?? 'doc');

export function debounce(fn, ms = 120) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function throttle(fn, ms = 100) {
  let last = 0, t;
  return (...args) => {
    const now = Date.now();
    clearTimeout(t);
    if (now - last >= ms) { last = now; fn(...args); }
    else t = setTimeout(() => { last = Date.now(); fn(...args); }, ms - (now - last));
  };
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { /* fall through */ }
  const ta = document.createElement('textarea');
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.append(ta); ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}

export const plural = (n, one, many = one + 's') => `${n.toLocaleString()} ${n === 1 ? one : many}`;
