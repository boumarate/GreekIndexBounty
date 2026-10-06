// Validate data identities and file templates before a trusted build reads a proposed tree.
import fs from 'node:fs';
import path from 'node:path';
import { json } from './submission.mjs';
const slug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
export function preflight(root) {
  const errors = [], need = (ok, message) => { if (!ok) errors.push(message); };
  const list = (rows, name) => {
    need(Array.isArray(rows), `${name} must be an array`);
    if (!Array.isArray(rows)) return [];
    need(new Set(rows.map(x => x.id)).size === rows.length, `${name} contains duplicate IDs`);
    for (const x of rows) need(slug(x.id), `${name}: invalid ID`);
    return rows;
  };
  const kinds = list(json(path.join(root, 'content/kinds.json')), 'kinds');
  for (const k of kinds) need(Number.isFinite(k.hue), 'kind hue must be numeric');
  const cfg = json(path.join(root, 'content/tags.json'));
  const facets = list(cfg.facets, 'facets'), tags = list(cfg.tags, 'tags');
  const tagById = new Map(tags.map(t => [t.id, t]));
  for (const t of tags) {
    need(facets.some(f => f.id === t.facet), `tag ${t.id}: unknown facet`);
    const seen = new Set([t.id]); let parent = t.parent;
    while (parent) {
      if (seen.has(parent)) { errors.push(`tag ${t.id}: cyclic ancestry`); break; }
      need(tagById.has(parent), `tag ${t.id}: unknown parent`);
      seen.add(parent); parent = tagById.get(parent)?.parent;
    }
  }
  const periods = json(path.join(root, 'content/periods.json'));
  const ages = list(periods.ages, 'ages');
  for (const p of list(periods.periods, 'periods')) need(ages.some(a => a.id === p.age), `period ${p.id}: unknown age`);
  list(periods.modes, 'modes');
  const lib = path.join(root, 'content/library');
  for (const a of fs.readdirSync(lib, { withFileTypes: true })) {
    if (!a.isDirectory() || a.name.startsWith('.')) continue;
    need(slug(a.name), 'invalid author directory');
    const author = json(path.join(lib, a.name, 'author.json'));
    need(author.id === a.name, 'author identity must match its directory');
    for (const w of fs.readdirSync(path.join(lib, a.name), { withFileTypes: true })) {
      if (!w.isDirectory() || w.name === 'notes' || w.name.startsWith('.')) continue;
      const file = path.join(lib, a.name, w.name, 'work.json');
      if (!fs.existsSync(file)) { errors.push(`missing work metadata: ${a.name}/${w.name}`); continue; }
      const work = json(file);
      need(slug(w.name) && work.author === a.name && work.id === `${a.name}.${w.name}`, 'work identity must match its author/directory');
      need(Number.isInteger(work.bookCount) && work.bookCount > 0 && work.bookCount <= 1000, `${work.id}: invalid bookCount`);
      need(work.citation?.scheme === 'book.line', `${work.id}: citation adapter not implemented`);
      need(Array.isArray(work.editions) && work.editions.length === 2 && work.editions[0].id === 'grc' && work.editions[1].id === 'en', `${work.id}: editions must be Greek then English`);
      for (const ed of work.editions ?? []) need(['grc', 'en'].includes(ed.id) && ed.path === `${ed.id}/{book}.txt`, `${work.id}: unsafe or unsupported edition path`);
      need(work.structure === 'structure/{book}.json' && work.lexicon === 'lexicon/{book}.json', `${work.id}: unsafe or unsupported data paths`);
    }
  }
  return errors;
}
