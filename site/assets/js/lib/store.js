// Data loading (cached), derived lookups, and per-browser preferences.

const cache = new Map();

export function getJSON(path) {
  if (!cache.has(path)) {
    const p = fetch(`data/${path}`).then(r => {
      if (!r.ok) throw new Error(`Could not load ${path} (${r.status}). Run "npm run build".`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

let lookups = null;
export async function catalog() {
  const cat = await getJSON('catalog.json');
  if (!lookups) {
    const byId = (list, key = 'id') => new Map(list.map(x => [x[key], x]));
    const tagChildren = new Map();
    for (const t of cat.tags) if (t.parent) {
      if (!tagChildren.has(t.parent)) tagChildren.set(t.parent, []);
      tagChildren.get(t.parent).push(t.id);
    }
    lookups = {
      entries: byId(cat.entries), kinds: byId(cat.kinds), tags: byId(cat.tags), periods: byId(cat.periods),
      ages: byId(cat.ages), modes: byId(cat.modes), works: byId(cat.works), authors: byId(cat.authors),
      facets: byId(cat.facets), scopes: byId(cat.scopes ?? []), tagChildren,
    };
  }
  return Object.assign(cat, { by: lookups });
}

/** The chunk of a bundled export that holds an entry: the same hash as scripts/export.mjs. */
const bucket = (id, n) => { let h = 0x811c9dc5; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h % n; };

/** One entry's full page. Static exports bundle them into a few chunks, data/entries-<n>.json. */
export const entry = async id => {
  if (window.PINAKES_BUNDLE) {
    const n = window.PINAKES_BUNDLE.chunks ?? 1;
    const all = await getJSON(`entries-${bucket(id, n)}.json`);
    if (!all[id]) throw new Error(`There is no entry called “${id}”.`);
    return all[id];
  }
  return getJSON(`entries/${encodeURIComponent(id)}.json`);
};
export const text = (work, book) => getJSON(`texts/${work}/${book}.json`);
export const quotes = () => getJSON('quotes.json');
export const report = () => getJSON('report.json');

/** Descendant tag ids including the tag itself. */
export function tagFamily(cat, id) {
  const out = [id];
  for (let i = 0; i < out.length; i++) out.push(...(cat.by.tagChildren.get(out[i]) ?? []));
  return out;
}

// ── Preferences ─────────────────────────────────────────────────────────────
const KEY = 'greekindexbounty.prefs.v1';
const DEFAULTS = {
  mode: 'both', layout: 'stacked', size: 1.18, numbers: 'five', names: true, speakers: true,
  theme: 'system', quoteView: 'en', indexSort: 'az', mythsSort: 'time', lastRead: null, recent: [], scope: 'all',
};

function loadPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

export const prefs = loadPrefs();

export function setPref(key, value) {
  prefs[key] = value;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* storage unavailable */ }
}

export function applyTheme() {
  const root = document.documentElement;
  if (prefs.theme === 'light' || prefs.theme === 'dark') root.dataset.theme = prefs.theme;
  else delete root.dataset.theme;
  if (prefs.theme !== 'system') root.dataset.pinakesTheme = '1';
}
