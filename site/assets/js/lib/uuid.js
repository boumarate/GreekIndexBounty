// Browser twin of scripts/lib/uuid.mjs: deterministic version-5 quote ids.
export const QUOTE_NAMESPACE = 'aeb4d9d1-4386-5a50-9c38-ababe177694f';

const bytes = uuid => Uint8Array.from(uuid.replace(/-/g, '').match(/../g).map(h => parseInt(h, 16)));

export async function uuidv5(name, namespace = QUOTE_NAMESPACE) {
  const ns = bytes(namespace);
  const nm = new TextEncoder().encode(name);
  const buf = new Uint8Array(ns.length + nm.length);
  buf.set(ns); buf.set(nm, ns.length);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', buf)).slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = [...hash].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const quoteName = ({ work, ref, title }) => `${work} ${ref}${title ? ` | ${title}` : ''}`;
export const quoteId = q => uuidv5(quoteName(q));
