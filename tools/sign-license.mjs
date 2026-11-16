#!/usr/bin/env node
/**
 * Penerbit lisensi offline (dijalankan pemilik repo, bukan user extension).
 * Private key TIDAK boleh di-commit.
 *
 * Contoh:
 *   node tools/sign-license.mjs --key /secure/license-private.pem \
 *     --edition bundle --bundle starter-kit --to "Budi" --exp 2027-12-31
 */
import { readFileSync } from 'node:fs';
import { sign } from 'node:crypto';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, item) => {
    if (item.startsWith('--')) acc.push([item.slice(2), true]);
    else if (acc.length) acc.at(-1)[1] = item;
    return acc;
  }, [])
);

const keyPath = args.key || process.env.LICENSE_PRIVATE_KEY_PATH;
if (!keyPath) {
  console.error('Butuh --key /path/private.pem (atau LICENSE_PRIVATE_KEY_PATH).');
  process.exit(1);
}

const payload = {
  edition: args.edition || 'pro',
  bundleId: args.bundle || '',
  seats: Number(args.seats || 1),
  exp: args.exp || '',
  issuedTo: args.to || 'Pelanggan'
};

const privateKey = readFileSync(keyPath);
const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8')
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');
const signature = sign(null, Buffer.from(payloadB64, 'utf8'), privateKey)
  .toString('base64')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');

console.log(`CH1.${payloadB64}.${signature}`);
