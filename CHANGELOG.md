# Changelog

Semua perubahan penting dicatat di sini. Format mengikuti [Keep a Changelog](https://keepachangelog.com/id/1.1.0/) dan versi mengikuti [SemVer](https://semver.org/lang/id/).

## [1.0.0] — 2026-11-16

### Ditambahkan

- Sidebar Creator Harness di kanan halaman: rail 56px, sidebar 25% (280–420px), dan layar penuh, dengan Shadow DOM + iframe origin extension.
- 14 panel: Studio, Ide, Naskah, Kalender, Produksi, Panen, Data, Riset, Brand, Deal, Analitik, RPA, Koneksi, dan Setelan.
- Onboarding 12 langkah bernomor dengan demo halaman lokal, panen gambar nyata, export nyata, uji LLM, uji Platform Bridge, dan demo RPA yang bisa pause/resume/stop.
- Lapisan RPA: `SelectorEngine`, `ActionLibrary`, `RpaEngine`, `ScriptStore`, recorder/player JSON, dan content-script runner (click, type, select, scroll, wait, extract, loop, if, screenshot).
- Panen aset RPA-first: gambar, teks, tabel, metadata, auto-scroll, provenance, dedupe, dan unduh gambar.
- `DataPipeline` → `LibraryStore` (IndexedDB) → panel Data dengan preview, analisis, pencarian, galeri, dan export JSON/CSV/MD/TXT/ZIP.
- LLM multi-provider: OpenAI-compatible, Anthropic, Gemini, dan Ollama; fallback chain, streaming, batas biaya harian, dan mode local-only.
- SecretVault AES-GCM 256 + PBKDF2 600.000 iterasi, import `.env`, dan export pengaturan tanpa secret.
- Platform Bridge opsional: ingest token, HTTPS, `idempotencyKey`, outbox queue, dan auto-pause saat sesi terblokir.
- Lisensi offline Ed25519: trial 14 hari, edition Free/Pro/Bundle/Enterprise, batas Free, dan data user yang tidak dikunci.
- Full Settings dengan pencarian lintas bagian, reset, export/import JSON, dan test connection.
- Context menu: simpan ide dari seleksi, panen halaman, buka sidebar; shortcut `Alt+Shift+S` dan `Alt+Shift+F`.
- Tooling `tools/check.mjs` (batas 300 LoC, sintaks, struktur HTML, referensi manifest) dan `tools/pack.mjs` (ZIP store).

### Keamanan

- Tanpa `eval`, remote code, CDN, telemetry, atau secret hardcoded.
- Sidebar diisolasi dari CSS/DOM halaman; pesan memakai protokol `postMessage`/runtime message yang divalidasi.
- Export default mengecualikan isi SecretVault.
