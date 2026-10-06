// Reading and writing the quote registries in content/quotes/<work>.json.
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT, readJson } from './content.mjs';
import { parseRef, formatRange } from './refs.mjs';
import { quoteId } from './uuid.mjs';

const regFile = work => path.join(CONTENT, 'quotes', `${work}.json`);
const sortKey = q => q.ref.split(/[.-]/).map(n => n.padStart(5, '0')).join('.') + (q.title ?? '');

export class QuoteRegistry {
  constructor(resolveWork) { this.resolveWork = resolveWork; this.regs = new Map(); this.dirty = new Set(); }

  load(work) {
    if (!this.regs.has(work)) {
      const file = regFile(work);
      this.regs.set(work, fs.existsSync(file) ? readJson(file) : { work, quotes: [] });
    }
    return this.regs.get(work);
  }

  /** Register "Il. 1.528-530 | Title" (or {work, ref, title}); returns the quote id. */
  register(spec, defaultWork = 'homer.iliad') {
    let refText, title;
    if (typeof spec === 'string') { const [r, ...rest] = spec.split('|'); refText = r.trim(); title = rest.join('|').trim() || undefined; }
    else { refText = `${spec.work ?? defaultWork} ${spec.ref}`; title = spec.title?.trim() || undefined; }
    const r = parseRef(refText, this.resolveWork, defaultWork);
    const ref = formatRange(r);
    const id = quoteId({ work: r.work, ref, title });
    const reg = this.load(r.work);
    if (!reg.quotes.some(q => q.id === id)) { reg.quotes.push({ id, ref, ...(title ? { title } : {}) }); this.dirty.add(r.work); }
    return id;
  }

  save() {
    for (const work of this.dirty) {
      const reg = this.regs.get(work);
      reg.quotes.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      fs.mkdirSync(path.dirname(regFile(work)), { recursive: true });
      fs.writeFileSync(regFile(work), JSON.stringify(reg, null, 2) + '\n');
    }
    this.dirty.clear();
  }
}
