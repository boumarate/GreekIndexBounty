import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { ROOT } from '../scripts/lib/content.mjs';
import { json, makeSubmission, validateMetadata, safeFile, METRICS, renderPR } from '../scripts/lib/submission.mjs';
import { validateBook, validateChangeSet } from '../scripts/validate.mjs';
import { tokenize } from '../scripts/lib/greek.mjs';
import { renderMarkdown } from '../scripts/lib/markdown.mjs';

const policy = json(path.join(ROOT, 'bounties/policy.json'));
const bounty = json(path.join(ROOT, 'bounties/registry.json')).units[0];
function temp(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'greek-index-test-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; }
function put(root, file, data) { const f = path.join(root, file); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, typeof data === 'string' ? data : JSON.stringify(data, null, 2)); }
function completed(root, b = null) {
  const m = makeSubmission(b);
  const prefix = b ? `research/${b.id}/${m.submissionId}` : `research/infrastructure/${m.submissionId}`;
  const evidence = `${prefix}/evidence.md`;
  put(root, evidence, 'Synthetic test evidence only; not a real agent run.');
  Object.assign(m.agents[0], { modelName: 'Opus 5.5', modelId: 'synthetic-provider-id', runtime: 'test-runtime', runtimeVersion: '1', sessionId: 'synthetic-session', reasoningEffort: 'not-exposed', thinkingMode: 'not-exposed', unavailableReason: 'Fixture runtime has no usage API or budget setting.' });
  Object.assign(m.usage, { startedAt: '2026-10-06T00:00:00Z', finishedAt: '2026-10-06T00:00:10Z', wallSeconds: 10, measurementSource: evidence, unavailableReason: 'Fixture has no usage API.' });
  Object.assign(m, { status: 'complete', changes: 'Synthetic regression fixture.' });
  m.provenance = { statement: 'Synthetic declared attribution for validator testing.', evidenceFiles: [evidence], limitations: 'Self-report, not authenticated model identity.' };
  m.completeness.overallPercent = 100;
  m.validation = [{ command: 'synthetic test', result: 'passed', log: evidence }];
  m.payout.contact = '@synthetic-test';
  if (b) {
    for (const k of ['coverageFile', 'sourcesFile', 'candidatesFile', 'categoriesFile']) put(root, m.research[k], []);
    m.research.audits = policy.requiredAudits.map(kind => ({ kind, agentId: 'lead', method: 'separate-pass', report: evidence, result: 'passed', issuesFound: 1, issuesResolved: 1 }));
  }
  return m;
}

test('eligible model, explicit unavailable metrics, and a complete evidence record pass metadata checks', t => {
  const root = temp(t), m = completed(root);
  assert.deepEqual(validateMetadata(m, { policy, root }), []);
  m.agents[0].modelName = 'Fable 5.5';
  assert.deepEqual(validateMetadata(m, { policy, root }), []);
});

test('drafts, ineligible writers, false totals, absent evidence, and misnamed independent audits fail', t => {
  const root = temp(t), m = completed(root, bounty);
  const errors = x => validateMetadata(x, { policy, root, bounty }).join('\n');
  const mutate = fn => { const x = structuredClone(m); fn(x); return errors(x); };
  assert.match(mutate(x => { x.status = 'draft'; }), /must be complete/);
  assert.match(mutate(x => { x.agents[0].modelName = 'Another model'; }), /ineligible/);
  assert.match(mutate(x => { x.agents.push({ ...x.agents[0], id: 'worker', role: 'writer', modelName: 'Another model' }); x.subagentCount = 1; }), /ineligible/);
  assert.match(mutate(x => { x.usage.inputTokens = 0; }), /must be null/);
  assert.match(mutate(x => { x.subagentCount = 4; }), /subagentCount/);
  assert.match(mutate(x => { x.usage.wallSeconds = 100; }), /elapsed timestamps/);
  assert.match(mutate(x => { x.provenance.evidenceFiles = []; }), /evidence files required/);
  assert.match(mutate(x => { x.research.audits[0].method = 'independent-agent'; }), /cannot be the lead/);
  assert.match(mutate(x => { x.research.audits = []; }), /missing translation audit/);
  assert.match(mutate(x => { x.completeness.remainingGaps = ['untranslated passage']; }), /scope gaps/);
});

test('aggregate usage is the sum across actual agents, including cached token categories', t => {
  const root = temp(t), m = completed(root);
  m.agents[0].metrics = Object.fromEntries(METRICS.map(k => [k, 5]));
  m.agents.push({ ...structuredClone(m.agents[0]), id: 'reviewer', role: 'reviewer' });
  m.subagentCount = 1;
  for (const k of METRICS) m.usage[k] = 10;
  assert.deepEqual(validateMetadata(m, { root, policy }), []);
  m.usage.inputTokens = 5;
  assert.match(validateMetadata(m, { root, policy }).join('\n'), /agent sum/);
});

test('evidence paths cannot escape the repository, including through symlinks', t => {
  const root = temp(t);
  assert.throws(() => safeFile(root, '../outside'));
  put(root, 'inside.md', 'text');
  fs.symlinkSync(path.join(root, 'inside.md'), path.join(root, 'link.md'));
  assert.throws(() => safeFile(root, 'link.md'), /regular in-repository/);
});

test('Greek completeness, token alignment, morphology, and scene coverage fail independently', () => {
  const b = { ...bounty, expected: { from: 1, to: 2, omitted: [] } };
  const w = { id: 'homer.iliad' };
  const t = { editions: { grc: new Map([[1, 'καί'], [2, 'δέ']]), en: new Map([[1, 'and'], [2, 'but']]) }, lexicon: { 1: [{ w: 'καί', l: 'καί', g: 'and', p: 'conj.' }], 2: [{ w: 'δέ', l: 'δέ', g: 'but', p: 'particle' }] }, structure: { scenes: [{ from: 1, to: 2, title: 'Fixture' }] }, witnesses: {} };
  const check = x => validateBook(w, 1, x, b, [], tokenize).join('\n');
  assert.equal(check(t), '');
  const noEnglish = structuredClone(t); noEnglish.editions.en.delete(2); assert.match(check(noEnglish), /same lines/);
  const noMorph = structuredClone(t); noMorph.lexicon[2][0].p = ''; assert.match(check(noMorph), /lexical analysis/);
  const noScene = structuredClone(t); noScene.structure.scenes[0].to = 1; assert.match(check(noScene), /scene gap/);
  const short = structuredClone(t); short.editions.grc.delete(2); assert.match(check(short), /inventory/);
});

test('documented indirect witnesses may restore base gaps; silent inserted verses may not', () => {
  const b = { ...bounty, expected: { from: 1, to: 3, omitted: [2] } };
  const t = { editions: { grc: new Map([[1, 'καί'], [2, 'δέ'], [3, 'καί']]), en: new Map([[1, 'and'], [2, 'but'], [3, 'and']]) }, lexicon: Object.fromEntries([1, 2, 3].map(n => [n, [{ w: n === 2 ? 'δέ' : 'καί', l: 'καί', g: 'and', p: 'conj.' }]])), structure: { scenes: [{ from: 1, to: 3, title: 'Fixture' }] }, witnesses: {} };
  const check = () => validateBook({ id: 'homer.iliad' }, 1, t, b, [], tokenize).join('\n');
  assert.match(check(), /inventory/);
  t.witnesses[2] = { kind: 'indirect-witness', greek: 'δέ', source: { author: 'Fixture author', work: 'Fixture work', locator: '1.1', url: 'https://example.org/witness', accessedAt: '2026-10-06', rights: 'Synthetic fixture' }, editorialNote: 'A regression fixture, not a claim about a real verse.', basis: 'Synthetic placement.', certainty: 'Test only' };
  assert.equal(check(), '');
  t.witnesses[2].source.locator = ''; assert.match(check(), /source.locator/);
});

test('research cannot edit its eligibility checks, other books, or prior manifests', () => {
  const m = makeSubmission(bounty), manifest = `submissions/${m.submissionId}.json`;
  const check = paths => validateChangeSet(paths, [manifest], m, bounty).join('\n');
  assert.equal(check([manifest, 'content/library/homer/iliad/en/01.txt', 'content/index/people/achilles.md']), '');
  for (const f of ['bounties/policy.json', '.github/workflows/submission-policy.yml', 'scripts/validate.mjs', 'content/library/homer/iliad/en/02.txt', 'submissions/old.json']) assert.match(check([manifest, f]), /outside its contract/);
  m.type = 'infrastructure'; assert.match(check([manifest, 'content/library/homer/iliad/grc/01.txt']), /bypass/);
});

test('generated PR body carries one exact manifest marker and key disclosures', t => {
  const root = temp(t), m = completed(root, bounty), body = renderPR(m, bounty);
  assert.ok(body.includes(`<!-- greek-index-bounty: submissions/${m.submissionId}.json -->`));
  for (const word of ['Opus 5.5', 'Subagents', 'wall seconds', 'inputTokens', 'cacheReadTokens', 'Remaining gaps', '100%']) assert.ok(body.includes(word), word);
});

test('unsafe Markdown protocols are rejected without rendering an executable link', () => {
  for (const url of ['javascript:alert', 'data:text/html,boom', '//untrusted.example']) {
    const r = renderMarkdown(`[link](${url})`, {});
    assert.ok(r.errors.length); assert.ok(!r.html.includes('href='));
  }
});

test('scaffolding refuses overwrites and its placeholders cannot pass acceptance', t => {
  const root = temp(t);
  for (const d of ['scripts', 'content', 'bounties']) fs.cpSync(path.join(ROOT, d), path.join(root, d), { recursive: true });
  execFileSync(process.execPath, [path.join(root, 'scripts/submission.mjs'), 'init', 'iliad-01']);
  const manifest = fs.readdirSync(path.join(root, 'submissions')).find(f => f.endsWith('.json'));
  assert.ok(manifest);
  const again = spawnSync(process.execPath, [path.join(root, 'scripts/submission.mjs'), 'init', 'iliad-01'], { encoding: 'utf8' });
  assert.notEqual(again.status, 0); assert.match(again.stderr, /already exists/);
  const validation = spawnSync(process.execPath, [path.join(root, 'scripts/validate.mjs'), '--submission', `submissions/${manifest}`], { encoding: 'utf8' });
  assert.notEqual(validation.status, 0); assert.match(validation.stderr, /Greek text is empty|must be complete/);
});

test('complete synthetic research passes the full CLI; missing coverage then fails', t => {
  const root = temp(t);
  for (const d of ['scripts', 'content', 'bounties']) fs.cpSync(path.join(ROOT, d), path.join(root, d), { recursive: true });
  const reg = json(path.join(root, 'bounties/registry.json'));
  reg.units[0].expected = { from: 1, to: 2, omitted: [] }; put(root, 'bounties/registry.json', reg);
  const b = reg.units[0], m = completed(root, b), prefix = 'content/library/homer/iliad';
  put(root, `${prefix}/grc/01.txt`, '1\tκαί\n2\tδέ\n');
  put(root, `${prefix}/en/01.txt`, '1\tand\n2\tbut\n');
  put(root, `${prefix}/lexicon/01.json`, { 1: [{ w: 'καί', l: 'καί', g: 'and', p: 'conj.' }], 2: [{ w: 'δέ', l: 'δέ', g: 'but', p: 'particle' }] });
  put(root, `${prefix}/structure/01.json`, { scenes: [{ from: 1, to: 2, title: 'Synthetic fixture' }], speeches: [], days: [] });
  put(root, 'content/index/words/fixture.md', '---\ntitle: Fixture\nkind: term\nsummary: A synthetic test record.\n---\nThis is a synthetic regression fixture, never a published article.\n');
  Object.assign(m.completeness, { translatedLines: 2, analyzedTokens: 2, reviewedLines: 2 });
  put(root, m.research.coverageFile, [{ from: 1, to: 2, translationReviewed: true, lexiconReviewed: true, indexReviewed: true, researchReviewed: true, entryIds: ['fixture'], note: 'Both synthetic tokens reviewed.' }]);
  put(root, m.research.sourcesFile, ['primary', 'lexical', 'scholarship'].map(kind => ({ id: kind, kind, title: 'Synthetic source', url: 'https://example.org/fixture', locator: 'Fixture 1', accessedAt: '2026-10-06', access: 'consulted', rights: 'Synthetic test', finding: 'Fixture only', entryIds: ['fixture'] })));
  put(root, m.research.candidatesFile, [{ title: 'Fixture', kind: 'term', lines: [1, 2], disposition: 'created', entryId: 'fixture', reason: 'Test coverage' }]);
  put(root, m.research.categoriesFile, json(path.join(root, 'content/kinds.json')).map(k => ({ kind: k.id, status: k.id === 'term' ? 'reviewed' : 'not-applicable', explanation: 'Synthetic two-token example.', entryIds: k.id === 'term' ? ['fixture'] : [] })));
  const manifest = `submissions/${m.submissionId}.json`; put(root, manifest, m);
  const run = () => spawnSync(process.execPath, [path.join(root, 'scripts/validate.mjs'), '--submission', manifest], { encoding: 'utf8' });
  const ok = run(); assert.equal(ok.status, 0, ok.stdout + ok.stderr);
  put(root, m.research.coverageFile, []);
  const bad = run(); assert.notEqual(bad.status, 0); assert.match(bad.stderr, /coverage ledger/);
});

test('trusted validator rejects proposed policy/script changes that try to permit another model', t => {
  const sandbox = temp(t), trusted = path.join(sandbox, 'trusted'), proposed = path.join(sandbox, 'proposed');
  for (const root of [trusted, proposed]) for (const d of ['scripts', 'content', 'bounties']) fs.cpSync(path.join(ROOT, d), path.join(root, d), { recursive: true });
  const git = args => execFileSync('git', args, { cwd: proposed, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git(['init', '-b', 'main']); git(['config', 'user.name', 'Synthetic test']); git(['config', 'user.email', 'test@example.org']); git(['add', '.']); git(['commit', '-m', 'Synthetic base']);
  const base = git(['rev-parse', 'HEAD']);
  const m = completed(proposed); m.agents[0].modelName = 'Another model';
  const manifest = `submissions/${m.submissionId}.json`; put(proposed, manifest, m);
  put(proposed, 'bounties/policy.json', { ...policy, eligibleModels: ['Another model'] });
  put(proposed, 'scripts/validate.mjs', 'process.exit(0);');
  git(['add', '.']); git(['commit', '-m', 'Synthetic tampered proposal']);
  const event = path.join(sandbox, 'event.json'); fs.writeFileSync(event, JSON.stringify({ pull_request: { body: renderPR(m) } }));
  const run = spawnSync(process.execPath, [path.join(trusted, 'scripts/validate.mjs'), '--root', proposed, '--base', base], { encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_PATH: event } });
  assert.notEqual(run.status, 0); assert.match(run.stderr, /ineligible provider\/model/);
});
