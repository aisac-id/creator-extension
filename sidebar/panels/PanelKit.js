import { el, mountIcon } from '../../ui/Dom.js';

/** Potongan UI yang dipakai banyak panel agar tampilan konsisten. */
export function field(label, control, hint = '') {
  return el('div', { class: 'hx-field' },
    label ? el('label', { class: 'hx-label', text: label }) : null,
    control,
    hint ? el('span', { class: 'hx-muted hx-small', text: hint }) : null
  );
}

export function input(attrs = {}) {
  return el('input', { class: 'hx-input', type: 'text', ...attrs });
}

export function textarea(attrs = {}) {
  return el('textarea', { class: 'hx-textarea', rows: 4, ...attrs });
}

export function select(options, value, attrs = {}) {
  return el('select', { class: 'hx-select', ...attrs },
    options.map(([key, label]) => el('option', { value: key, selected: key === value, text: label }))
  );
}

export function toolbar(...children) {
  return el('div', { class: 'hx-toolbar' }, children);
}

export function itemRow({ title, subtitle = '', meta = '', actions = [], onClick = null, active = false }) {
  return el('div', {
    class: `hx-item${onClick ? ' is-clickable' : ''}${active ? ' is-active' : ''}`,
    onclick: onClick || undefined
  },
    el('div', { class: 'hx-item-top' },
      el('div', { class: 'hx-item-title', text: title }),
      meta ? el('span', { class: 'hx-muted hx-small', text: meta }) : null
    ),
    subtitle ? el('div', { class: 'hx-item-sub', text: subtitle }) : null,
    actions.length ? el('div', { class: 'hx-item-actions' }, actions) : null
  );
}

export function iconButton(name, title, onclick, extraClass = '') {
  return el('button', {
    class: `hx-icon-btn${extraClass ? ` ${extraClass}` : ''}`,
    type: 'button', title, 'aria-label': title,
    onclick: (event) => {
      event.stopPropagation();
      onclick(event);
    }
  }, mountIcon(name, 15));
}

export function badge(text, cls = '') {
  return el('span', { class: `hx-badge${cls ? ` ${cls}` : ''}`, text });
}

export function chips(values = []) {
  return el('div', { class: 'hx-chips' }, values.filter(Boolean).map((value) => el('span', { class: 'hx-chip', text: value })));
}

export function meter(percent, label = '') {
  return el('div', { class: 'hx-progress-wrap' },
    el('div', { class: 'hx-progress' },
      el('div', { class: 'hx-progress-bar', style: { width: `${Math.min(100, Math.max(0, percent))}%` } })
    ),
    label ? el('span', { class: 'hx-progress-label', text: label }) : null
  );
}

export function stat(value, label, hint = '', accent = false) {
  return el('div', { class: `hx-stat${accent ? ' is-accent' : ''}` },
    el('div', { class: 'hx-stat-value', text: String(value) }),
    el('div', { class: 'hx-stat-label', text: label }),
    hint ? el('div', { class: 'hx-stat-hint', text: hint }) : null
  );
}

export function segmented(options, value, onPick) {
  return el('div', { class: 'hx-seg' }, options.map(([key, label]) => el('button', {
    class: `hx-seg-btn${key === value ? ' is-on' : ''}`,
    type: 'button', text: label, dataset: { key }, onclick: () => onPick(key)
  })));
}

export function searchBox(placeholder, onInput) {
  const inputNode = el('input', {
    class: 'hx-input', type: 'search', placeholder,
    oninput: (event) => onInput(event.target.value)
  });
  return el('div', { class: 'hx-search' }, mountIcon('search', 14), inputNode);
}

export function split(listNode, detailNode) {
  return el('div', { class: 'hx-split' },
    el('div', { class: 'hx-split-list' }, listNode),
    el('div', { class: 'hx-split-detail' }, detailNode)
  );
}

/** Ambil nilai input ber-atribut data-field di dalam root. */
export function formValues(root) {
  const values = {};
  root.querySelectorAll('[data-field]').forEach((node) => {
    values[node.dataset.field] = node.type === 'checkbox' ? node.checked : node.value;
  });
  return values;
}

export function confirmButton(label, handler, kind = 'is-danger') {
  return el('button', { class: `hx-btn is-small ${kind}`, type: 'button', text: label, onclick: handler });
}

export function note(text) {
  return el('p', { class: 'hx-muted hx-small', text });
}
