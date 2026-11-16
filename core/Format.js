/** Helper murni tanpa state: id, angka, tanggal, objek. */

export function uid(prefix = 'id') {
  const rnd = crypto.getRandomValues(new Uint8Array(6));
  const hex = Array.from(rnd, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${Date.now().toString(36)}${hex}`;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

export function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

export function deepMerge(base, patch) {
  if (Array.isArray(base)) return Array.isArray(patch) ? patch : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    for (const [key, value] of Object.entries(patch || {})) {
      out[key] = key in base ? deepMerge(base[key], value) : value;
    }
    return out;
  }
  return patch === undefined ? base : patch;
}

export function getPath(object, path, fallback = undefined) {
  const parts = path.split('.');
  let cursor = object;
  for (const part of parts) {
    if (cursor == null) return fallback;
    cursor = cursor[part];
  }
  return cursor === undefined ? fallback : cursor;
}

export function setPath(object, path, value) {
  const parts = path.split('.');
  const root = clone(object) || {};
  let cursor = root;
  parts.slice(0, -1).forEach((part) => {
    if (typeof cursor[part] !== 'object' || cursor[part] === null) cursor[part] = {};
    cursor = cursor[part];
  });
  cursor[parts.at(-1)] = value;
  return root;
}

export function todayKey(date = new Date()) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateKey, days) {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

export function fmtDate(value, style = 'medium') {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(d.getTime())) return String(value);
  const opts = style === 'short'
    ? { day: '2-digit', month: 'short' }
    : { day: '2-digit', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat('id-ID', opts).format(d);
}

export function fmtNumber(value, digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(n);
}

export function fmtCompact(value) {
  const n = Number(value) || 0;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1).replace('.', ',')} M`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1).replace('.', ',')} jt`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(1).replace('.', ',')} rb`;
  return fmtNumber(n);
}

export function fmtMoney(value, currency = 'IDR') {
  const n = Number(value) || 0;
  if (currency === 'IDR') return `Rp ${new Intl.NumberFormat('id-ID').format(Math.round(n))}`;
  return `${currency} ${new Intl.NumberFormat('id-ID').format(n)}`;
}

export function fmtBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = n;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

export function debounce(fn, wait = 200) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function throttle(fn, wait = 200) {
  let last = 0;
  let timer = 0;
  return (...args) => {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        timer = 0;
        last = Date.now();
        fn(...args);
      }, remaining);
    }
  };
}

export function slugify(text, fallback = 'berkas') {
  const slug = String(text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return slug || fallback;
}

/** Ambil objek JSON pertama dari jawaban LLM yang mungkin dibungkus markdown. */
export function parseJsonLoose(text) {
  const raw = String(text || '').trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  const open = candidate[start];
  const close = open === '{' ? '}' : ']';
  const end = candidate.lastIndexOf(close);
  if (end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function bytesOf(value) {
  return new Blob([typeof value === 'string' ? value : JSON.stringify(value)]).size;
}

export function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}
