// Unit tests for the build libraries and their browser twins. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tokenize, normalize, romanize, isCapitalized } from '../scripts/lib/greek.mjs';
import * as browserGreek from '../site/assets/js/lib/greek.js';
import { uuidv5, quoteId, isUuid } from '../scripts/lib/uuid.mjs';
import * as browserUuid from '../site/assets/js/lib/uuid.js';
import { parseRef, formatRange, makeWorkResolver, refLines } from '../scripts/lib/refs.mjs';
import { splitFrontMatter } from '../scripts/lib/frontmatter.mjs';
import { renderMarkdown } from '../scripts/lib/markdown.mjs';
import { compilePatterns, matchTokens, compileEnglish, findEnglish, resolveOverlaps } from '../scripts/lib/concordance.mjs';
import { ROOT, readLines } from '../scripts/lib/content.mjs';

// Small tokenizer fixtures, never included in the library.
const GREEK = new Map([[1, 'Ἀχιλλεύς, Ἥρη·'], [2, 'ἀλλʼ ἴθι μή μʼ ἐρέθιζε.']]);

test('tokenize keeps elision marks and strips punctuation', () => {
  const t = tokenize('ἀλλʼ ἴθι μή μʼ ἐρέθιζε σαώτερος ὥς κε νέηαι.”');
  assert.deepEqual(t.map(x => x.word), ['ἀλλʼ', 'ἴθι', 'μή', 'μʼ', 'ἐρέθιζε', 'σαώτερος', 'ὥς', 'κε', 'νέηαι']);
  assert.equal(t.at(-1).post, '.”');
  const q = tokenize('“Ἀτρεΐδαι τε καὶ');
  assert.equal(q[0].pre, '“');
  assert.equal(q[0].word, 'Ἀτρεΐδαι');
});

test('token offsets point back into the line', () => {
  for (const [, line] of GREEK) for (const t of tokenize(line)) assert.equal(line.slice(t.start, t.end), t.word);
});

test('normalize strips accents, breathings, iota subscripts, elision; unifies sigma', () => {
  assert.equal(normalize('Ἥρῃ'), 'ηρη');
  assert.equal(normalize('μυρίʼ'), 'μυρι');
  assert.equal(normalize('Ἀχιλλεύς'), 'αχιλλευσ');
  assert.equal(normalize('Ἀτρεΐδαι'), 'ατρειδαι');
});

test('browser normalize matches the build normalize on Greek fixtures', () => {
  for (const [, line] of GREEK) for (const t of tokenize(line)) assert.equal(browserGreek.normalize(t.word), normalize(t.word), t.word);
});

test('romanize', () => {
  assert.equal(romanize('Ἥρη'), 'Hērē');
  assert.equal(romanize('Ἀχιλλεύς'), 'Achilleus');
  assert.equal(romanize('ὕβρις'), 'hybris');
  assert.equal(romanize('ἄγγελος'), 'angelos');
  assert.equal(romanize('ῥοδοδάκτυλος'), 'rhododaktylos');
});

test('isCapitalized marks proper names in the OCT text', () => {
  assert.ok(isCapitalized('Ἀχιλῆος'));
  assert.ok(!isCapitalized('μῆνιν'));
});

test('uuidv5 matches the RFC 4122 test vector', () => {
  assert.equal(uuidv5('python.org', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'), '886313e1-3b8a-5372-9b90-0c9aee199e5d');
});

test('browser quote ids equal build quote ids', async () => {
  for (const q of [{ work: 'homer.iliad', ref: '1.528-530' }, { work: 'homer.iliad', ref: '1.1', title: 'The first line' }]) {
    const id = quoteId(q);
    assert.ok(isUuid(id));
    assert.equal(await browserUuid.quoteId(q), id);
  }
});

test('references parse, format and expand', () => {
  const resolve = makeWorkResolver([{ id: 'homer.iliad', title: 'Iliad', aliases: ['il', 'il.'] }]);
  const r = parseRef('Il. 1.396–406', resolve);
  assert.deepEqual(r, { work: 'homer.iliad', book: 1, from: 396, toBook: 1, to: 406 });
  assert.equal(formatRange(r), '1.396-406');
  assert.equal(formatRange(parseRef('1.5', resolve, 'homer.iliad')), '1.5');
  assert.equal(refLines(parseRef('iliad 1.1-3', resolve)).join(','), '1.1,1.2,1.3');
  assert.throws(() => parseRef('1.10-5', resolve, 'homer.iliad'));
});

test('front matter: inline lists, block lists, folded text, wiki-link values', () => {
  const src = `---\ntitle: Zeus\ntags: [olympian, "a, b"]\nrelations:\n  - father: cronus (1.498)\nsummary: >\n  one\n  two\nlead: [[Zeus]] rules.\n---\nBody`;
  const { data, body } = splitFrontMatter(src);
  assert.deepEqual(data.tags, ['olympian', 'a, b']);
  assert.deepEqual(data.relations, ['father: cronus (1.498)']);
  assert.equal(data.summary, 'one two');
  assert.equal(data.lead, '[[Zeus]] rules.');
  assert.equal(body, 'Body');
  const refs = splitFrontMatter('---\nrefs: [1.280, 1.5, 1.500]\n---\n').data.refs;
  assert.deepEqual(refs, ['1.280', '1.5', '1.500']);
});

test('markdown: headings, links, quotes, tabs, footnotes, tables', () => {
  const hooks = {
    link: t => t === 'zeus' ? { id: 'zeus', label: 'Zeus', href: '#/entry/zeus' } : { missing: true, label: t },
    quote: spec => ({ id: 'q1', href: '#/read/homer.iliad/1?l=1', short: `Il. ${spec}` }),
    ref: spec => ({ href: '#', label: spec }),
  };
  const md = '## Family\n\nSee [[zeus]] and [[nobody]].[^1]\n\n{{quote:1.1}}\n\n{{tabs}}\n{{tab:One}}\nA\n{{tab:Two}}\nB\n{{/tabs}}\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n[^1]: A note.';
  const out = renderMarkdown(md, hooks);
  assert.match(out.html, /<h2 id="family">Family<\/h2>/);
  assert.match(out.html, /class="wl" href="#\/entry\/zeus"/);
  assert.match(out.html, /class="wl missing"/);
  assert.match(out.html, /<figure class="qcard" data-quote="q1"><\/figure>/);
  assert.match(out.html, /class="tabs"/);
  assert.match(out.html, /<table>/);
  assert.match(out.html, /class="footnotes"/);
  assert.deepEqual(out.errors, []);
});

test('concordance: words, stems, phrases, accent-sensitive and capitalized-only forms', () => {
  const toks = tokenize('ἦ καὶ κυανέῃσιν ἐπʼ ὀφρύσι νεῦσε Κρονίων·').map(t => ({ ...t, norm: normalize(t.word) }));
  const hits = p => matchTokens(toks, compilePatterns([p])).map(h => toks.slice(h.start, h.end).map(t => t.word).join(' '));
  assert.deepEqual(hits('Κρονίων*'), ['Κρονίων']);
  assert.deepEqual(hits('κυανέῃσιν ἐπʼ ὀφρύσι'), ['κυανέῃσιν ἐπʼ ὀφρύσι']);
  assert.deepEqual(hits('=ἦ'), ['ἦ']);
  assert.deepEqual(hits('=ἡ'), []);
  const forest = tokenize('οἵ τε καθʼ ὕλην · Ὕλην καὶ Πετεῶνα').map(t => ({ ...t, norm: normalize(t.word) }));
  const at = p => matchTokens(forest, compilePatterns([p])).map(h => forest[h.start].word);
  assert.deepEqual(at('Ὕλην'), ['ὕλην', 'Ὕλην']);
  assert.deepEqual(at('^Ὕλην'), ['Ὕλην']);
  const women = tokenize('Τρῶας τε καὶ Τρῳὰς πάσας').map(t => ({ ...t, norm: normalize(t.word) }));
  const trojans = matchTokens(women, compilePatterns(['Τρώ*', '!=Τρῳ*']));
  assert.deepEqual(trojans.map(h => women[h.start].word), ['Τρῶας']);
  assert.equal(trojans.excluded.length, 1);
  const ranks = tokenize('Τρῳὰς δὲ στίχας οὖλος Ἄρης ὄτρυνε').map(t => ({ ...t, norm: normalize(t.word) }));
  assert.deepEqual(matchTokens(ranks, compilePatterns(['Τρώ*', '!=Τρῳ*'])).length, 0);
  assert.deepEqual(matchTokens(ranks, compilePatterns(['Τρώ*', '!=Τρῳ*', '+Τρῳὰς δὲ στίχας'])).map(h => [h.start, h.end]), [[0, 3]]);
  const en = findEnglish("the son of Cronus nodded", compileEnglish(['son of Cronus', 'Cronus']));
  assert.equal(resolveOverlaps(en).length, 1);
});

test('source files contain no invisible control or combining characters', () => {
  const files = [
    ...fs.readdirSync(path.join(ROOT, 'scripts/lib')).map(f => `scripts/lib/${f}`),
    ...fs.readdirSync(path.join(ROOT, 'scripts')).filter(f => f.endsWith('.mjs')).map(f => `scripts/${f}`),
    ...['lib', 'ui', 'views'].flatMap(d => fs.readdirSync(path.join(ROOT, 'site/assets/js', d)).map(f => `site/assets/js/${d}/${f}`)),
    'site/assets/js/app.js',
  ];
  for (const f of files) {
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const bad = [...text].find(c => { const o = c.codePointAt(0); return (o < 32 && c !== '\n' && c !== '\t') || (o >= 0x300 && o <= 0x36f); });
    assert.equal(bad, undefined, `${f} contains U+${bad?.codePointAt(0).toString(16)}; write it as an escape`);
  }
});
