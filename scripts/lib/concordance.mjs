// The concordance: finds index entries in the Greek (by form patterns) and in the English
// (by name forms), line by line. Patterns come from each entry's `grc` list:
//   Ἀχιλῆος        one word, compared without accents or breathings
//   Ἀχιλλ*         a stem: any word beginning with these letters
//   πόδας ὠκὺς     a phrase of consecutive words
//   =ἦ             accent-sensitive comparison (rarely needed)
//   ^Ὕλην          only when capitalized: the name, not the common word (ὕλην "forest")
//   !=Τρῳ*         an exclusion: words the entry's other patterns must not claim (Τρώ* "Trojans"
//                  without Τρῳαί "Trojan women")
//   +Τρῳὰς δὲ στίχας  a forced pattern, which the entry's exclusions do not drop ("the Trojan
//                  ranks", 5.461, though a Τρῳ- word is otherwise the Trojan women)
import { normalize, isCapitalized } from './greek.mjs';

export function compilePatterns(forms = []) {
  return forms.map(source => {
    const trimmed = String(source).trim();
    const not = trimmed.startsWith('!');
    const force = trimmed.startsWith('+');
    const body = not || force ? trimmed.slice(1) : trimmed;
    const parts = body.trim().split(/\s+/).map(p => {
      const name = p.startsWith('^');
      const rest = name ? p.slice(1) : p;
      const exact = rest.startsWith('=');
      const raw = exact ? rest.slice(1) : rest;
      const prefix = raw.endsWith('*');
      const text = prefix ? raw.slice(0, -1) : raw;
      return { name, exact, prefix, text: exact ? text.normalize('NFC').toLowerCase() : normalize(text) };
    });
    return { source: String(source), parts, not, force };
  });
}

function partMatches(part, token) {
  if (part.name && !isCapitalized(token.word)) return false;
  const value = part.exact ? token.word.normalize('NFC').toLowerCase() : token.norm;
  return part.prefix ? value.startsWith(part.text) : value === part.text;
}

const matchesAt = (pattern, tokens, i) =>
  i + pattern.parts.length <= tokens.length && pattern.parts.every((part, k) => partMatches(part, tokens[i + k]));

/**
 * Return [{start, end, pattern}] token-index spans (end exclusive). A span that contains a word an
 * exclusion (!) matches is dropped, unless its pattern is forced (+); the exclusions that dropped
 * something are listed in `hits.excluded`.
 */
export function matchTokens(tokens, patterns) {
  const hits = [], excluded = new Set();
  const nots = patterns.filter(p => p.not);
  for (const pattern of patterns) {
    if (pattern.not) continue;
    const n = pattern.parts.length;
    for (let i = 0; i + n <= tokens.length; i++) {
      if (!matchesAt(pattern, tokens, i)) continue;
      const by = !pattern.force && nots.find(q => { for (let j = i; j < i + n; j++) if (matchesAt(q, tokens, j)) return true; return false; });
      if (by) excluded.add(by);
      else hits.push({ start: i, end: i + n, pattern });
    }
  }
  hits.excluded = [...excluded];
  return hits;
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Compile English name forms into regular expressions with word boundaries. */
export function compileEnglish(forms = []) {
  return forms.filter(Boolean).map(form => {
    const f = String(form);
    const caseSensitive = /^\p{Lu}/u.test(f);
    const body = escapeRe(f).replace(/'/g, "['\u2019]");
    return { form: f, re: new RegExp(`(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`, caseSensitive ? 'gu' : 'giu') };
  });
}

export function findEnglish(text, compiled) {
  const spans = [];
  for (const { form, re } of compiled) {
    re.lastIndex = 0;
    for (const m of text.matchAll(re)) spans.push({ start: m.index, end: m.index + m[0].length, form });
  }
  return spans;
}

/** Keep the longest non-overlapping spans; ties go to the earlier candidate (callers sort by priority). */
export function resolveOverlaps(spans) {
  const sorted = [...spans].sort((a, b) => (b.end - b.start) - (a.end - a.start) || (a.priority ?? 0) - (b.priority ?? 0) || a.start - b.start);
  const taken = [];
  for (const s of sorted) if (!taken.some(t => s.start < t.end && t.start < s.end)) taken.push(s);
  return taken.sort((a, b) => a.start - b.start);
}
