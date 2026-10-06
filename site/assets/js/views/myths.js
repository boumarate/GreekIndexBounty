import { el, esc, icon, on, plural } from '../lib/dom.js';
import * as store from '../lib/store.js';
import { segmented } from '../ui/components.js';

export async function render(route, { setQuery }) {
  const cat = await store.catalog();
  const stories = cat.entries.filter(e => e.kind === 'story');
  let sort = route.query.view ?? store.prefs.mythsSort ?? 'time';
  let mode = route.query.mode ?? 'all';
  let showEmpty = route.query.empty !== '0';
  const focus = route.query.p ?? null;
  const ent = id => cat.by.entries.get(id);
  const modeCounts = new Map();
  for (const s of stories) modeCounts.set(s.mode, (modeCounts.get(s.mode) ?? 0) + 1);

  const storyRow = s => {
    const m = cat.by.modes.get(s.mode);
    const narrator = s.narrator ? ent(s.narrator)?.title : null;
    return `<a class="row story-row" href="#/entry/${esc(s.id)}"><span class="row-main">
      <span class="row-title"><span>${esc(s.title)}</span></span>
      <span class="row-sub one">${narrator ? `Told by ${esc(narrator)} · ` : ''}${esc(s.passages?.[0] ? `Il. ${s.passages[0].replace('-', '–')}` : s.first ? `Il. ${s.first}` : '')}</span></span>
      ${m ? `<span class="mode-pill ${m.id}">${esc(m.label.replace('Told by a character', 'Told'))}</span>` : ''}${icon('chevron', 'chev')}</a>`;
  };

  const view = el(`<div class="view">
    <header class="page-head" style="padding-bottom:10px">
      <h1 class="large-title" data-title-anchor>Myths</h1>
      <p class="page-sub">The stories Homer’s characters tell, remember, and foresee, placed in mythic time from the first gods to the last voyage of Odysseus. ${plural(stories.length, 'story', 'stories')} so far; the empty periods wait for later books.</p>
    </header>
    <div style="display:flex;flex-direction:column;gap:10px">
      <div data-seg></div>
      <div class="chips" role="group" aria-label="How the story is told">
        <button class="chip" type="button" data-mode="all" aria-pressed="${mode === 'all'}">All <span class="n">${stories.length}</span></button>
        ${cat.modes.filter(m => modeCounts.get(m.id)).map(m => `<button class="chip" type="button" data-mode="${m.id}" aria-pressed="${mode === m.id}">${esc(m.label)} <span class="n">${modeCounts.get(m.id)}</span></button>`).join('')}
        <button class="chip" type="button" data-empty aria-pressed="${!showEmpty}">Hide empty periods</button>
      </div>
    </div>
    <div class="myths-body"></div>
  </div>`);
  const bodyEl = view.querySelector('.myths-body');

  const draw = () => {
    const list = stories.filter(s => mode === 'all' || s.mode === mode);
    if (sort === 'text') {
      const sorted = [...list].sort((a, b) => a.firstKey.localeCompare(b.firstKey));
      bodyEl.innerHTML = `<div class="list" style="margin-top:16px">${sorted.map(s => {
        const p = cat.by.periods.get(s.period);
        return storyRow(s).replace('<span class="row-sub one">', `<span class="row-sub one"><span style="color:var(--gold);font-weight:600">${esc(p?.label ?? '')}</span> · `);
      }).join('') || '<div class="list-empty">No stories match.</div>'}</div>`;
      return;
    }
    const ageCounts = new Map(cat.ages.map(a => [a.id, list.filter(s => cat.by.periods.get(s.period)?.age === a.id).length]));
    bodyEl.innerHTML = `<nav class="chips" aria-label="Jump to an age" style="margin-top:14px">${cat.ages.map(a =>
      `<button class="chip" type="button" data-age="${a.id}">${esc(a.label.replace(/^The /, ''))} <span class="n">${ageCounts.get(a.id)}</span></button>`).join('')}</nav>
      <div class="timeline">${cat.ages.map(age => {
      const periods = cat.periods.filter(p => p.age === age.id).map(p => [p, list.filter(s => s.period === p.id)]);
      const visible = periods.filter(([, items]) => showEmpty || items.length);
      if (!visible.length) return '';
      return `<section class="age" id="age-${age.id}"><div class="age-head"><h2 class="age-title">${esc(age.label)}</h2><p class="age-sub">${esc(age.summary)}</p></div>
        ${visible.map(([p, items]) => `<div class="period ${items.length ? 'has' : 'empty'}" id="period-${p.id}"><span class="dot"></span>
          <div class="period-card">
            <div class="period-top"><span class="period-name">${esc(p.label)}</span>${p.aka ? `<span class="period-aka">${esc(p.aka)}</span>` : ''}<span class="period-greek">${esc(p.greek)}</span>
              <span class="period-count">${items.length ? plural(items.length, 'story', 'stories') : ''}</span></div>
            <p class="period-sum">${esc(p.summary)}</p>
            ${!items.length && p.sources ? `<p class="period-src">Sources: ${esc(p.sources)}</p>` : ''}
            ${items.sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.firstKey.localeCompare(b.firstKey)).map(storyRow).join('')}
          </div></div>`).join('')}</section>`;
    }).join('')}</div>`;
  };

  const sync = () => setQuery({ view: sort === 'time' ? '' : sort, mode: mode === 'all' ? '' : mode, empty: showEmpty ? '' : '0', p: '' });
  view.querySelector('[data-seg]').append(segmented([['time', 'Mythic time'], ['text', 'Order in the poem']], sort, v => {
    sort = v; store.setPref('mythsSort', v); sync(); draw();
  }, 'Arrange'));
  on(view, 'click', '.chip[data-mode]', (e, b) => {
    mode = b.dataset.mode;
    view.querySelectorAll('.chip[data-mode]').forEach(c => c.setAttribute('aria-pressed', String(c === b)));
    sync(); draw();
  });
  on(view, 'click', '.chip[data-age]', (e, b) => {
    const t = view.querySelector(`#age-${CSS.escape(b.dataset.age)}`);
    if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' });
  });
  on(view, 'click', '.chip[data-empty]', (e, b) => {
    showEmpty = !showEmpty; b.setAttribute('aria-pressed', String(!showEmpty)); sync(); draw();
  });
  draw();

  return {
    title: 'Myths', el: view,
    mount: ({ restore }) => {
      if (restore !== undefined) return window.scrollTo(0, restore);
      if (focus) requestAnimationFrame(() => {
        const t = view.querySelector(`#period-${CSS.escape(focus)}`);
        if (!t) return;
        window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 90 });
        t.querySelector('.period-card').animate([{ boxShadow: '0 0 0 3px var(--accent)' }, { boxShadow: '0 0 0 0 transparent' }], { duration: 1600 });
      });
      else window.scrollTo(0, 0);
    },
  };
}
