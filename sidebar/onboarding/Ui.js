import { el } from '../../ui/Dom.js';

/** Helper kecil khusus onboarding: kartu, log, frame demo, dan status langkah. */
export const lead = (text) => el('p', { text });
export const note = (text) => el('p', { class: 'hx-help', text });

export function field(label, control, hint = null) {
  return el('label', { class: 'hx-field' },
    el('span', { class: 'hx-label', text: label }),
    control,
    hint ? el('span', { class: 'hx-help', text: hint }) : null
  );
}

export function segmented(options, value, onChange) {
  const wrap = el('div', { class: 'hx-seg' });
  options.forEach(([id, label]) => {
    const button = el('button', {
      type: 'button',
      class: `hx-seg-btn${id === value ? ' is-on' : ''}`,
      text: label
    });
    button.addEventListener('click', () => {
      wrap.querySelectorAll('.hx-seg-btn').forEach((node) => node.classList.remove('is-on'));
      button.classList.add('is-on');
      onChange(id);
    });
    wrap.append(button);
  });
  return wrap;
}

export function logBox({ height = 96 } = {}) {
  const box = el('div', { class: 'hx-onboard-log' });
  box.style.maxHeight = `${height}px`;
  return box;
}

export function pushLog(box, message) {
  box.append(el('div', { class: 'hx-onboard-log-line', text: message }));
  box.scrollTop = box.scrollHeight;
}

export function checkLine(ok, text) {
  return el('div', { class: `hx-onboard-check${ok ? ' is-done' : ''}` },
    el('span', { class: 'hx-onboard-mark', text: ok ? '✓' : '•' }),
    el('span', { text })
  );
}

export function resultLine(text, tone = '') {
  return el('p', { class: `hx-help${tone ? ` is-${tone}` : ''}`, text });
}

/** Iframe demo lokal (same-origin) + promise siap dipakai scraper/RPA. */
export function demoFrame() {
  const iframe = el('iframe', {
    src: '../demo/index.html',
    title: 'Halaman demo lokal Creator Harness',
    loading: 'eager'
  });
  const wrap = el('div', { class: 'hx-onboard-demo' }, iframe);
  let timer = 0;
  const ready = new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Halaman demo lambat dimuat. Coba lagi.')), 8000);
    iframe.addEventListener('load', () => {
      clearTimeout(timer);
      const doc = iframe.contentDocument;
      if (doc?.querySelector('#demo-search')) resolve(doc);
      else reject(new Error('Halaman demo tidak lengkap.'));
    }, { once: true });
  });
  ready.catch(() => {});
  return { wrap, iframe, ready, cancel: () => clearTimeout(timer) };
}
