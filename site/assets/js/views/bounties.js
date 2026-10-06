import { el, esc, icon } from '../lib/dom.js';
import * as store from '../lib/store.js';

export async function render(route) {
  const cat = await store.catalog(), registry = cat.bounties;
  const book = route.query.unit ?? route.query.book;
  const workId = route.query.work ?? 'homer.iliad';
  const work = cat.by.works.get(workId);
  const total = registry.units.reduce((n, b) => n + b.rewardSats, 0);
  const funding = registry.units.some(b => b.funding === 'pending') ? 'funding pending' : 'see individual bounty terms';
  const units = book ? registry.units.filter(b => b.unit === book && b.work === workId) : registry.units;
  return { title: 'Bounties', el: el(`<div class="view">
    <header class="page-head"><div class="eyebrow">Research that becomes a library</div><h1 class="large-title" data-title-anchor>${book ? `${esc(work?.title ?? workId)} · Book ${esc(book)}` : 'One book. Every detail.'}</h1><p class="page-sub">24 books of the Iliad. 100 sats for each accepted, complete study. Translation is only the beginning.</p></header>
    <div class="notice-card"><strong>${total.toLocaleString()} sats offered · ${funding}</strong><p>Rewards are paid manually after scholarly review, acceptance, and merge. No funds are held by this site.</p></div>
    <div class="research-steps"><div><b>01</b><span>Translate every line</span></div><div><b>02</b><span>Analyze every word</span></div><div><b>03</b><span>Research every thread</span></div><div><b>04</b><span>Audit the whole book</span></div></div>
    <section class="section"><div class="section-head"><h2 class="section-title">${book ? 'Selected bounty' : 'The first collection'}</h2>${book ? '<a href="#/bounties">All bounties</a>' : '<span class="section-caption">Homer · Iliad</span>'}</div><div class="list bounty-list">${units.length ? '' : '<div class="list-empty">No bounty is registered for this unit.</div>'}${units.map(b => `<a class="row" href="${esc(b.issue ?? `${registry.repository}/blob/main/BOUNTIES.md`)}"><span class="bounty-number">${esc(b.unit.padStart(2, '0'))}</span><span class="row-main"><span class="row-title">${esc(b.label)}</span><span class="row-sub">${(b.expected.to - b.expected.from + 1 - b.expected.omitted.length).toLocaleString()} source lines · ${esc(b.status)}</span></span><span class="reward">${b.rewardSats}<small> sats</small></span>${icon('arrow', 'chev')}</a>`).join('')}</div></section>
    <section class="section"><h2 class="section-title">Bring the evidence with the work.</h2><p class="page-sub">Research contributions must be authored by Opus 5.5 or Fable 5.5. Every PR records its exact model, effort setting, agent team, time, token usage, sources, audits, and remaining gaps.</p><div class="btn-row"><a class="btn" href="${registry.repository}/blob/main/CONTRIBUTING.md">Read the contribution guide ${icon('arrow')}</a><a class="btn secondary" href="${registry.repository}/blob/main/README.md">Full project scope</a></div><p class="footnote-text">Plan around three hours per book, then allow time for review. Completeness is assessed from evidence, never from time or token counts alone.</p></section>
  </div>`) };
}
