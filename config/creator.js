/** Data domain produk: platform, format, status, dan checklist per platform. */

export const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', short: 'IG', color: '#e1306c' },
  { id: 'tiktok', label: 'TikTok', short: 'TT', color: '#22d3ee' },
  { id: 'youtube', label: 'YouTube', short: 'YT', color: '#ef4444' },
  { id: 'x', label: 'X / Twitter', short: 'X', color: '#94a3b8' },
  { id: 'linkedin', label: 'LinkedIn', short: 'IN', color: '#3b82f6' },
  { id: 'threads', label: 'Threads', short: 'TH', color: '#a78bfa' },
  { id: 'blog', label: 'Blog / Newsletter', short: 'BL', color: '#f59e0b' }
];

export const FORMATS = [
  'Reels / Shorts', 'Video panjang', 'Carousel', 'Single post',
  'Story', 'Thread', 'Artikel', 'Newsletter', 'Live', 'Podcast'
];

export const CONTENT_STATUS = [
  { id: 'ide', label: 'Ide', color: '#64748b' },
  { id: 'naskah', label: 'Naskah', color: '#818cf8' },
  { id: 'produksi', label: 'Produksi', color: '#f59e0b' },
  { id: 'terjadwal', label: 'Terjadwal', color: '#22d3ee' },
  { id: 'terbit', label: 'Terbit', color: '#34d399' }
];

export const DEAL_STATUS = [
  { id: 'prospek', label: 'Prospek', color: '#64748b' },
  { id: 'negosiasi', label: 'Negosiasi', color: '#818cf8' },
  { id: 'deal', label: 'Deal', color: '#22d3ee' },
  { id: 'produksi', label: 'Produksi', color: '#f59e0b' },
  { id: 'terbayar', label: 'Terbayar', color: '#34d399' },
  { id: 'batal', label: 'Batal', color: '#f87171' }
];

export const HOOK_TYPES = [
  'Pertanyaan', 'Kontradiksi', 'Angka', 'Cerita pribadi', 'Kesalahan umum',
  'Before/After', 'Rahasia', 'Tren', 'Tutorial cepat', 'Perbandingan'
];

export const CHECKLISTS = {
  instagram: [
    ['hook', 'Hook 3 detik pertama kuat'],
    ['caption', 'Caption + CTA jelas'],
    ['hashtag', '3–8 hashtag relevan'],
    ['cover', 'Cover 4:5 aman dari crop'],
    ['subtitle', 'Subtitle/caption aktif'],
    ['audio', 'Audio bebas copyright'],
    ['first-comment', 'Komentar pertama (link/CTA)'],
    ['alt', 'Alt text untuk aksesibilitas']
  ],
  tiktok: [
    ['hook', 'Hook < 2 detik, langsung ke inti'],
    ['retention', 'Pola potong tiap 2–4 detik'],
    ['text', 'Teks di layar terbaca di HP'],
    ['sound', 'Sound sedang tren / bebas klaim'],
    ['caption', 'Caption singkat + 3–5 hashtag'],
    ['cover', 'Cover vertikal 9:16'],
    ['cta', 'CTA halus (follow/simpan)'],
    ['caption-auto', 'Auto-caption platform aktif']
  ],
  youtube: [
    ['title', 'Judul < 60 karakter, ada kata kunci'],
    ['thumbnail', 'Thumbnail terbaca di ukuran kecil'],
    ['hook', '30 detik pertama menjawab janji judul'],
    ['chapters', 'Chapter/timestamp'],
    ['end-screen', 'End screen + kartu'],
    ['desc', 'Deskripsi 2 baris pertama + link'],
    ['tags', 'Tag & hashtag relevan'],
    ['shorts', 'Potongan Shorts disiapkan']
  ],
  x: [
    ['hook', 'Baris pertama berdiri sendiri'],
    ['length', 'Muat dalam batas karakter'],
    ['thread', 'Thread tersusun (jika perlu)'],
    ['media', 'Media 1–4 gambar/video'],
    ['reply', 'Balasan untuk tautan'],
    ['tags', 'Maks 2 hashtag'],
    ['pin', 'Siap dipin jika performa bagus']
  ],
  linkedin: [
    ['hook', '2 baris pertama memancing "lihat selengkapnya"'],
    ['format', 'Paragraf pendek, spasi baris'],
    ['insight', 'Ada pelajaran/angka konkret'],
    ['cta', 'CTA diskusi (bukan jualan keras)'],
    ['tags', '3–5 hashtag profesional'],
    ['media', 'Dokumen/carousel jika relevan'],
    ['comment', 'Rencana balas komentar 1 jam pertama']
  ],
  threads: [
    ['hook', 'Kalimat pembuka conversational'],
    ['length', 'Cukup 1 ide per post'],
    ['reply', 'Siapkan balasan lanjutan'],
    ['media', 'Media ringan'],
    ['tags', 'Tanpa hashtag berlebihan']
  ],
  blog: [
    ['title', 'Judul + meta description'],
    ['structure', 'Heading H2/H3 jelas'],
    ['keyword', 'Kata kunci utama di 100 kata pertama'],
    ['links', 'Internal link 2–3'],
    ['media', 'Gambar + alt text'],
    ['cta', 'CTA di tengah dan akhir'],
    ['schema', 'Struktur SEO dasar'],
    ['share', 'Siapkan versi sosial']
  ]
};

export const TONES = [
  'Santai & akrab', 'Edukatif', 'Tegas & langsung', 'Hangat & personal',
  'Profesional', 'Humoris', 'Inspiratif', 'Premium & minimalis'
];

export const CONTENT_PILLARS = [
  'Edukasi', 'Hiburan', 'Inspirasi', 'Produk', 'Behind the scene', 'Komunitas', 'Opini'
];

export function platformLabel(id) {
  return PLATFORMS.find((item) => item.id === id)?.label || id || '—';
}

export function statusMeta(id) {
  return CONTENT_STATUS.find((item) => item.id === id) || { label: id, color: '#94a3b8' };
}

export function dealMeta(id) {
  return DEAL_STATUS.find((item) => item.id === id) || { label: id, color: '#94a3b8' };
}
