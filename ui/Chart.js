import { el } from './Dom.js';

/** Grafik batang SVG sederhana tanpa dependency, aman untuk dark/light. */
export function barChart(items, { height = 120, labelKey = 'label', valueKey = 'value', format = String } = {}) {
  const list = Array.isArray(items) ? items : [];
  const max = Math.max(1, ...list.map((item) => Number(item[valueKey]) || 0));
  const width = 320;
  const gap = list.length > 12 ? 2 : 6;
  const barWidth = list.length ? Math.max(3, (width - gap * (list.length - 1)) / list.length) : width;
  const svgNs = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height + 18}`);
  svg.setAttribute('class', 'hx-chart');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Grafik batang');

  const base = height;
  const line = document.createElementNS(svgNs, 'line');
  line.setAttribute('x1', '0');
  line.setAttribute('x2', String(width));
  line.setAttribute('y1', String(base));
  line.setAttribute('y2', String(base));
  line.setAttribute('class', 'hx-chart-axis');
  svg.append(line);

  list.forEach((item, index) => {
    const value = Number(item[valueKey]) || 0;
    const h = Math.max(2, (value / max) * (height - 12));
    const rect = document.createElementNS(svgNs, 'rect');
    rect.setAttribute('x', String(index * (barWidth + gap)));
    rect.setAttribute('y', String(base - h));
    rect.setAttribute('width', String(barWidth));
    rect.setAttribute('height', String(h));
    rect.setAttribute('rx', String(Math.min(3, barWidth / 2)));
    rect.setAttribute('class', 'hx-chart-bar');
    const title = document.createElementNS(svgNs, 'title');
    title.textContent = `${item[labelKey] ?? ''}: ${format(value)}`;
    rect.append(title);
    svg.append(rect);
    if (list.length <= 8) {
      const text = document.createElementNS(svgNs, 'text');
      text.setAttribute('x', String(index * (barWidth + gap) + barWidth / 2));
      text.setAttribute('y', String(base + 13));
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'hx-chart-label');
      text.textContent = item[labelKey] ?? '';
      svg.append(text);
    }
  });
  return svg;
}

export function statCard(label, value, hint = '', tone = '') {
  return el('div', { class: `hx-stat ${tone}` },
    el('div', { class: 'hx-stat-label', text: label }),
    el('div', { class: 'hx-stat-value', text: String(value) }),
    hint ? el('div', { class: 'hx-stat-hint', text: hint }) : null
  );
}

export function progressBar(percent, label = '') {
  const value = Math.max(0, Math.min(100, Number(percent) || 0));
  return el('div', { class: 'hx-progress-wrap' },
    label ? el('div', { class: 'hx-progress-label', text: label }) : null,
    el('div', { class: 'hx-progress', role: 'progressbar', 'aria-valuenow': String(Math.round(value)), 'aria-valuemin': '0', 'aria-valuemax': '100' },
      el('div', { class: 'hx-progress-bar', style: { width: `${value}%` } })
    )
  );
}
