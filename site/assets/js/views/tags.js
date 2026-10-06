import { el, esc, icon, plural } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { entryRow } from './index.js';

export async function render(route) {
  const cat = await store.catalog();
  return route.parts[0] ? tagPage(cat, route.parts[0]) : browser(cat);
}

function browser(cat) {
  const used = cat.tags;
  const tagRows = (tags, depth = 0) => tags.map(t => {
    const kids = (cat.by.tagChildren.get(t.id) ?? []).map(id => cat.by.tags.get(id)).filter(Boolean);
    return `<a class="row tag-row${depth ? ' child' : ''}" href="#/tags/${esc(t.id)}"><span class="row-main"><span class="row-title"><span>${esc(t.label)}</span></span>
      ${t.summary ? `<span class="row-sub one">${esc(t.summary)}</span>` : ''}</span><span class="row-meta">${t.count}</span>${icon('chevron', 'chev')}</a>` + tagRows(kids, depth + 1);
  }).join('');
  const view = el(`<div class="view">
    <header class="page-head">
      <h1 class="large-title" data-title-anchor>Tags</h1>
      <p class="page-sub">${used.length} seed tags in ${cat.facets.length} facets. Tags nest, so a parent includes its children: <a href="#/tags/sea-deity">#sea deity</a> takes in <a href="#/tags/nereid">#nereid</a>. Combine tags on any tag page.</p>
    </header>
    ${cat.facets.map(f => {
      const roots = used.filter(t => t.facet === f.id && !(t.parent && cat.by.tags.has(t.parent)));
      if (!roots.length) return '';
      return `<section class="section"><div class="section-head"><h2 class="section-title small">${esc(f.label)}</h2></div>
        <div class="list">${tagRows(roots.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)))}</div></section>`;
    }).join('')}
  </div>`);
  return { title: 'Tags', el: view };
}

function tagPage(cat, spec) {
  const ids = spec.split('+').filter(id => cat.by.tags.has(id));
  if (!ids.length) throw new Error(`No tag called “${spec}”.`);
  const families = ids.map(id => new Set(store.tagFamily(cat, id)));
  const entries = cat.entries.filter(e => families.every(fam => e.tags.some(t => fam.has(t))));
  const tags = ids.map(id => cat.by.tags.get(id));
  const main = tags[0];
  const facet = cat.by.facets.get(main.facet);
  const parent = main.parent ? cat.by.tags.get(main.parent) : null;
  const children = (cat.by.tagChildren.get(main.id) ?? []).map(id => cat.by.tags.get(id)).filter(t => t?.count);

  // Tags that co-occur with this selection, for narrowing it further.
  const co = new Map();
  for (const e of entries) for (const t of e.tags) if (!ids.includes(t)) co.set(t, (co.get(t) ?? 0) + 1);
  const combine = [...co].filter(([, n]) => n < entries.length).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([t, n]) => [cat.by.tags.get(t), n]).filter(([t]) => t);

  const byKind = cat.kinds.map(k => [k, entries.filter(e => e.kind === k.id).sort((a, b) => a.title.localeCompare(b.title))]).filter(([, l]) => l.length);
  const title = tags.map(t => `#${t.label.toLowerCase()}`).join(' + ');
  const view = el(`<div class="view">
    <header class="page-head">
      <div class="eyebrow">${esc(facet?.label ?? 'Tag')}${parent ? ` · <a href="#/tags/${esc(parent.id)}">#${esc(parent.label.toLowerCase())}</a>` : ''}</div>
      <h1 class="large-title" data-title-anchor>${esc(title)}</h1>
      <p class="page-sub">${ids.length === 1 && main.summary ? `${esc(main.summary)} ` : ''}${plural(entries.length, 'entry', 'entries')}.</p>
    </header>
    ${ids.length > 1 ? `<div class="chips wrap" style="margin-bottom:8px">${tags.map(t => `<a class="chip tag" href="#/tags/${ids.filter(x => x !== t.id).join('+')}" aria-label="Remove ${esc(t.label)}">#${esc(t.label.toLowerCase())} ${icon('x')}</a>`).join('')}</div>` : ''}
    ${children.length && ids.length === 1 ? `<div class="section-title small" style="margin:8px 4px">Narrower</div><div class="chips wrap">${children.map(t => `<a class="chip" href="#/tags/${esc(t.id)}">#${esc(t.label.toLowerCase())} <span class="n">${t.count}</span></a>`).join('')}</div>` : ''}
    ${combine.length ? `<div class="section-title small" style="margin:16px 4px 8px">Combine with</div><div class="chips">${combine.map(([t, n]) => `<a class="chip" href="#/tags/${ids.join('+')}+${esc(t.id)}">+ #${esc(t.label.toLowerCase())} <span class="n">${n}</span></a>`).join('')}</div>` : ''}
    ${byKind.map(([k, list]) => `<section class="section"><div class="section-head"><h2 class="section-title small">${esc(k.label)}</h2><span class="muted num" style="font-size:13px">${list.length}</span></div>
      <div class="list">${list.map(e => entryRow(e, cat)).join('')}</div></section>`).join('')}
  </div>`);
  return { title, el: view };
}
