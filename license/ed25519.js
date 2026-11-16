/**
 * Verifikasi tanda tangan Ed25519 murni JS (BigInt) + SHA-512 dari WebCrypto.
 * Dipakai LicenseService agar aktivasi lisensi tetap offline di semua versi Chrome.
 */

const P = (1n << 255n) - 19n;
const L = (1n << 252n) + 27742317777372353535851937790883648493n;

function mod(a, m = P) {
  const r = a % m;
  return r >= 0n ? r : r + m;
}

function modPow(base, exp, m = P) {
  let result = 1n;
  let b = mod(base, m);
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return result;
}

const D = mod(-121665n * modPow(121666n, P - 2n));
const SQRT_M1 = modPow(2n, (P - 1n) / 4n);

function pointAdd(p1, p2) {
  const a = mod((p1.Y - p1.X) * (p2.Y - p2.X));
  const b = mod((p1.Y + p1.X) * (p2.Y + p2.X));
  const c = mod(2n * D * p1.T * p2.T);
  const dd = mod(2n * p1.Z * p2.Z);
  const e = mod(b - a);
  const f = mod(dd - c);
  const g = mod(dd + c);
  const h = mod(b + a);
  return { X: mod(e * f), Y: mod(g * h), T: mod(e * h), Z: mod(f * g) };
}

function scalarMult(point, scalar) {
  let result = { X: 0n, Y: 1n, Z: 1n, T: 0n };
  let addend = point;
  let k = scalar;
  while (k > 0n) {
    if (k & 1n) result = pointAdd(result, addend);
    addend = pointAdd(addend, addend);
    k >>= 1n;
  }
  return result;
}

function decodePoint(bytes) {
  if (!bytes || bytes.length !== 32) return null;
  const sign = (bytes[31] & 0x80) >> 7;
  const copy = Uint8Array.from(bytes);
  copy[31] &= 0x7f;
  const y = leToBig(copy);
  if (y >= P) return null;
  const y2 = mod(y * y);
  const u = mod(y2 - 1n);
  const v = mod(D * y2 + 1n);
  const x2 = mod(u * modPow(v, P - 2n));
  let x = modPow(x2, (P + 3n) / 8n);
  if (mod(x * x - x2) !== 0n) x = mod(x * SQRT_M1);
  if (mod(x * x - x2) !== 0n) return null;
  if ((x & 1n) !== BigInt(sign)) x = P - x;
  if (x === 0n && sign === 1) return null;
  return { X: x, Y: y, Z: 1n, T: mod(x * y) };
}

function encodePoint(point) {
  const zInv = modPow(point.Z, P - 2n);
  const x = mod(point.X * zInv);
  const y = mod(point.Y * zInv);
  const bytes = bigToLeBytes(y, 32);
  bytes[31] |= Number(x & 1n) << 7;
  return bytes;
}

function leToBig(bytes) {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i -= 1) result = (result << 8n) | BigInt(bytes[i]);
  return result;
}

function bigToLeBytes(value, length) {
  const out = new Uint8Array(length);
  let v = value;
  for (let i = 0; i < length; i += 1) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function concat(...arrays) {
  const total = arrays.reduce((sum, item) => sum + item.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  arrays.forEach((item) => {
    out.set(item, offset);
    offset += item.length;
  });
  return out;
}

async function sha512(bytes) {
  const digest = await crypto.subtle.digest('SHA-512', bytes);
  return new Uint8Array(digest);
}

export function base64UrlToBytes(text) {
  const normalized = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64Url(bytes) {
  let binary = '';
  new Uint8Array(bytes).forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const BASE = decodePoint(Uint8Array.from([
  0x58, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66,
  0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66, 0x66
]));

/** Verifikasi signature 64 byte atas message (Uint8Array) dengan public key 32 byte. */
export async function verifyEd25519(publicKey, message, signature) {
  const pubBytes = typeof publicKey === 'string' ? base64UrlToBytes(publicKey) : new Uint8Array(publicKey);
  const sigBytes = signature instanceof Uint8Array ? signature : new Uint8Array(signature);
  if (pubBytes.length !== 32 || sigBytes.length !== 64) return false;

  const pointA = decodePoint(pubBytes);
  const pointR = decodePoint(sigBytes.subarray(0, 32));
  if (!pointA || !pointR) return false;

  const s = leToBig(sigBytes.subarray(32));
  if (s >= L) return false;

  const hash = await sha512(concat(sigBytes.subarray(0, 32), pubBytes, message));
  const k = leToBig(hash) % L;

  const left = encodePoint(scalarMult(BASE, s));
  const right = encodePoint(pointAdd(pointR, scalarMult(pointA, k)));
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return false;
  }
  return true;
}
