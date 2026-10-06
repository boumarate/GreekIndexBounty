// Deterministic quote ids: RFC 4122 version-5 UUIDs.
// The same passage (work + reference + title) always yields the same {{quote:…}} id,
// in the build (Node) and in the browser (site/assets/js/lib/uuid.js).
import { createHash } from 'node:crypto';

// = uuidv5("https://pinakes.app/quote", URL namespace 6ba7b811-9dad-11d1-80b4-00c04fd430c8)
export const QUOTE_NAMESPACE = 'aeb4d9d1-4386-5a50-9c38-ababe177694f';

function parse(uuid) {
  const hex = uuid.replace(/-/g, '');
  return Uint8Array.from(hex.match(/../g).map(h => parseInt(h, 16)));
}

export function uuidv5(name, namespace = QUOTE_NAMESPACE) {
  const hash = createHash('sha1').update(Buffer.from(parse(namespace))).update(name, 'utf8').digest();
  const b = hash.subarray(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Buffer.from(b).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The canonical name hashed for a quote. Keep in sync with the browser implementation. */
export function quoteName({ work, ref, title }) {
  return `${work} ${ref}${title ? ` | ${title}` : ''}`;
}

export const quoteId = q => uuidv5(quoteName(q));

export const isUuid = s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
