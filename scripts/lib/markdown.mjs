// Markdown for articles, with the wiki's own syntax:
//   [[slug]] [[slug|label]] [[slug#section|label]]  links to index entries
//   {{quote:<uuid>}} or {{quote:Iliad 1.396-406 | Title}}   quote card (own line) or citation (inline)
//   {{ref:Iliad 1.528-530}}                          link into the reader
//   {{tabs}} {{tab:Label}} … {{/tabs}}               folder tabs (compatible with Margin)
//   {{figure:euclid/1-1.svg | Caption}}              an SVG diagram from content/figures, inlined
//   {{notes}}                                        where an entry's scoped notes (In Iliad 1, …) are placed
//   [^1] … [^1]: note                                footnotes
// Single newlines inside a paragraph are kept as line breaks, as in the reading wiki.

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function slugify(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
}

export function renderMarkdown(source, hooks, { idPrefix = '' } = {}) {
  const ctx = { hooks, idPrefix, headings: [], links: new Set(), quotes: new Set(), notes: new Map(), noteOrder: [], errors: [] };
  const lines = source.replace(/\r\n?/g, '\n').split('\n');

  // Footnote definitions are collected first so references can number them in reading order.
  const body = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\[\^([^\]]+)\]:\s?(.*)$/);
    if (!m) { body.push(lines[i]); continue; }
    const parts = [m[2]];
    while (i + 1 < lines.length && /^( {2,}|\t)\S/.test(lines[i + 1])) parts.push(lines[++i].trim());
    ctx.notes.set(m[1], parts.join('\n'));
  }

  let html = renderBlocks(body, ctx);
  if (ctx.noteOrder.length) {
    html += '<section class="footnotes"><ol>' + ctx.noteOrder.map((key, i) =>
      `<li id="${ctx.idPrefix}fn-${i + 1}" data-fn="${i + 1}">${renderInline(ctx.notes.get(key) ?? '', ctx)}</li>`).join('') + '</ol></section>';
  }
  return { html, headings: ctx.headings, links: [...ctx.links], quotes: [...ctx.quotes], errors: ctx.errors };
}

function renderBlocks(lines, ctx) {
  let out = '', i = 0;
  const para = [];
  const flush = () => {
    if (!para.length) return;
    out += `<p>${para.map(l => renderInline(l, ctx)).join('<br>')}</p>`;
    para.length = 0;
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { flush(); i++; continue; }

    // Tabs
    if (trimmed === '{{tabs}}') {
      flush();
      const tabs = []; let cur = null; i++;
      for (; i < lines.length && lines[i].trim() !== '{{/tabs}}'; i++) {
        const t = lines[i].trim().match(/^\{\{tab:(.+)\}\}$/);
        if (t) { cur = { label: t[1].trim(), lines: [] }; tabs.push(cur); continue; }
        if (cur) cur.lines.push(lines[i]);
      }
      i++; // skip {{/tabs}}
      const id = `tabs-${ctx.headings.length}-${tabs.length}-${Math.abs(hash(tabs.map(t => t.label).join('|')))}`;
      out += `<div class="tabs" data-tabs="${id}"><div class="tabbar" role="tablist">` +
        tabs.map((t, k) => `<button role="tab" data-tab="${k}"${k === 0 ? ' aria-selected="true"' : ''}>${renderInline(t.label, ctx)}</button>`).join('') +
        `</div>` + tabs.map((t, k) => `<section class="tabpanel" data-tab="${k}"${k ? ' hidden' : ''}>${renderBlocks(t.lines, ctx) || '<p class="empty">Nothing here yet.</p>'}</section>`).join('') + `</div>`;
      continue;
    }

    // Where an entry's scoped notes go when the whole article is shown
    if (trimmed === '{{notes}}') { flush(); out += '<div class="notes-slot"></div>'; i++; continue; }

    // Figure (inline SVG from content/figures) on its own line
    const fig = trimmed.match(/^\{\{figure:([^}|]+)(?:\|([^}]*))?\}\}$/);
    if (fig) {
      flush();
      try {
        const svg = ctx.hooks.figure(fig[1].trim());
        const cap = fig[2]?.trim();
        out += `<figure class="fig"><div class="fig-scroll">${svg}</div>${cap ? `<figcaption>${renderInline(cap, ctx)}</figcaption>` : ''}</figure>`;
      } catch (e) { ctx.errors.push(e.message); out += `<p class="broken">Missing figure: ${esc(fig[1])}</p>`; }
      i++; continue;
    }

    // Quote card on its own line
    const q = trimmed.match(/^\{\{quote:([^}]+)\}\}$/);
    if (q) { flush(); out += quoteBlock(q[1], ctx); i++; continue; }

    // Headings
    const h = trimmed.match(/^(#{1,6})\s+(.*?)\s*#*$/);
    if (h) {
      flush();
      const level = Math.max(2, h[1].length); // the page title is the only h1
      const text = h[2];
      let id = ctx.idPrefix + (slugify(text.replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')) || `section-${ctx.headings.length}`);
      if (ctx.headings.some(x => x.id === id)) id += `-${ctx.headings.length}`;
      ctx.headings.push({ level, text: stripInline(text), id });
      out += `<h${level} id="${id}">${renderInline(text, ctx)}</h${level}>`;
      i++; continue;
    }

    // Horizontal rule
    if (/^([-*_])(\s*\1){2,}$/.test(trimmed)) { flush(); out += '<hr>'; i++; continue; }

    // Blockquote
    if (trimmed.startsWith('>')) {
      flush();
      const inner = [];
      while (i < lines.length && lines[i].trim().startsWith('>')) inner.push(lines[i++].trim().replace(/^>\s?/, ''));
      out += `<blockquote>${renderBlocks(inner, ctx)}</blockquote>`;
      continue;
    }

    // Table
    if (trimmed.startsWith('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(lines[i++]);
      out += renderTable(rows, ctx);
      continue;
    }

    // Lists
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      flush();
      const block = [];
      while (i < lines.length && (/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && block.length))) block.push(lines[i++]);
      out += renderList(block, ctx);
      continue;
    }

    para.push(trimmed);
    i++;
  }
  flush();
  return out;
}

function renderList(lines, ctx) {
  const indent = l => l.match(/^\s*/)[0].replace(/\t/g, '  ').length;
  const base = indent(lines[0]);
  const ordered = /^\s*\d+[.)]/.test(lines[0]);
  const items = [];
  for (const l of lines) {
    const m = l.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (m && indent(l) <= base) items.push({ text: [m[3]], children: [] });
    else if (items.length) items[items.length - 1].children.push(l);
  }
  const tag = ordered ? 'ol' : 'ul';
  return `<${tag}>` + items.map(it => {
    const nested = it.children.length ? renderList(it.children.map(c => c.slice(Math.min(indent(c), base + 2))), ctx) : '';
    return `<li>${it.text.map(t => renderInline(t, ctx)).join('<br>')}${nested}</li>`;
  }).join('') + `</${tag}>`;
}

function renderTable(rows, ctx) {
  const cells = r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
  const head = cells(rows[0]);
  const align = cells(rows[1]).map(c => c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : '');
  const body = rows.slice(2).map(cells);
  const td = (tag, c, k) => `<${tag}${align[k] ? ` style="text-align:${align[k]}"` : ''}>${renderInline(c, ctx)}</${tag}>`;
  return `<div class="table-wrap"><table><thead><tr>${head.map((c, k) => td('th', c, k)).join('')}</tr></thead><tbody>` +
    body.map(r => `<tr>${r.map((c, k) => td('td', c, k)).join('')}</tr>`).join('') + '</tbody></table></div>';
}

function quoteBlock(spec, ctx) {
  try {
    const q = ctx.hooks.quote(spec.trim());
    ctx.quotes.add(q.id);
    return `<figure class="qcard" data-quote="${q.id}"></figure>`;
  } catch (e) {
    ctx.errors.push(e.message);
    return `<p class="broken">Missing quote: ${esc(spec)}</p>`;
  }
}

function stripInline(text) {
  return text.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\*\*|__|\*|_/g, '');
}

function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.codePointAt(0)) | 0; return h; }

export function renderInline(text, ctx) {
  const tokens = [];
  const stash = html => `\u0000${tokens.push(html) - 1}\u0000`;
  let s = text;

  s = s.replace(/`([^`]+)`/g, (_, c) => stash(`<code>${esc(c)}</code>`));
  s = s.replace(/\{\{quote:([^}]+)\}\}/g, (_, spec) => {
    try {
      const q = ctx.hooks.quote(spec.trim());
      ctx.quotes.add(q.id);
      return stash(`<a class="cite" href="${q.href}" data-quote="${q.id}">${esc(q.short)}</a>`);
    } catch (e) { ctx.errors.push(e.message); return stash(`<span class="broken">${esc(spec)}</span>`); }
  });
  s = s.replace(/\{\{ref:([^}]+)\}\}/g, (_, spec) => {
    try {
      const r = ctx.hooks.ref(spec.trim());
      return stash(`<a class="ref" href="${r.href}">${esc(r.label)}</a>`);
    } catch (e) { ctx.errors.push(e.message); return stash(`<span class="broken">${esc(spec)}</span>`); }
  });
  s = s.replace(/\[\[([^\]|#]+)(#[^\]|]+)?(?:\|([^\]]+))?\]\]/g, (_, target, section, label) => {
    const link = ctx.hooks.link(target.trim(), section ? section.slice(1) : null);
    ctx.links.add(link.id ?? target.trim());
    const text = label ?? link.label ?? target;
    return stash(link.missing
      ? `<span class="wl missing" title="No entry yet">${esc(text)}</span>`
      : `<a class="wl" href="${link.href}" data-entry="${link.id}">${renderInline(text, { ...ctx, hooks: ctx.hooks })}</a>`);
  });
  s = s.replace(/\[\^([^\]]+)\]/g, (_, key) => {
    if (!ctx.notes.has(key)) { ctx.errors.push(`Footnote [^${key}] has no definition`); return ''; }
    let n = ctx.noteOrder.indexOf(key) + 1;
    if (!n) n = ctx.noteOrder.push(key);
    return stash(`<sup class="fn"><button type="button" data-fn="${n}" aria-label="Note ${n}">${n}</button></sup>`);
  });
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
    if (!/^(https?:\/\/|mailto:|#)/i.test(url) && (/^[a-z][a-z\d+.-]*:/i.test(url) || url.startsWith('//') || /[\u0000-\u0020]/.test(url))) { ctx.errors.push('Unsafe link protocol'); return stash(esc(label)); }
    const external = /^https?:/i.test(url);
    return stash(`<a href="${esc(url)}"${external ? ' target="_blank" rel="noopener"' : ''}>${renderInline(label, ctx)}</a>`);
  });

  s = esc(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w*])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    .replace(/(^|[^\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, k) => tokens[+k]);
}
