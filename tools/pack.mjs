#!/usr/bin/env node
/** Paket extension menjadi ZIP store tanpa dependency (memakai ZipWriter repo). */
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildZip } from '../pipeline/ZipWriter.js';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DIST = path.join(ROOT, 'dist');
const DIRS = ['assets', 'background', 'config', 'connectors', 'content', 'core', 'demo', 'license', 'llm',
  'onboarding', 'pipeline', 'rpa', 'scrapers', 'services', 'sidebar', 'ui'];
const IGNORE = new Set(['.DS_Store', 'Thumbs.db']);
const entries = [];

async function walk(dir, prefix) {
  const items = await readdir(dir, { withFileTypes: true });
  for (const item of items) {
    if (IGNORE.has(item.name) || item.name.endsWith('.zip') || item.name.endsWith('.map')) continue;
    const full = path.join(dir, item.name);
    const name = `${prefix}/${item.name}`;
    if (item.isDirectory()) await walk(full, name);
    else entries.push({ name, data: new Uint8Array(await readFile(full)) });
  }
}

const manifest = JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
entries.push({ name: 'manifest.json', data: new Uint8Array(await readFile(path.join(ROOT, 'manifest.json'))) });
for (const dir of DIRS) await walk(path.join(ROOT, dir), dir);

await mkdir(DIST, { recursive: true });
const blob = buildZip(entries);
const buffer = Buffer.from(await blob.arrayBuffer());
const out = path.join(DIST, `creator-harness-${manifest.version}.zip`);
await writeFile(out, buffer);
console.log(`Paket: ${path.relative(ROOT, out)} (${entries.length} berkas, ${(buffer.length / 1024).toFixed(1)} KB)`);
