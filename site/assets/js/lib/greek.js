// Browser twin of scripts/lib/greek.mjs (normalization for search and matching).

const ELISION = /[\u02BC\u2019\u1FBD'\u1FBF]/g;

export function normalize(text) {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .replace(ELISION, '')
    .toLowerCase()
    .replace(/ς/g, 'σ')
    .normalize('NFC');
}

const TRANSLIT = {
  α: 'a', β: 'b', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'e', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm',
  ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', τ: 't', υ: 'y', φ: 'ph', χ: 'ch', ψ: 'ps', ω: 'o',
};

/** Loose Latin transliteration for search: "menin" finds μῆνιν, "achilleus" finds Ἀχιλλεύς. */
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

export const hasGreek = s => /[Ͱ-Ͽἀ-῿]/.test(s);

/** Fold a Latin search string the same way transliterate() folds Greek (y/u, h dropped, doubled letters kept). */
export function foldLatin(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036F]/g, '')
    .replace(/kh/g, 'ch').replace(/u/g, 'y').replace(/^h/, '').replace(/\bh/g, '').replace(/c(?!h)/g, 'k');
}
