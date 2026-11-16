/**
 * Satu sumber kebenaran untuk semua perilaku yang bisa diatur user.
 * DILARANG menaruh angka/delay/limit sebagai magic number di panel lain.
 */
export const SETTINGS_VERSION = 1;

export const SECTIONS = [
  { id: 'umum', label: 'Umum', icon: 'gear' },
  { id: 'tampilan', label: 'Tampilan', icon: 'palette' },
  { id: 'llm', label: 'AI & LLM', icon: 'spark' },
  { id: 'rpa', label: 'Otomasi', icon: 'zap' },
  { id: 'scraper', label: 'Panen & Data', icon: 'download' },
  { id: 'platform', label: 'Platform', icon: 'plug' },
  { id: 'storage', label: 'Penyimpanan', icon: 'database' },
  { id: 'advanced', label: 'Lanjutan', icon: 'wrench' }
];

export const DEFAULT_SETTINGS = {
  version: SETTINGS_VERSION,
  general: {
    language: 'id',
    defaultMode: 'sidebar',
    autoOpen: false,
    autoSave: true,
    wpm: 150,
    currency: 'IDR',
    confirmDelete: true
  },
  ui: {
    theme: 'system',
    accent: '#22d3ee',
    showRailLabels: true,
    compact: false,
    fontScale: 1,
    sidebarWidth: 25
  },
  llm: {
    enabled: true,
    defaultProvider: 'openai',
    temperature: 0.7,
    maxTokens: 1200,
    streaming: true,
    dailyCostCapUsd: 1,
    localOnly: false,
    fallbackChain: 'openai,anthropic,gemini,ollama',
    providers: {
      openai: {
        label: 'OpenAI-compatible',
        baseURL: 'https://api.openai.com/v1',
        model: 'gpt-4o-mini',
        enabled: true,
        priceIn: 0.15,
        priceOut: 0.6
      },
      anthropic: {
        label: 'Anthropic',
        baseURL: 'https://api.anthropic.com',
        model: 'claude-3-5-sonnet-latest',
        enabled: false,
        priceIn: 3,
        priceOut: 15
      },
      gemini: {
        label: 'Google Gemini',
        baseURL: 'https://generativelanguage.googleapis.com',
        model: 'gemini-1.5-flash',
        enabled: false,
        priceIn: 0.075,
        priceOut: 0.3
      },
      ollama: {
        label: 'Ollama (lokal)',
        baseURL: 'http://127.0.0.1:11434',
        model: 'llama3.1',
        enabled: false,
        priceIn: 0,
        priceOut: 0
      }
    }
  },
  rpa: {
    delayMin: 300,
    delayMax: 800,
    retry: 3,
    timeoutMs: 10000,
    maxActionsPerHour: 120,
    jitter: true
  },
  scraper: {
    minImageWidth: 200,
    minImageHeight: 200,
    maxImages: 80,
    includeBackground: true,
    textMaxChars: 20000,
    pacingMs: 600,
    downloadParallel: 3,
    autoScroll: true,
    scrollSteps: 6
  },
  platform: {
    enabled: false,
    url: '',
    pollSeconds: 60,
    autoSend: false
  },
  storage: {
    quotaMB: 500,
    warnAtPercent: 80,
    thumbSize: 320
  },
  advanced: {
    logLevel: 'warn',
    developerMode: false
  },
  deals: {
    cpm: 75000,
    invoicePrefix: 'INV',
    taxPercent: 0
  }
};

const num = (section, path, label, min, max, step = 1, unit = '') => ({
  section, path, label, type: 'number', min, max, step, unit
});
const toggle = (section, path, label, help = '') => ({ section, path, label, type: 'toggle', help });
const text = (section, path, label, help = '', placeholder = '') => ({
  section, path, label, type: 'text', help, placeholder
});

export const FIELDS = [
  { section: 'umum', path: 'general.language', label: 'Bahasa antarmuka', type: 'select', options: [['id', 'Bahasa Indonesia']] },
  {
    section: 'umum', path: 'general.defaultMode', label: 'Mode tampilan awal', type: 'select',
    options: [['sidebar', 'Sidebar 1/4'], ['rail', 'Rail ikon'], ['full', 'Fullscreen']]
  },
  toggle('umum', 'general.autoOpen', 'Buka otomatis di setiap halaman', 'Default mati agar browser tetap ringan.'),
  toggle('umum', 'general.autoSave', 'Simpan otomatis saat mengetik'),
  num('umum', 'general.wpm', 'Kecepatan bicara (kata/menit)', 80, 260, 5, 'kpm'),
  text('umum', 'general.currency', 'Mata uang default', 'Contoh: IDR, USD.', 'IDR'),
  toggle('umum', 'general.confirmDelete', 'Konfirmasi sebelum menghapus'),

  {
    section: 'tampilan', path: 'ui.theme', label: 'Tema', type: 'select',
    options: [['system', 'Ikut sistem'], ['dark', 'Gelap'], ['light', 'Terang']]
  },
  { section: 'tampilan', path: 'ui.accent', label: 'Warna aksen', type: 'color' },
  toggle('tampilan', 'ui.showRailLabels', 'Tampilkan label tab'),
  toggle('tampilan', 'ui.compact', 'Mode rapat'),
  num('tampilan', 'ui.fontScale', 'Skala huruf', 0.85, 1.3, 0.05, 'x'),
  num('tampilan', 'ui.sidebarWidth', 'Lebar sidebar', 20, 40, 1, '% layar'),

  toggle('llm', 'llm.enabled', 'Aktifkan fitur AI'),
  {
    section: 'llm', path: 'llm.defaultProvider', label: 'Provider default', type: 'select',
    options: [['openai', 'OpenAI-compatible'], ['anthropic', 'Anthropic'], ['gemini', 'Gemini'], ['ollama', 'Ollama lokal']]
  },
  num('llm', 'llm.temperature', 'Kreativitas (temperature)', 0, 1.5, 0.05),
  num('llm', 'llm.maxTokens', 'Batas token jawaban', 200, 4000, 100, 'token'),
  toggle('llm', 'llm.streaming', 'Tampilkan jawaban bertahap (streaming)'),
  num('llm', 'llm.dailyCostCapUsd', 'Batas biaya harian', 0, 20, 0.1, 'USD'),
  toggle('llm', 'llm.localOnly', 'Hanya provider lokal', 'Data sensitif tidak pernah keluar dari perangkat.'),
  text('llm', 'llm.fallbackChain', 'Urutan fallback provider', 'Dipisah koma, dicoba berurutan bila provider gagal.', 'openai,anthropic,gemini,ollama'),
  text('llm', 'llm.providers.openai.baseURL', 'OpenAI-compatible: Base URL', 'Bisa untuk OpenAI, Groq, DeepSeek, OpenRouter, xAI, LM Studio.'),
  text('llm', 'llm.providers.openai.model', 'OpenAI-compatible: Model'),
  text('llm', 'llm.providers.anthropic.baseURL', 'Anthropic: Base URL'),
  text('llm', 'llm.providers.anthropic.model', 'Anthropic: Model'),
  text('llm', 'llm.providers.gemini.baseURL', 'Gemini: Base URL'),
  text('llm', 'llm.providers.gemini.model', 'Gemini: Model'),
  text('llm', 'llm.providers.ollama.baseURL', 'Ollama: Base URL', 'Default http://127.0.0.1:11434'),
  text('llm', 'llm.providers.ollama.model', 'Ollama: Model'),

  num('rpa', 'rpa.delayMin', 'Jeda minimum antar aksi', 0, 5000, 50, 'ms'),
  num('rpa', 'rpa.delayMax', 'Jeda maksimum antar aksi', 0, 8000, 50, 'ms'),
  num('rpa', 'rpa.retry', 'Percobaan ulang per langkah', 1, 10),
  num('rpa', 'rpa.timeoutMs', 'Timeout per langkah', 1000, 60000, 500, 'ms'),
  num('rpa', 'rpa.maxActionsPerHour', 'Batas aksi per jam', 10, 1000, 10),
  toggle('rpa', 'rpa.jitter', 'Jeda acak (jitter) agar lebih manusiawi'),

  num('scraper', 'scraper.minImageWidth', 'Lebar minimum gambar', 16, 4000, 16, 'px'),
  num('scraper', 'scraper.minImageHeight', 'Tinggi minimum gambar', 16, 4000, 16, 'px'),
  num('scraper', 'scraper.maxImages', 'Maksimum gambar per panen', 1, 500),
  toggle('scraper', 'scraper.includeBackground', 'Ikut panen gambar background CSS'),
  num('scraper', 'scraper.textMaxChars', 'Batas teks yang dipanen', 1000, 200000, 1000, 'karakter'),
  num('scraper', 'scraper.pacingMs', 'Jeda antar unduhan', 0, 5000, 100, 'ms'),
  num('scraper', 'scraper.downloadParallel', 'Unduhan paralel', 1, 8),
  toggle('scraper', 'scraper.autoScroll', 'Scroll otomatis untuk gambar lazy-load'),
  num('scraper', 'scraper.scrollSteps', 'Jumlah langkah auto-scroll', 0, 30, 1, 'langkah'),

  toggle('platform', 'platform.enabled', 'Aktifkan Platform Bridge'),
  text('platform', 'platform.url', 'Platform URL', 'HTTPS wajib (http://127.0.0.1 hanya untuk development).', 'https://platform.example.com'),
  num('platform', 'platform.pollSeconds', 'Interval ambil job', 30, 3600, 10, 'detik'),
  toggle('platform', 'platform.autoSend', 'Kirim hasil panen otomatis ke platform'),

  num('storage', 'storage.quotaMB', 'Kuota penyimpanan lokal', 50, 5000, 50, 'MB'),
  num('storage', 'storage.warnAtPercent', 'Peringatan saat pemakaian', 50, 95, 5, '%'),
  num('storage', 'storage.thumbSize', 'Ukuran thumbnail', 120, 800, 20, 'px'),

  {
    section: 'advanced', path: 'advanced.logLevel', label: 'Level log', type: 'select',
    options: [['debug', 'Debug'], ['info', 'Info'], ['warn', 'Warn'], ['error', 'Error']]
  },
  toggle('advanced', 'advanced.developerMode', 'Mode developer', 'Menampilkan diagnostik tambahan.'),

  num('deals', 'deals.cpm', 'Asumsi CPM untuk rate card', 0, 1000000, 5000, 'Rp'),
  text('deals', 'deals.invoicePrefix', 'Awalan nomor invoice', '', 'INV'),
  num('deals', 'deals.taxPercent', 'Pajak invoice', 0, 30, 1, '%')
];

export function fieldsFor(section) {
  return FIELDS.filter((field) => field.section === section);
}
