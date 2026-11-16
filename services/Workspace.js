import { StorageService } from '../core/StorageService.js';
import { Settings } from '../core/Settings.js';
import { SecretVault } from '../core/SecretVault.js';
import { CollectionStore } from '../core/CollectionStore.js';
import { LicenseService } from '../license/LicenseService.js';
import { LlmHub } from '../llm/LlmHub.js';
import { PromptLibrary } from '../llm/PromptLibrary.js';
import { PlatformBridge } from '../connectors/PlatformBridge.js';
import { ConnectionHub } from '../connectors/ConnectionHub.js';
import { LibraryStore } from '../pipeline/LibraryStore.js';
import { FileDownloader } from '../scrapers/FileDownloader.js';
import { DataPipeline } from '../pipeline/DataPipeline.js';
import { AnalysisService } from '../pipeline/AnalysisService.js';
import { ExportService } from '../pipeline/ExportService.js';
import { ScriptStore } from '../rpa/ScriptStore.js';
import { BrandStore } from './BrandStore.js';
import { parseJsonLoose, todayKey, uid } from '../core/Format.js';
import { Logger } from '../core/Logger.js';

/**
 * Workspace: satu pintu ke semua service. Panel tidak membuat service sendiri,
 * jadi urutan init, lisensi, dan penyimpanan tetap konsisten.
 */
export class Workspace {
  constructor() {
    this.storage = new StorageService('local');
    this.settings = new Settings(this.storage);
    this.vault = new SecretVault(this.storage);
    this.license = new LicenseService(this.storage);
    this.brand = new BrandStore(this.storage);

    this.collections = {
      ideas: new CollectionStore(this.storage, 'hx.ideas', 'idea'),
      scripts: new CollectionStore(this.storage, 'hx.scripts', 'scr'),
      calendar: new CollectionStore(this.storage, 'hx.calendar', 'cal'),
      deals: new CollectionStore(this.storage, 'hx.deals', 'deal'),
      metrics: new CollectionStore(this.storage, 'hx.metrics', 'met'),
      produce: new CollectionStore(this.storage, 'hx.produce', 'prod'),
      research: new CollectionStore(this.storage, 'hx.research', 'rsch')
    };

    this.llm = new LlmHub({ settings: this.settings, vault: this.vault, storage: this.storage });
    this.platform = new PlatformBridge({ settings: this.settings, vault: this.vault, storage: this.storage });
    this.hub = new ConnectionHub({ settings: this.settings, vault: this.vault, llm: this.llm, platform: this.platform });
    this.library = new LibraryStore();
    this.downloader = new FileDownloader({ settings: this.settings });
    this.pipeline = new DataPipeline({ library: this.library, settings: this.settings, downloader: this.downloader });
    this.analysis = new AnalysisService();
    this.exporter = new ExportService(this.library);
    this.prompts = new PromptLibrary();
    this.rpaScripts = new ScriptStore(this.storage);
    this.ready = false;
  }

  async init() {
    if (this.ready) return this;
    await Promise.all([this.settings.load(), this.vault.init(), this.license.init(), this.brand.load()]);
    await this.rpaScripts.seed();
    this.ready = true;
    Logger.record('info', 'workspace', 'Siap', {
      edition: this.license.edition,
      llm: this.settings.get('llm.defaultProvider')
    });
    return this;
  }

  /** AI dengan konteks brand + gerbang lisensi. */
  async askAi(task, input = {}, { onToken = null, provider = null, temperature = null, maxTokens = null } = {}) {
    this.license.require('ai');
    const { system, user } = this.prompts.task(task, input, this.brand.summary());
    return this.llm.complete({
      system,
      messages: [{ role: 'user', content: user }],
      task,
      provider,
      temperature,
      maxTokens,
      onToken
    });
  }

  /** AI yang diminta menjawab JSON; hasil parse disertakan sebagai `data`. */
  async askJson(task, input = {}, options = {}) {
    const result = await this.askAi(task, input, options);
    return { ...result, data: parseJsonLoose(result.text) };
  }

  async capacity(kind) {
    const collection = this.collections[kind];
    if (!collection) return { used: 0, max: Infinity, left: Infinity, percent: 0 };
    const used = await collection.count();
    const max = this.license.limits()[kind] ?? Infinity;
    return {
      used,
      max,
      left: Number.isFinite(max) ? Math.max(0, max - used) : Infinity,
      percent: Number.isFinite(max) ? Math.min(100, Math.round((used / max) * 100)) : 0
    };
  }

  /** Simpan item baru sambil menegakkan batas edition Free. */
  async saveItem(kind, item) {
    const collection = this.collections[kind];
    if (!collection) throw new Error(`Koleksi ${kind} tidak dikenal.`);
    if (!item.id) {
      const { used } = await this.capacity(kind);
      this.license.ensureCapacity(kind, used);
    }
    return collection.save(item);
  }

  async removeItem(kind, id) {
    return this.collections[kind].remove(id);
  }

  todayMetric(date = todayKey()) {
    return this.collections.metrics.list().then((rows) => rows.find((row) => row.date === date) || null);
  }

  async saveMetric(patch) {
    const date = patch.date || todayKey();
    const platform = patch.platform || 'all';
    const rows = await this.collections.metrics.list();
    const existing = rows.find((row) => row.date === date && (row.platform || 'all') === platform);
    return this.saveItem('metrics', { ...(existing || {}), ...patch, date, platform });
  }

  async testConnector(id) {
    return this.hub.test(id);
  }

  async pageInfo(tab = null) {
    const target = tab || (await this.activeTab());
    if (!target?.id) return null;
    return { tab: target, info: await this.send(target.id, 'hx:page-info') };
  }

  async harvest(tab, { images = true, text = true } = {}) {
    const target = tab || (await this.activeTab());
    if (!target?.id) throw new Error('Tidak ada tab aktif.');
    return this.send(target.id, 'hx:harvest', { images, text });
  }

  async selection(tab = null) {
    const target = tab || (await this.activeTab());
    if (!target?.id) return '';
    return this.send(target.id, 'hx:selection');
  }

  async send(tabId, type, payload = {}) {
    const { MessageBus } = await import('../core/MessageBus.js');
    return MessageBus.toTab(tabId, type, payload);
  }

  async activeTab() {
    const { MessageBus } = await import('../core/MessageBus.js');
    return MessageBus.activeTab();
  }

  async ingestHarvest(result, { title = null, downloadImages = false } = {}) {
    const created = [];
    if (result?.images?.items?.length) {
      const record = await this.pipeline.ingestImages({
        sourceUrl: result.sourceUrl,
        title: title || result.pageTitle,
        items: result.images.items
      });
      created.push(record);
      if (downloadImages) {
        await this.downloader.downloadMany(result.images.items.slice(0, 20));
      }
    }
    if (result?.text?.text || result?.text?.tables?.length) {
      created.push(await this.pipeline.ingestText({
        sourceUrl: result.sourceUrl,
        title: title || result.text.title || result.pageTitle,
        text: result.text.text,
        tables: result.text.tables,
        meta: result.text.meta
      }));
    }
    return created;
  }

  async sendToPlatform(action, payload) {
    this.license.require('platform');
    return this.platform.send(action, payload);
  }

  async dashboard() {
    const [ideas, scripts, calendar, deals, metrics, datasets] = await Promise.all([
      this.collections.ideas.count(),
      this.collections.scripts.count(),
      this.collections.calendar.count(),
      this.collections.deals.count(),
      this.collections.metrics.count(),
      this.library.listDatasets()
    ]);
    const upcoming = (await this.collections.calendar.list())
      .filter((slot) => slot.date && slot.date >= todayKey())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 3);
    const pipeline = (await this.collections.deals.list()).filter((deal) => !['paid', 'cancelled'].includes(deal.status));
    const value = pipeline.reduce((sum, deal) => sum + (Number(deal.value) || 0), 0);
    const recent = (await this.collections.ideas.list()).slice(0, 3);
    return {
      counts: { ideas, scripts, calendar, deals, metrics, datasets: datasets.length },
      upcoming,
      pipeline: { count: pipeline.length, value },
      recent,
      brand: this.brand.completeness()
    };
  }

  async exportBackup() {
    const all = await this.storage.all();
    return JSON.stringify({
      app: 'creator-harness',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: all
    }, null, 2);
  }

  async importBackup(raw) {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const data = parsed?.data || parsed;
    if (!data || typeof data !== 'object') throw new Error('Backup tidak dikenali.');
    for (const [key, value] of Object.entries(data)) {
      if (key === 'hx.vault' || key === 'hx.license') continue;
      await this.storage.set(key, value);
    }
    Object.values(this.collections).forEach((collection) => collection.invalidate());
    await Promise.all([this.settings.load(), this.brand.load()]);
    return Object.keys(data).length;
  }

  newId(prefix) {
    return uid(prefix);
  }
}
