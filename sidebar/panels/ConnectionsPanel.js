import { BasePanel } from '../../ui/BasePanel.js';
import { el } from '../../ui/Dom.js';
import { fmtNumber } from '../../core/Format.js';
import { LlmConnections } from './LlmConnections.js';
import { PlatformConnection } from './PlatformConnection.js';
import { VaultSection } from './VaultSection.js';
import { badge } from './PanelKit.js';

export class ConnectionsPanel extends BasePanel {
  constructor(app) {
    super(app);
    this.title = 'Koneksi';
    this.subtitle = 'AI, platform, dan secret';
    this.helpText = 'Semua kredensial melewati SecretVault. Uji koneksi sebelum dipakai agar kegagalan cepat terdeteksi.';
  }

  async build() {
    this.usageNode = el('div');
    this.add(this.usageNode);
    this.renderUsage();

    const aiSection = this.section('Provider AI', [badge('multi-provider', 'is-pro')]);
    aiSection.append(await new LlmConnections(this).render());

    this.add(new VaultSection(this).node);

    const platformSection = this.section('Platform');
    const platformCard = await new PlatformConnection(this).render();
    platformSection.append(platformCard);

    const statuses = this.services.hub.statuses();
    const statusCard = el('div', { class: 'hx-card is-flat' },
      statuses.map((status) => el('div', { class: 'hx-kv' },
        el('span', { class: 'hx-muted', text: status.label }),
        el('span', { text: `${status.status} · ${status.detail}` })
      ))
    );
    this.add(el('div', { class: 'hx-section' },
      el('div', { class: 'hx-section-head' }, el('h3', { class: 'hx-section-title', text: 'Status konektor' })),
      statusCard
    ));

    this.track(this.services.license.onChange(() => this.renderUsage()));
  }

  async renderUsage() {
    const usage = await this.services.llm.usageToday();
    const cap = this.settings.get('llm.dailyCostCapUsd', 1);
    this.usageNode.replaceChildren(el('div', { class: 'hx-card is-flat' },
      el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Panggilan hari ini' }), el('span', { text: fmtNumber(usage.calls) })),
      el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Token masuk / keluar' }), el('span', { text: `${fmtNumber(usage.inTokens)} / ${fmtNumber(usage.outTokens)}` })),
      el('div', { class: 'hx-kv' }, el('span', { class: 'hx-muted', text: 'Biaya estimasi' }), el('span', { text: `$${(usage.costUsd || 0).toFixed(4)} dari $${cap}` }))
    ));
  }
}
