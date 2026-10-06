// Content integrity: the whole library builds cleanly and stays internally consistent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../scripts/build.mjs';
import { loadLibrary } from '../scripts/lib/content.mjs';

const result = build({ write: false, log: () => {} });

test('the build has no errors', () => {
  assert.deepEqual(result.errors, []);
});

test('every capitalized Greek word is indexed', () => {
  assert.deepEqual(result.report.unindexedNames, []);
});

test('every [[link]] points to an entry', () => {
  assert.deepEqual(result.report.missingLinks, []);
});

test('every Greek line has a translation', () => {
  for (const w of loadLibrary().works) for (const [book, t] of w.texts) {
    for (const n of t.editions.grc.keys()) assert.ok(t.editions.en?.get(n), `${w.id} ${book}.${n} has no English`);
  }
});

test('every quote in the registry resolves to real lines', () => {
  assert.deepEqual(result.errors.filter(e => /quote/i.test(e)), []);
});

test('speeches in the structure files match the quotation marks of the Greek', () => {
  for (const w of loadLibrary().works) for (const [book, t] of w.texts) {
    const grc = t.editions.grc;
    const starts = new Set((t.structure.speeches ?? []).map(s => s.from));
    for (const s of t.structure.speeches ?? []) {
      assert.ok(grc.get(s.from)?.trimStart().startsWith('“'), `${w.id} ${book}.${s.from}: speech does not open with “`);
      assert.ok(grc.get(s.to)?.includes('”'), `${w.id} ${book}.${s.to}: speech does not close with ”`);
    }
    for (const [n, line] of grc) if (line.includes('“')) assert.ok(starts.has(n), `${w.id} ${book}.${n}: a speech opens here but is not in the structure file`);
  }
});

test('scenes cover every line exactly once, in order', () => {
  for (const w of loadLibrary().works) for (const [book, t] of w.texts) {
    const scenes = t.structure.scenes ?? [];
    if (!scenes.length) continue;
    const lines = [...t.editions.grc.keys()].sort((a, b) => a - b);
    assert.equal(scenes[0].from, lines[0]);
    assert.equal(scenes.at(-1).to, lines.at(-1));
    for (const n of lines) assert.equal(scenes.filter(s => s.from <= n && s.to >= n).length, 1, `${w.id} ${book}.${n}: scene gap or overlap`);
  }
});
