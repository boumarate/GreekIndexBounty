#!/usr/bin/env node
// Run this file from the trusted base checkout against a proposed content tree.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { preflight } from './lib/preflight.mjs';
import { json, nonempty, safeFile, validateMetadata } from './lib/submission.mjs';

export function validateResearch(m, { root, bounty, policy, library, entries, kinds }) {
  const errors = [], need = (ok, msg) => { if (!ok) errors.push(msg); };
  const read = p => json(safeFile(root, p));
  const work = library.works.find(w => w.id === bounty.work);
  const text = work?.texts.get(Number(bounty.unit));
  if (!text) return ['the bounty has no submitted Greek text'];
  const greek = text.editions.grc, actualLines = [...greek.keys()];
  const tokens = Object.values(text.lexicon ?? {}).reduce((n, row) => n + (Array.isArray(row) ? row.length : 0), 0);
  const byId = new Map(entries.map(e => [e.id, e]));
  const checkEntries = (ids, at) => {
    need(Array.isArray(ids), `${at}: entryIds must be an array`);
    for (const id of ids ?? []) {
      const e = byId.get(id);
      need(!!e && nonempty(e.body) && nonempty(e.data.summary), `${at}: ${id} needs a researched article and summary`);
    }
  };
  need(m.completeness.translatedLines === greek.size, 'translatedLines does not equal source line count');
  need(m.completeness.analyzedTokens === tokens, 'analyzedTokens does not equal lexicon token count');
  need(m.completeness.reviewedLines === greek.size, 'reviewedLines does not equal source line count');
  const coverage = read(m.research.coverageFile);
  need(Array.isArray(coverage) && coverage.length > 0, 'coverage ledger must be a nonempty array');
  const seen = new Set();
  for (const c of coverage) {
    need(Number.isInteger(c.from) && Number.isInteger(c.to) && c.to >= c.from && c.to - c.from < policy.researchBlockMaxLines, 'coverage blocks must span 1–25 numbered lines');
    need(greek.has(c.from) && greek.has(c.to), 'coverage endpoints must exist in the source');
    for (const k of ['translationReviewed', 'lexiconReviewed', 'indexReviewed', 'researchReviewed']) need(c[k] === true, `coverage ${c.from}: ${k} must be true`);
    need(nonempty(c.note), `coverage ${c.from}: record actual findings/decisions`);
    checkEntries(c.entryIds, `coverage ${c.from}`);
    for (const n of actualLines.filter(n => n >= c.from && n <= c.to)) { need(!seen.has(n), `coverage overlaps at ${n}`); seen.add(n); }
  }
  need(seen.size === greek.size, 'coverage ledger does not review every extant line');
  const sources = read(m.research.sourcesFile);
  need(Array.isArray(sources), 'sources must be an array');
  need(new Set(sources.map(s => s.id)).size === sources.length, 'source ids must be unique');
  for (const k of policy.requiredSourceKinds) need(sources.some(s => s.kind === k), `consult and log a ${k} source`);
  for (const s of sources) {
    for (const k of ['id', 'title', 'locator', 'accessedAt', 'finding', 'rights']) need(nonempty(s[k]), `source ${s.id}: missing ${k}`);
    need(/^\d{4}-\d{2}-\d{2}$/.test(s.accessedAt), `source ${s.id}: accessedAt must be YYYY-MM-DD`);
    need(/^https?:\/\//.test(s.url ?? ''), `source ${s.id}: a stable public source/bibliographic URL is required`);
    need(s.access === 'consulted', `source ${s.id}: only actually consulted evidence counts; record inaccessible leads in gaps`);
    checkEntries(s.entryIds, `source ${s.id}`);
  }
  const candidates = read(m.research.candidatesFile);
  need(Array.isArray(candidates) && candidates.length > 0, 'record the article candidate inventory');
  for (const c of candidates) {
    need(nonempty(c.title) && nonempty(c.reason), 'candidate needs title and a disposition rationale');
    need(kinds.some(k => k.id === c.kind), `candidate ${c.title}: unknown kind`);
    need(Array.isArray(c.lines) && c.lines.length > 0 && c.lines.every(n => greek.has(n)), `candidate ${c.title}: lines must exist in this unit`);
    need(['created', 'expanded', 'covered', 'omitted'].includes(c.disposition), `candidate ${c.title}: invalid disposition`);
    if (c.disposition !== 'omitted') checkEntries([c.entryId], `candidate ${c.title}`);
  }
  const categories = read(m.research.categoriesFile);
  need(Array.isArray(categories), 'categories must be an array');
  need(new Set(categories.map(c => c.kind)).size === categories.length, 'duplicate category reviews');
  need(categories.length === kinds.length, 'category review must contain every configured article kind exactly once');
  for (const k of kinds) {
    const c = categories.find(c => c.kind === k.id);
    need(!!c && ['reviewed', 'not-applicable'].includes(c.status) && nonempty(c.explanation), `review the ${k.id} category, even when absent`);
    if (c) { checkEntries(c.entryIds, `category ${k.id}`); if (c.status === 'not-applicable') need(c.entryIds.length === 0, `absent category ${k.id} cannot list entries`); }
  }
  return errors;
}

export function validateBook(work, book, text, bounty, entries, tokenize) {
  const errors = [], need = (ok, msg) => { if (!ok) errors.push(`${work.id} ${book}: ${msg}`); };
  const grc = text.editions.grc, en = text.editions.en;
  need(grc?.size > 0, 'Greek text is empty');
  need(!!bounty, 'no registered research unit; add the unit in a maintainer-reviewed infrastructure change first');
  if (bounty) {
    need(bounty.citationScheme === 'book.line', 'citation adapter not implemented; do not flatten native references');
    const expected = Array.from({ length: bounty.expected.to - bounty.expected.from + 1 }, (_, i) => i + bounty.expected.from).filter(n => !bounty.expected.omitted.includes(n) || text.witnesses?.[n]);
    need(JSON.stringify([...grc.keys()].sort((a, b) => a - b)) === JSON.stringify(expected), 'source verse ids differ from the base inventory plus documented supplements');
  }
  for (const [n, witness] of Object.entries(text.witnesses ?? {})) {
    need(bounty?.expected.omitted.includes(Number(n)), `supplement ${n} must occupy a documented base-source gap`);
    need(grc.get(Number(n)) === witness.greek, `supplement ${n}: Greek must match its witness record`);
    for (const k of ['author', 'work', 'locator', 'url', 'accessedAt', 'rights']) need(nonempty(witness.source?.[k]), `supplement ${n}: source.${k} is required`);
    need(/^https?:\/\//.test(witness.source?.url ?? ''), `supplement ${n}: source URL must use http(s)`);
    for (const k of ['editorialNote', 'basis', 'certainty']) need(nonempty(witness[k]), `supplement ${n}: ${k} is required`);
    need(witness.kind === 'indirect-witness' || witness.kind === 'edition-supplement', `supplement ${n}: unknown kind`);
  }
  need(!!en && en.size === grc.size, 'English must cover the same lines as Greek');
  need(!!text.lexicon && Object.keys(text.lexicon).length === grc.size, 'lexicon must cover every line and no extra lines');
  for (const [n, line] of grc) {
    need(nonempty(line) && nonempty(en?.get(n)), `line ${n} requires Greek and English`);
    const ts = tokenize(line), row = text.lexicon?.[n];
    need(Array.isArray(row) && row.length === ts.length, `line ${n}: token count mismatch`);
    ts.forEach((t, i) => { const a = row?.[i]; need(a?.w === t.word && ['l', 'g', 'p'].every(k => nonempty(a?.[k])), `line ${n}, token ${i + 1}: missing or misaligned lexical analysis`); });
  }
  const ids = new Set(entries.map(e => e.id));
  const scenes = text.structure.scenes ?? [];
  need(scenes.length > 0, 'scenes must cover the whole book');
  for (const s of scenes) need(grc.has(s.from) && grc.has(s.to) && s.to >= s.from && nonempty(s.title), 'scene needs valid boundaries and title');
  for (const n of grc.keys()) need(scenes.filter(s => s.from <= n && s.to >= n).length === 1, `line ${n}: scene gap/overlap`);
  for (let i = 1; i < scenes.length; i++) need(scenes[i].from > scenes[i - 1].to, 'scenes must be in reading order');
  for (const s of text.structure.speeches ?? []) {
    need(grc.has(s.from) && grc.has(s.to) && s.to >= s.from, 'invalid speech boundaries');
    need(ids.has(s.speaker), `unknown speaker ${s.speaker}`);
    for (const a of s.to_whom ?? []) need(ids.has(a), `unknown addressee ${a}`);
  }
  for (const d of text.structure.days ?? []) need(grc.has(d.from) && grc.has(d.to) && d.to >= d.from, 'invalid narrative day boundaries');
  return errors;
}

export function validateChangeSet(changed, manifests, m, bounty) {
  const errors = [];
  if (manifests.length !== 1 || !/^submissions\/[0-9a-f-]+\.json$/.test(manifests[0])) errors.push('Each PR must add exactly one submissions/<UUID>.json manifest. Do not edit historical manifests.');
  if (m.type === 'research') {
    const workFolder = `content/library/${bounty.author}/${bounty.work.split('.').slice(1).join('/')}/`;
    const nn = String(bounty.unit).padStart(2, '0');
    for (const f of changed) {
      const allowed = f === `submissions/${m.submissionId}.json` || f.startsWith(`research/${bounty.id}/${m.submissionId}/`) ||
        /^content\/index\/[^/]+\/[^/]+\.md$/.test(f) || /^content\/quotes\/[^/]+\.json$/.test(f) ||
        ['content/tags.json', 'content/periods.json'].includes(f) ||
        ['grc', 'en'].some(d => f === `${workFolder}${d}/${nn}.txt`) ||
        ['lexicon', 'structure', 'witnesses'].some(d => f === `${workFolder}${d}/${nn}.json`) ||
        f.startsWith(`${workFolder}notes/${nn}/`) && f.endsWith('.md') ||
        f === `${workFolder}TRANSLATION.md`;
      if (!allowed) errors.push(`Research PR changes a file outside its contract: ${f}`);
    }
  }
  if (m.type === 'infrastructure' && changed.some(f => /^content\/library\/.*\/(grc|en|lexicon|structure|witnesses)\//.test(f) || /^content\/index\//.test(f))) errors.push('Book research cannot bypass its bounty contract through an infrastructure PR.');
  return errors;
}

async function main() {
  const args = process.argv.slice(2), value = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
  const trusted = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const root = fs.realpathSync(path.resolve(value('--root') ?? trusted));
  process.env.GIB_ROOT = root;
  // Never follow contribution symlinks before invoking any content loaders.
  const scan = dir => { if (!fs.existsSync(dir)) return; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { if (e.name === '.git') continue; const f = path.join(dir, e.name); if (e.isSymbolicLink()) throw new Error(`Symlinks are not accepted: ${path.relative(root, f)}`); if (e.isDirectory()) scan(f); } };
  for (const d of ['content', 'submissions', 'research', 'bounties']) scan(path.join(root, d));
  const prelim = preflight(root);
  if (prelim.length) throw new Error(prelim.join('\n'));
  const registry = json(path.join(trusted, 'bounties/registry.json'));
  const policy = json(path.join(trusted, 'bounties/policy.json'));
  const { loadLibrary, loadEntries } = await import('./lib/content.mjs');
  const { tokenize } = await import('./lib/greek.mjs');
  const { build } = await import('./build.mjs');
  for (const e of loadEntries()) if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.id)) throw new Error(`Invalid article ID: ${e.id}`);
  const result = build({ write: false });
  const errors = [...result.errors, ...result.warnings, ...result.report.missingLinks.map(x => `Broken link: ${JSON.stringify(x)}`), ...result.report.unindexedNames.map(x => `Unindexed name: ${x}`), ...result.report.unsavedQuotes.map(x => `Unregistered quote: ${x}`)];
  const library = loadLibrary(), entries = loadEntries();
  for (const w of library.works) for (const [book, t] of w.texts) errors.push(...validateBook(w, book, t, registry.units.find(b => b.work === w.id && b.unit === String(book)), entries, tokenize));
  let manifest = value('--submission');
  const base = value('--base');
  let changed = [], manifests = [];
  if (base) {
    if (!/^[0-9a-f]{40}$/.test(base)) throw new Error('--base requires a full commit SHA');
    const names = filter => execFileSync('git', ['diff', '--name-only', '-z', ...(filter ? [`--diff-filter=${filter}`] : []), base, 'HEAD'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
    changed = names();
    manifests = names('A').filter(f => /^submissions\/.*\.json$/.test(f));
    if (manifests.length !== 1 || changed.filter(f => /^submissions\/.*\.json$/.test(f)).length !== 1) throw new Error('Each PR must add exactly one manifest and leave historical manifests unchanged');
    manifest = manifests[0];
    const event = json(process.env.GITHUB_EVENT_PATH);
    const marker = event.pull_request?.body?.match(/<!-- greek-index-bounty: (submissions\/[0-9a-f-]+\.json) -->/g) ?? [];
    if (marker.length !== 1 || marker[0] !== `<!-- greek-index-bounty: ${manifest} -->`) errors.push('PR body must contain exactly the manifest marker produced by npm run pr:body');
  }
  if (manifest) {
    const m = json(safeFile(root, manifest));
    if (manifest !== `submissions/${m.submissionId}.json`) errors.push('manifest filename must match submissionId');
    const bounty = registry.units.find(b => b.id === m.bountyId);
    const metaErrors = validateMetadata(m, { policy, bounty, root }); errors.push(...metaErrors);
    if (!metaErrors.length && m.type === 'research') errors.push(...validateResearch(m, { root, bounty, policy, library, entries, kinds: json(path.join(root, 'content/kinds.json')) }));
    if (base && (m.type !== 'research' || bounty)) errors.push(...validateChangeSet(changed, manifests, m, bounty));
  }
  if (errors.length) { console.error([...new Set(errors)].map(e => `  FAIL ${e}`).join('\n')); process.exitCode = 1; }
  else console.log(`Validation passed${manifest ? `: ${manifest}` : ' (content only; use --submission to check a PR manifest)'}.`);
}
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e.message); process.exitCode = 1; });
