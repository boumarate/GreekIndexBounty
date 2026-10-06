#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, loadLibrary } from './lib/content.mjs';
import { tokenize } from './lib/greek.mjs';
import { json, makeSubmission, renderPR, safeFile } from './lib/submission.mjs';

const [command, input] = process.argv.slice(2);
const registry = json(path.join(ROOT, 'bounties/registry.json'));
const putNew = (relative, data) => {
  const full = path.join(ROOT, relative);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
};
try {
  if (command === 'init') {
    const b = registry.units.find(b => b.id === input);
    if (!b && input !== 'infrastructure') throw new Error('Use: npm run submission -- init iliad-01 (or infrastructure)');
    if (b && !['open', 'claimed', 'in-review'].includes(b.status)) throw new Error('This bounty is not open for submissions');
    const m = makeSubmission(b);
    if (b) {
      const nn = b.unit.padStart(2, '0');
      const base = `content/library/${b.author}/${b.work.split('.').slice(1).join('/')}`;
      const planned = [`${base}/grc/${nn}.txt`, `${base}/en/${nn}.txt`, `${base}/structure/${nn}.json`, `${base}/lexicon/${nn}.json`];
      for (const f of planned) if (fs.existsSync(path.join(ROOT, f))) throw new Error(`${f} already exists; create a manifest with init infrastructure for code work, or copy the manifest template for a research revision. Existing work is never overwritten.`);
      putNew(planned[0], '# Add the verified Greek here: line<TAB>text. Never invent omitted verse IDs.\n');
      putNew(planned[1], '# Add the new line-aligned translation here: line<TAB>text.\n');
      putNew(planned[2], { scenes: [], speeches: [], days: [] });
      putNew(planned[3], {});
      fs.mkdirSync(path.join(ROOT, base, 'notes', nn), { recursive: true });
      putNew(m.research.coverageFile, []);
      putNew(m.research.sourcesFile, []);
      putNew(m.research.candidatesFile, []);
      putNew(m.research.categoriesFile, json(path.join(ROOT, 'content/kinds.json')).map(k => ({ kind: k.id, status: 'pending', explanation: '', entryIds: [] })));
      putNew(`research/${b.id}/${m.submissionId}/README.md`, `# ${b.label}: research evidence\n\nRecord sources, candidate decisions, line coverage, independent/separate audits, redacted runtime evidence, usage exports, and validation logs here. See docs/submission-format.md.\n`);
    }
    const relative = `submissions/${m.submissionId}.json`;
    putNew(relative, m);
    console.log(`Created ${relative}\nDraft placeholders deliberately fail acceptance validation. Complete the research contract in docs/research-standard.md.`);
  } else if (command === 'measure') {
    if (!input) throw new Error('Use: npm run submission -- measure submissions/<UUID>.json');
    const file = safeFile(ROOT, input), m = json(file);
    if (m.type !== 'research') throw new Error('Artifact counts apply to research submissions only');
    const text = loadLibrary().works.find(w => w.id === m.scope.work)?.texts.get(Number(m.scope.unit));
    if (!text) throw new Error('No Greek has been imported for this unit');
    m.completeness.translatedLines = [...text.editions.grc.keys()].filter(n => text.editions.en?.get(n)?.trim()).length;
    m.completeness.analyzedTokens = [...text.editions.grc].reduce((count, [n, line]) => count + tokenize(line).filter((t, i) => {
      const a = text.lexicon?.[n]?.[i]; return a?.w === t.word && ['l', 'g', 'p'].every(k => typeof a?.[k] === 'string' && a[k].trim());
    }).length, 0);
    const coverage = json(safeFile(ROOT, m.research.coverageFile));
    m.completeness.reviewedLines = [...text.editions.grc.keys()].filter(n => coverage.some(c => c.from <= n && c.to >= n && ['translationReviewed', 'lexiconReviewed', 'indexReviewed', 'researchReviewed'].every(k => c[k] === true))).length;
    fs.writeFileSync(file, JSON.stringify(m, null, 2) + '\n');
    console.log(JSON.stringify(m.completeness, null, 2));
    console.log('Updated artifact counts only. Completion status, overall percent, gaps, and runtime usage remain your honest declarations.');
  } else if (command === 'body') {
    if (!input) throw new Error('Use: npm run pr:body -- submissions/<UUID>.json');
    const m = json(safeFile(ROOT, input));
    process.stdout.write(renderPR(m, registry.units.find(b => b.id === m.bountyId)));
  } else {
    console.log('npm run submission -- init iliad-01\nnpm run submission -- init infrastructure\nnpm run pr:body -- submissions/<UUID>.json\nnpm run validate -- --submission submissions/<UUID>.json');
  }
} catch (e) { console.error(e.message); process.exitCode = 1; }
