import { el } from '../../ui/Dom.js';
import { input, select, note } from './PanelKit.js';

function control(field, settings, onSaved) {
  const value = settings.get(field.path);
  if (field.type === 'toggle') {
    const box = el('input', {
      type: 'checkbox', checked: Boolean(value),
      onchange: async () => {
        await settings.set(field.path, box.checked);
        onSaved?.();
      }
    });
    return el('label', { class: 'hx-switch' }, box, el('span', { class: 'hx-track' }));
  }
  if (field.type === 'select') {
    const node = select(field.options || [], value, {
      onchange: async () => {
        await settings.set(field.path, node.value);
        onSaved?.();
      }
    });
    return node;
  }
  if (field.type === 'color') {
    const node = el('input', {
      type: 'color', value: value || '#22d3ee',
      class: 'hx-input', style: { height: '34px', padding: '3px' },
      onchange: async () => {
        await settings.set(field.path, node.value);
        onSaved?.();
      }
    });
    return node;
  }
  if (field.type === 'number') {
    const node = input({
      type: 'number', min: field.min, max: field.max, step: field.step || 1, value: value ?? 0,
      onchange: async () => {
        await settings.set(field.path, Number(node.value));
        onSaved?.();
      }
    });
    return node;
  }
  const node = input({
    value: value ?? '', placeholder: field.placeholder || '',
    onchange: async () => {
      await settings.set(field.path, node.value);
      onSaved?.();
    }
  });
  return node;
}

/** Render field Setelan dari schema, lengkap dengan pencarian lintas bagian. */
export class SettingsFields {
  constructor(panel) {
    this.panel = panel;
    this.services = panel.services;
  }

  render(container, section, query) {
    const fields = this.services.settings.describe(query ? null : section, query);
    container.replaceChildren();
    if (!fields.length) {
      container.append(note('Tidak ada pengaturan yang cocok.'));
      return 0;
    }
    fields.forEach((field) => {
      const node = el('div', { class: 'hx-field' });
      if (field.type === 'toggle') {
        node.append(el('div', { class: 'hx-row', style: { justifyContent: 'space-between', alignItems: 'center' } },
          el('div', { class: 'hx-toggle-text' },
            el('span', { class: 'hx-label', text: field.label }),
            field.help ? el('span', { class: 'hx-muted hx-small', text: field.help }) : null
          ),
          control(field, this.services.settings, () => this.panel.app.applyAppearance())
        ));
      } else {
        node.append(
          el('label', { class: 'hx-label', text: field.label }),
          control(field, this.services.settings, () => this.panel.app.applyAppearance())
        );
        if (field.help) node.append(el('span', { class: 'hx-muted hx-small', text: field.help }));
        if (field.unit) node.append(el('span', { class: 'hx-muted hx-small', text: `Satuan: ${field.unit}` }));
      }
      container.append(node);
    });
    return fields.length;
  }
}
