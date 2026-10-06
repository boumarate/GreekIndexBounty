// A small, strict YAML subset for entry front matter:
//   key: value            key: [a, b, "c, d"]           key: >   (folded text)
//   key:                                                 key: |   (literal text)
//     - item
// Values are strings, numbers, or booleans. Anything fancier is a build error, on purpose.

export function splitFrontMatter(source, file = '') {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  if (!text.startsWith('---\n')) return { data: {}, body: text };
  const end = text.indexOf('\n---', 4);
  if (end < 0) throw new Error(`${file}: front matter is not closed with ---`);
  const after = text.indexOf('\n', end + 4);
  return {
    data: parseYaml(text.slice(4, end), file),
    body: after < 0 ? '' : text.slice(after + 1),
  };
}

/** List items are always strings: "1.280" is a line reference, not the number 1.28. */
function text(raw) {
  const v = raw.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1).replace(/\\"/g, '"');
  return v;
}

function scalar(raw) {
  const v = raw.trim();
  if (v === '') return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\"/g, '"');
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

function inlineList(raw, file, key) {
  const inner = raw.trim().slice(1, -1);
  const items = [];
  let cur = '', quote = null;
  for (const ch of inner) {
    if (quote) { if (ch === quote) quote = null; cur += ch; continue; }
    if ((ch === '"' || ch === "'") && !cur.trim()) { quote = ch; cur += ch; continue; }
    if (ch === ',') { items.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (quote) throw new Error(`${file}: unterminated quote in list "${key}"`);
  if (cur.trim()) items.push(cur);
  return items.map(text).filter(v => v !== '');
}

export function parseYaml(block, file = '') {
  const data = {};
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m = line.match(/^([A-Za-z_][\w-]*):(.*)$/);
    if (!m) throw new Error(`${file}: cannot parse front matter line: ${line}`);
    const [, key, rest] = m;
    const value = rest.trim();
    if (value === '>' || value === '|') {
      const parts = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || lines[i + 1].trim() === '')) {
        parts.push(lines[++i].trim());
      }
      data[key] = value === '>' ? parts.join(' ').replace(/\s+/g, ' ').trim() : parts.join('\n').trim();
    } else if (value === '') {
      const items = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        items.push(text(lines[++i].replace(/^\s*-\s+/, '')));
      }
      data[key] = items;
    } else if (value.startsWith('[') && !value.startsWith('[[')) {
      if (!value.endsWith(']')) throw new Error(`${file}: list "${key}" must close on the same line`);
      data[key] = inlineList(value, file, key);
    } else {
      data[key] = scalar(value);
    }
  }
  return data;
}
