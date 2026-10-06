// Loading the content tree: library (authors → works → books), index entries, quotes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitFrontMatter } from './frontmatter.mjs';

export const ROOT = process.env.GIB_ROOT ? path.resolve(process.env.GIB_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CONTENT = path.join(ROOT, 'content');
export const rel = p => path.relative(ROOT, p);

export const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export const exists = p => fs.existsSync(p);

export function walk(dir, test = () => true) {
  if (!exists(dir)) return [];
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) out.push(...walk(full, test));
    else if (test(full)) out.push(full);
  }
  return out;
}

export const bookFile = (template, book) => template.replace('{book}', String(book).padStart(2, '0'));

/** A verse/section text file: "<number>\t<text>" rows; "#" lines are comments. */
export function readLines(file) {
  const rows = new Map();
  fs.readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (!line.trim() || line.startsWith('#')) return;
    const tab = line.indexOf('\t');
    if (tab < 0) throw new Error(`${rel(file)}:${i + 1}: expected "<line>\\t<text>"`);
    const n = Number(line.slice(0, tab));
    if (!Number.isInteger(n) || n < 1) throw new Error(`${rel(file)}:${i + 1}: bad line number "${line.slice(0, tab)}"`);
    if (rows.has(n)) throw new Error(`${rel(file)}:${i + 1}: duplicate line ${n}`);
    rows.set(n, line.slice(tab + 1).trim());
  });
  return rows;
}

export function loadLibrary() {
  const libDir = path.join(CONTENT, 'library');
  const authors = [], works = [];
  for (const authorDir of fs.readdirSync(libDir).sort()) {
    const aFile = path.join(libDir, authorDir, 'author.json');
    if (!exists(aFile)) continue;
    const author = readJson(aFile);
    authors.push(author);
    for (const workDir of fs.readdirSync(path.join(libDir, authorDir)).sort()) {
      const wFile = path.join(libDir, authorDir, workDir, 'work.json');
      if (!exists(wFile)) continue;
      const work = readJson(wFile);
      const dir = path.dirname(wFile);
      work.dir = dir;
      work.texts = new Map();
      for (let book = 1; book <= (work.bookCount ?? 1); book++) {
        const primary = path.join(dir, bookFile(work.editions[0].path, book));
        if (!exists(primary)) continue;
        const editions = {};
        for (const ed of work.editions) {
          const file = path.join(dir, bookFile(ed.path, book));
          if (exists(file)) editions[ed.id] = readLines(file);
        }
        const structFile = work.structure && path.join(dir, bookFile(work.structure, book));
        const lexFile = work.lexicon && path.join(dir, bookFile(work.lexicon, book));
        work.texts.set(book, {
          editions,
          structure: structFile && exists(structFile) ? readJson(structFile) : { scenes: [], speeches: [], days: [] },
          lexicon: lexFile && exists(lexFile) ? readJson(lexFile) : null,
          lexiconFile: lexFile,
          witnesses: exists(path.join(dir, bookFile('witnesses/{book}.json', book))) ? readJson(path.join(dir, bookFile('witnesses/{book}.json', book))) : {},
        });
      }
      works.push(work);
    }
  }
  return { authors, works };
}

export function loadEntries() {
  const files = walk(path.join(CONTENT, 'index'), f => f.endsWith('.md'));
  return files.map(file => {
    const { data, body } = splitFrontMatter(fs.readFileSync(file, 'utf8'), rel(file));
    return { id: data.id ?? path.basename(file, '.md'), file: rel(file), data, body };
  });
}

/**
 * Scoped notes: what an entry is and does within one author, work or book. The folder is the scope:
 *   content/library/homer/notes/<id>.md              in Homer
 *   content/library/homer/iliad/notes/<id>.md        in the Iliad as a whole
 *   content/library/homer/iliad/notes/02/<id>.md     in Iliad, Book 2
 * The file name is the id of the entry the note belongs to.
 */
export function loadNotes() {
  const libDir = path.join(CONTENT, 'library');
  const out = [];
  const read = (file, scope) => {
    const { data, body } = splitFrontMatter(fs.readFileSync(file, 'utf8'), rel(file));
    out.push({ entryId: path.basename(file, '.md'), file: rel(file), scope, data, body });
  };
  const mdIn = dir => exists(dir) ? fs.readdirSync(dir).sort().filter(n => n.endsWith('.md')).map(n => path.join(dir, n)) : [];
  for (const authorDir of fs.readdirSync(libDir).sort()) {
    const aFile = path.join(libDir, authorDir, 'author.json');
    if (!exists(aFile)) continue;
    const author = readJson(aFile);
    for (const file of mdIn(path.join(libDir, authorDir, 'notes'))) read(file, { id: author.id, author: author.id });
    for (const workDir of fs.readdirSync(path.join(libDir, authorDir)).sort()) {
      const wFile = path.join(libDir, authorDir, workDir, 'work.json');
      if (!exists(wFile)) continue;
      const work = readJson(wFile);
      const notesDir = path.join(libDir, authorDir, workDir, 'notes');
      for (const file of mdIn(notesDir)) read(file, { id: work.id, author: author.id, work: work.id });
      if (!exists(notesDir)) continue;
      for (const sub of fs.readdirSync(notesDir).sort()) {
        const dir = path.join(notesDir, sub);
        if (!fs.statSync(dir).isDirectory()) continue;
        if (!/^\d+$/.test(sub)) throw new Error(`${rel(dir)}: book folders under notes/ are numbered (01, 02, …)`);
        const book = Number(sub);
        for (const file of mdIn(dir)) read(file, { id: `${work.id}.${book}`, author: author.id, work: work.id, book });
      }
    }
  }
  return out;
}

/** Quote registries live in content/quotes/<work>.json as { work, quotes: [{ id, ref, title? }] }. */
export function loadQuotes() {
  const byId = new Map();
  for (const file of walk(path.join(CONTENT, 'quotes'), f => f.endsWith('.json'))) {
    const reg = readJson(file);
    for (const q of reg.quotes ?? []) {
      if (byId.has(q.id)) throw new Error(`${rel(file)}: duplicate quote id ${q.id}`);
      byId.set(q.id, { ...q, work: q.work ?? reg.work, file: rel(file) });
    }
  }
  return byId;
}
