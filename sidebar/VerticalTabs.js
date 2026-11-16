import { el, mountIcon } from '../ui/Dom.js';

/** Daftar panel rail vertikal. Modul dimuat malas saat tab pertama dibuka. */
export const TABS = [
  { id: 'studio', label: 'Studio', title: 'Studio', icon: 'studio', group: 'kerja', module: './panels/StudioPanel.js', className: 'StudioPanel' },
  { id: 'ideas', label: 'Ide', title: 'Bank Ide', icon: 'idea', group: 'kerja', module: './panels/IdeasPanel.js', className: 'IdeasPanel' },
  { id: 'script', label: 'Naskah', title: 'Naskah', icon: 'script', group: 'kerja', module: './panels/ScriptPanel.js', className: 'ScriptPanel' },
  { id: 'calendar', label: 'Kalender', title: 'Kalender Konten', icon: 'calendar', group: 'kerja', module: './panels/CalendarPanel.js', className: 'CalendarPanel' },
  { id: 'produce', label: 'Produksi', title: 'Produksi', icon: 'produce', group: 'kerja', module: './panels/ProducePanel.js', className: 'ProducePanel' },
  { id: 'harvest', label: 'Panen', title: 'Panen Aset', icon: 'harvest', group: 'kerja', module: './panels/HarvestPanel.js', className: 'HarvestPanel' },
  { id: 'data', label: 'Data', title: 'Data & Export', icon: 'data', group: 'kerja', module: './panels/DataPanel.js', className: 'DataPanel' },
  { id: 'research', label: 'Riset', title: 'Riset', icon: 'research', group: 'kerja', module: './panels/ResearchPanel.js', className: 'ResearchPanel' },
  { id: 'brand', label: 'Brand', title: 'Profil Brand', icon: 'brand', group: 'kerja', module: './panels/BrandPanel.js', className: 'BrandPanel' },
  { id: 'deals', label: 'Deal', title: 'Deal & Rate Card', icon: 'deals', group: 'kerja', module: './panels/DealsPanel.js', className: 'DealsPanel' },
  { id: 'analytics', label: 'Analitik', title: 'Analitik', icon: 'analytics', group: 'kerja', module: './panels/AnalyticsPanel.js', className: 'AnalyticsPanel' },
  { id: 'rpa', label: 'RPA', title: 'Automasi (RPA)', icon: 'rpa', group: 'sistem', module: './panels/RpaPanel.js', className: 'RpaPanel' },
  { id: 'connections', label: 'Koneksi', title: 'Koneksi', icon: 'plug', group: 'sistem', module: './panels/ConnectionsPanel.js', className: 'ConnectionsPanel' },
  { id: 'settings', label: 'Setelan', title: 'Setelan', icon: 'gear', group: 'sistem', module: './panels/SettingsPanel.js', className: 'SettingsPanel' }
];

export class VerticalTabs {
  constructor(host, onSelect) {
    this.host = host;
    this.onSelect = onSelect;
    this.active = null;
  }

  render(activeId) {
    this.host.replaceChildren();
    let group = null;
    TABS.forEach((tab) => {
      if (group && tab.group !== group) {
        this.host.append(el('div', { class: 'hx-rail-spacer' }));
      }
      group = tab.group;
      const button = el('button', {
        class: 'hx-tab',
        type: 'button',
        dataset: { tab: tab.id },
        title: `${tab.title} (${tab.id})`,
        'aria-label': tab.title,
        onclick: () => this.onSelect(tab.id)
      }, mountIcon(tab.icon, 19), el('span', { class: 'hx-tab-label', text: tab.label }));
      this.host.append(button);
    });
    this.setActive(activeId);
  }

  setActive(id) {
    this.active = id;
    this.host.querySelectorAll('.hx-tab').forEach((node) => {
      const isActive = node.dataset.tab === id;
      node.classList.toggle('is-active', isActive);
      if (isActive) node.setAttribute('aria-current', 'page');
      else node.removeAttribute('aria-current');
    });
  }
}
