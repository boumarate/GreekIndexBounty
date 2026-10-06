// Greek text utilities shared by the build, the checks, and the site.
// Tokens are the unit that the lexicon, the concordance, and the reader all agree on.

const ELISION = /[\u02BC’\u1FBD'\u1FBF]/g; // \u02BC ’ \u1FBD ' \u1FBF
const LEADING = /^[“‘«(\[⟨"]+/;
const TRAILING = /[”’»)\].,;:·;!?⟩"]+$/;

/** Split a verse into word tokens with their surrounding punctuation preserved. */
export function tokenize(line) {
  const tokens = [];
  let offset = 0;
  for (const piece of line.split(/(\s+)/)) {
    if (!piece || /^\s+$/.test(piece)) { offset += piece.length; continue; }
    const pre = piece.match(LEADING)?.[0] ?? '';
    const rest = piece.slice(pre.length);
    const post = rest.match(TRAILING)?.[0] ?? '';
    const word = rest.slice(0, rest.length - post.length);
    if (word) tokens.push({ word, pre, post, start: offset + pre.length, end: offset + pre.length + word.length });
    offset += piece.length;
  }
  return tokens;
}

/** Lowercase, strip accents/breathings/diaeresis/iota subscript, unify sigma and elision. */
export function normalize(text) {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(ELISION, '')
    .toLowerCase()
    .replace(/ς/g, 'σ')
    .normalize('NFC');
}

/** Latin transliteration used for search and ids (not a scholarly transliteration). */
const TRANSLIT = {
  α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'e', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm',
  ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', τ: 't', υ: 'y', φ: 'ph', χ: 'ch', ψ: 'ps', ω: 'o',
};
export function transliterate(text) {
  const plain = normalize(text);
  let out = '';
  for (let i = 0; i < plain.length; i++) {
    const c = plain[i], next = plain[i + 1];
    if (c === 'γ' && next && 'γκξχ'.includes(next)) { out += 'n'; continue; }
    out += TRANSLIT[c] ?? c;
  }
  return out;
}

/**
 * Readable romanization for display: rough breathing → h, η/ω → ē/ō, υ → y (u in diphthongs),
 * χ → ch, γγ/γκ → ng/nk. Accents are dropped. "Ἥρη" → "Hērē", "Ἀχιλλεύς" → "Achilleus".
 */
export function romanize(text) {
  const map = { α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'ē', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm',
    ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'ph', χ: 'ch', ψ: 'ps', ω: 'ō' };
  const words = text.normalize('NFD').split(/(\s+)/);
  return words.map(word => {
    if (/^\s+$/.test(word)) return word;
    const rough = /^[^\u0314]*?[\u0314]/.test(word) && /^[\p{L}][\u0300-\u036F]*[\u0314]|^[\p{L}][\u0300-\u036F]*[\p{L}][\u0300-\u036F]*[\u0314]/u.test(word);
    const capital = word[0] !== word[0].toLowerCase();
    const letters = [...word.replace(/[\u0300-\u036F]/g, '').toLowerCase()];
    let out = '';
    for (let i = 0; i < letters.length; i++) {
      const c = letters[i], prev = letters[i - 1], next = letters[i + 1];
      if (c === 'γ' && next && 'γκξχ'.includes(next)) { out += 'n'; continue; }
      if (c === 'υ' && prev && 'αεηο'.includes(prev)) { out += 'u'; continue; }
      if (c === 'ρ' && i === 0 && rough) { out += 'rh'; continue; }
      out += map[c] ?? c;
    }
    if (rough && letters[0] !== 'ρ') out = 'h' + out;
    return capital ? out[0].toUpperCase() + out.slice(1) : out;
  }).join('');
}

/** Does this token begin with a capital letter (a proper name in the OCT text)? */
export function isCapitalized(word) {
  const first = word.normalize('NFD')[0];
  return first !== first.toLowerCase();
}
