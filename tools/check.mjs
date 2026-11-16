#!/usr/bin/env node
/** Pemeriksaan standar Harness: batas 300 LoC + syntax ESM + referensi manifest. */
import { readdir, readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const SKIP = new Set(['.git', 'node_modules', 'dist', 'keys']);
const LIMIT = 300;
const EXT = new Set(['.js', '.css', '.html']);
const problems = [];
let files = 0;
let lines = 0;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP.has(entry.name)) await walk(full);
      continue;
    }
    const ext = path.extname(entry.name);
    if (!EXT.has(ext)) continue;
    const text = await readFile(full, 'utf8');
    const count = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
    files += 1;
    lines += count;
    const rel = path.relative(ROOT, full);
    if (count > LIMIT) problems.push(`${rel}: ${count} baris (> ${LIMIT})`);
    if (ext === '.js') {
      try {
        execFileSync(process.execPath, ['--check', full], { stdio: 'pipe' });
      } catch (error) {
        problems.push(`${rel}: syntax error — ${String(error.stderr || error.message).trim().split('\n')[0]}`);
      }
    }
    if (ext === '.html') {
      if (!/<html[\s>]/i.test(text) || !/<\/html>/i.test(text)) problems.push(`${rel}: struktur HTML tidak lengkap`);
    }
  }
}

const manifest = JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
const referenced = [
  manifest.background?.service_worker,
  manifest.sidebar,
  ...(manifest.content_scripts || []).flatMap((item) => item.js || []),
  ...Object.values(manifest.icons || {})
].filter(Boolean);
for (const rel of referenced) {
  try {
    await stat(path.join(ROOT, rel));
  } catch {
    problems.push(`manifest.json: berkas tidak ditemukan — ${rel}`);
  }
}
if (manifest.manifest_version !== 3) problems.push('manifest.json: wajib Manifest V3');

await walk(ROOT);
console.log(`Diperiksa ${files} berkas (${lines} baris). Batas ${LIMIT} LoC/berkas.`);
if (problems.length) {
  console.error(`\n${problems.length} masalah:`);
  problems.forEach((item) => console.error(`- ${item}`));
  process.exitCode = 1;
} else {
  console.log('OK: semua berkas lolos standar.');
}
