import { Workspace } from '../services/Workspace.js';
import { Toast, Modal } from '../ui/Modal.js';
import { el, mountIcon } from '../ui/Dom.js';
import { BRANDING } from '../config/branding.js';
import { TABS, VerticalTabs } from './VerticalTabs.js';
import { openLicenseModal } from './LicenseModal.js';
import { showHelp } from './HelpView.js';
import { MODE_KEY, TAB_KEY, MODES, MODE_ICON, MODE_LABEL, accentSoft } from './ShellConfig.js';

/** Shell sidebar: navigasi rail, mode tampilan, lisensi, dan pesan antar-konteks. */
export class SidebarApp {
  constructor() {
    this.services = new Workspace();
    this.appRoot = document.getElementById('app');
    this.content = document.getElementById('content');
    this.overlayRoot = document.getElementById('modalHost');
    this.onboardingHost = document.getElementById('onboardingHost');
    this.state = { tab: null, mode: 'sidebar', panel: null, standalone: window.top === window };
    this.toast = new Toast(document.getElementById('toastHost'));
  }

  async boot() {
    try {
      await this.services.init();
      this.state.mode = await this.services.storage.get(MODE_KEY, this.services.settings.get('general.defaultMode', 'sidebar'));
      this.state.tab = new URLSearchParams(location.search).get('tab') || (await this.services.storage.get(TAB_KEY, 'studio'));
      this.renderHeader();
      this.applyAppearance();
      this.applyMode(this.state.mode, false);
      if (this.state.standalone) this.appRoot.classList.add('is-standalone');
      this.tabs = new VerticalTabs(document.getElementById('rail'), (id) => this.selectTab(id));
      this.tabs.render(this.state.tab);
      this.bindHeader();
      this.bindSettings();
      this.bindMessages();
      this.bindKeys();
      await this.selectTab(this.state.tab, { force: true });
      this.post('ready');
      await this.services.license.init();
      this.refreshLicense();
      await this.maybeOnboard();
      await this.consumePendingIntent();
    } catch (error) {
      this.content.replaceChildren(el('div', { class: 'hx-panel' },
        el('div', { class: 'hx-panel-body' },
          this.emptyState('Gagal memuat', error.message || 'Terjadi kesalahan tak terduga.')
        )
      ));
    }
  }

  emptyState(title, hint = '') {
    return el('div', { class: 'hx-empty' },
      el('div', { class: 'hx-empty-title', text: title }),
      hint ? el('p', { class: 'hx-muted', text: hint }) : null
    );
  }

  renderHeader() {
    const brand = BRANDING.whitelabel.enabled && BRANDING.whitelabel.company
      ? BRANDING.whitelabel.company
      : BRANDING.product;
    document.getElementById('productName').textContent = BRANDING.whitelabel.logoText || brand;
    document.getElementById('logo').textContent = (BRANDING.whitelabel.logoText || 'CH').slice(0, 2).toUpperCase();
    document.getElementById('btnHelp').append(mountIcon('help', 17));
    document.getElementById('btnClose').append(mountIcon('close', 17));
    document.title = brand;
    this.updateModeButton();
    this.refreshLicense();
  }

  refreshLicense() {
    const badge = document.getElementById('licenseBadge');
    const label = this.services.license.label();
    badge.textContent = label.code;
    badge.className = `hx-badge${label.tone === 'pro' ? ' is-pro' : label.tone === 'warn' ? ' is-warn' : ''}`;
    badge.title = `${label.text} — klik untuk aktivasi lisensi`;
  }

  openLicense() {
    return openLicenseModal(this);
  }

  bindHeader() {
    document.getElementById('licenseBadge').addEventListener('click', () => openLicenseModal(this));
    document.getElementById('btnHelp').addEventListener('click', () => this.showHelp());
    document.getElementById('btnMode').addEventListener('click', () => this.cycleMode());
    document.getElementById('btnClose').addEventListener('click', () => this.close());
  }

  bindSettings() {
    this.services.settings.onChange(() => this.applyAppearance());
    this.services.license.onChange(() => this.refreshLicense());
  }

  applyAppearance() {
    const theme = this.services.settings.get('ui.theme', 'system');
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    const accent = this.services.settings.get('ui.accent', BRANDING.accent);
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-soft', accentSoft(accent));
    root.style.setProperty('--font-scale', String(this.services.settings.get('ui.fontScale', 1)));
    this.appRoot.classList.toggle('is-compact', Boolean(this.services.settings.get('ui.compact', false)));
    this.appRoot.classList.toggle('no-labels', !this.services.settings.get('ui.showRailLabels', true));
  }

  updateModeButton() {
    const button = document.getElementById('btnMode');
    button.replaceChildren(mountIcon(MODE_ICON[this.state.mode] || 'rail', 17));
    button.title = `Mode ${MODE_LABEL[this.state.mode] || ''} — klik untuk berganti`;
  }

  async applyMode(mode, announce = true) {
    const next = MODES.includes(mode) ? mode : 'sidebar';
    this.state.mode = next;
    this.appRoot.dataset.mode = next;
    this.updateModeButton();
    if (announce) {
      await this.services.storage.set(MODE_KEY, next);
      this.post('mode', { mode: next });
    }
  }

  async cycleMode() {
    const index = MODES.indexOf(this.state.mode);
    await this.applyMode(MODES[(index + 1) % MODES.length]);
    this.toast.info(`Mode ${MODE_LABEL[this.state.mode]}.`);
  }

  post(type, data = {}) {
    if (window.parent === window) return;
    window.parent.postMessage({ source: 'hx-sidebar', type, ...data }, '*');
  }

  async selectTab(id, { force = false } = {}) {
    const tab = TABS.find((entry) => entry.id === id) || TABS[0];
    if (!force && this.state.tab === tab.id && this.state.panel) return;
    this.state.tab = tab.id;
    this.tabs?.setActive(tab.id);
    await this.services.storage.set(TAB_KEY, tab.id);
    this.state.panel?.destroy?.();
    this.state.panel = null;
    this.content.replaceChildren(el('div', { class: 'hx-panel' },
      el('div', { class: 'hx-panel-body' },
        el('div', { class: 'hx-empty' },
          el('div', { class: 'hx-empty-title', text: 'Memuat panel…' }),
          el('p', { class: 'hx-muted', text: tab.title })
        )
      )
    ));
    try {
      const module = await import(tab.module);
      const PanelClass = module[tab.className];
      if (typeof PanelClass !== 'function') throw new Error(`Panel ${tab.className} tidak ditemukan.`);
      const panel = new PanelClass(this);
      await panel.mount(this.content);
      if (this.state.tab === tab.id) this.state.panel = panel;
      else panel.destroy();
      this.post('tab', { tab: tab.id });
    } catch (error) {
      this.content.replaceChildren(el('div', { class: 'hx-panel' },
        el('div', { class: 'hx-panel-body' },
          this.emptyState('Panel gagal dimuat', error.message)
        )
      ));
      this.toast.error(`Panel ${tab.title} gagal dimuat.`);
    }
  }

  go(id) {
    return this.selectTab(id);
  }

  showHelp(title = null, body = null) {
    return showHelp(this, title, body);
  }

  confirm(options) {
    return Modal.confirm(this, options);
  }

  openTab(url) {
    chrome.tabs.create({ url });
  }

  requirePro(feature, label = 'Fitur ini') {
    if (this.services.license.can(feature)) return true;
    this.toast.warn(`${label} tersedia di Pro / Trial.`);
    openLicenseModal(this);
    return false;
  }

  bindMessages() {
    window.addEventListener('message', (event) => {
      const data = event.data;
      if (!data || data.source !== 'hx-page') return;
      if (data.type === 'mode') this.applyMode(data.mode, false);
      else if (data.type === 'open') this.selectTab(data.tab);
      else if (data.type === 'intent') this.handleIntent(data.intent);
    });
    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener((message) => {
        if (message?.type === 'hx:open-tab') this.selectTab(message.payload?.tab || 'studio');
        if (message?.type === 'hx:intent') this.handleIntent(message.payload);
      });
    }
  }

  bindKeys() {
    window.addEventListener('keydown', (event) => {
      const openModal = document.querySelector('.hx-modal-overlay.is-open');
      if (event.key === 'Escape' && !openModal) {
        if (this.state.mode === 'full') {
          this.applyMode('sidebar');
          return;
        }
        this.close();
        return;
      }
      if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        this.applyMode(this.state.mode === 'full' ? 'sidebar' : 'full');
      }
    });
  }

  async consumePendingIntent() {
    const intent = await this.services.storage.get('hx.pendingIntent', null);
    if (!intent) return;
    await this.services.storage.remove('hx.pendingIntent');
    await this.handleIntent(intent);
  }

  async handleIntent(intent = {}) {
    const action = intent.action || 'open';
    if (action === 'save-idea') {
      await this.services.saveItem('ideas', {
        title: intent.title || 'Ide dari halaman',
        notes: intent.text || '',
        url: intent.url || '',
        platform: 'instagram',
        status: 'ide',
        source: 'context-menu'
      });
      this.toast.success('Disimpan ke Bank Ide.');
      await this.selectTab('ideas');
      return;
    }
    if (action === 'harvest') return this.selectTab('harvest');
    if (action === 'settings') return this.selectTab('settings');
    return this.selectTab(intent.tab || 'studio');
  }

  async maybeOnboard() {
    const done = await this.services.storage.get('hx.onboarded', false);
    if (!done) await this.startOnboarding(false);
  }

  async startOnboarding(force) {
    const { OnboardingFlow } = await import('./onboarding/OnboardingFlow.js');
    const flow = new OnboardingFlow(this, { force });
    await flow.start();
  }

  async close() {
    if (this.state.standalone) {
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id) chrome.tabs.remove(tab.id);
      else window.close();
      return;
    }
    this.post('close');
  }
}

const app = new SidebarApp();
app.boot();
