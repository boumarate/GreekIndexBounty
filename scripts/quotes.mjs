#!/usr/bin/env node
// Quote registry tool.
//   npm run quotes                                  register every {{quote:Iliad 1.1-7 | Title}} written in an
//                                                   article and rewrite it as {{quote:<uuid>}}
//   npm run quotes -- add "Il. 1.528-530" "The nod of Zeus"
//                                                   register one passage and print its {{quote:…}} tag
//   npm run quotes -- show <uuid>                   print what a quote id refers to
import fs from 'node:fs';
import path from 'node:path';
import { CONTENT, readJson, walk, loadLibrary } from './lib/content.mjs';
import { makeWorkResolver } from './lib/refs.mjs';
import { isUuid } from './lib/uuid.mjs';
import { QuoteRegistry } from './lib/quotes.mjs';

const { works } = loadLibrary();
const registry = new QuoteRegistry(makeWorkResolver(works));
const [cmd, ...args] = process.argv.slice(2);

if (cmd === 'add') {
  const id = registry.register(args[1] ? `${args[0]} | ${args[1]}` : args[0]);
  registry.save();
  console.log(`{{quote:${id}}}`);
} else if (cmd === 'show') {
  for (const file of walk(path.join(CONTENT, 'quotes'), f => f.endsWith('.json'))) {
    const reg = readJson(file);
    const q = reg.quotes.find(x => x.id === args[0]);
    if (q) { console.log(`${reg.work} ${q.ref}${q.title ? ` — ${q.title}` : ''}`); process.exit(0); }
  }
  console.error('Unknown quote id'); process.exit(1);
} else {
  let changed = 0, files = 0;
  // Entry files default to their `work:` (else the Iliad); notes default to the work they are filed under.
  const noteWork = file => {
    for (let dir = path.dirname(file); dir.startsWith(path.join(CONTENT, 'library')); dir = path.dirname(dir)) {
      const wf = path.join(dir, 'work.json');
      if (fs.existsSync(wf)) return readJson(wf).id;
    }
    return null;
  };
  const sources = [
    ...walk(path.join(CONTENT, 'index'), f => f.endsWith('.md')),
    ...walk(path.join(CONTENT, 'library'), f => f.endsWith('.md') && f.split(path.sep).includes('notes')),
  ];
  for (const file of sources) {
    const src = fs.readFileSync(file, 'utf8');
    const work = noteWork(file) ?? src.match(/^work:\s*(\S+)/m)?.[1] ?? 'homer.iliad';
    const out = src.replace(/\{\{quote:([^}]+)\}\}/g, (all, spec) => {
      if (isUuid(spec.trim())) return all;
      changed++;
      return `{{quote:${registry.register(spec.trim(), work)}}}`;
    });
    if (out !== src) { fs.writeFileSync(file, out); files++; }
  }
  registry.save();
  console.log(`Registered ${changed} quotes in ${files} files.`);
}
