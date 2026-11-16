import { AppError } from '../core/AppError.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Panen gambar: img/srcset/picture/background, filter ukuran, auto-scroll lazy-load. */
export class ImageScraper {
  constructor({ doc = document, win = window, settings, log = null }) {
    this.doc = doc;
    this.win = win;
    this.settings = settings;
    this.log = log || (() => {});
  }

  async autoScroll() {
    if (!this.settings.get('scraper.autoScroll', true)) return;
    const steps = this.settings.get('scraper.scrollSteps', 6);
    const delay = this.settings.get('scraper.pacingMs', 600);
    for (let i = 0; i < steps; i += 1) {
      this.win.scrollBy({ top: Math.round(this.win.innerHeight * 0.9), behavior: 'instant' });
      await sleep(delay);
    }
    this.win.scrollTo({ top: 0, behavior: 'instant' });
  }

  absolute(url) {
    if (!url) return null;
    try {
      const resolved = new URL(url, this.doc.baseURI).href;
      if (!/^(https?:|chrome-extension:|moz-extension:)/i.test(resolved)) return null;
      return resolved.split('#')[0];
    } catch {
      return null;
    }
  }

  fromSrcset(srcset) {
    const parts = String(srcset || '').split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean);
    return parts.at(-1) || '';
  }

  collectDomImages() {
    const output = [];
    const images = Array.from(this.doc.images || []);
    images.forEach((img) => {
      const url = this.absolute(img.currentSrc || img.src || this.fromSrcset(img.srcset));
      if (!url) return;
      output.push({
        url,
        alt: (img.alt || img.title || '').trim(),
        width: img.naturalWidth || Number(img.getAttribute('width')) || 0,
        height: img.naturalHeight || Number(img.getAttribute('height')) || 0,
        source: 'img'
      });
    });
    this.doc.querySelectorAll('picture source[srcset]').forEach((source) => {
      const url = this.absolute(this.fromSrcset(source.getAttribute('srcset')));
      if (url) output.push({ url, alt: '', width: 0, height: 0, source: 'picture' });
    });
    return output;
  }

  collectBackgroundImages() {
    if (!this.settings.get('scraper.includeBackground', true)) return [];
    const output = [];
    const nodes = Array.from(this.doc.querySelectorAll('[style*="background"]')).slice(0, 2000);
    const pattern = /url\((['"]?)(.*?)\1\)/gi;
    nodes.forEach((node) => {
      const style = node.getAttribute('style') || '';
      let match;
      while ((match = pattern.exec(style))) {
        const url = this.absolute(match[2]);
        if (url) output.push({ url, alt: '', width: 0, height: 0, source: 'background' });
      }
    });
    return output;
  }

  async run() {
    this.log('Memindai gambar halaman...');
    await this.autoScroll();
    const minWidth = this.settings.get('scraper.minImageWidth', 200);
    const minHeight = this.settings.get('scraper.minImageHeight', 200);
    const maxImages = this.settings.get('scraper.maxImages', 80);
    const seen = new Set();
    const all = [...this.collectDomImages(), ...this.collectBackgroundImages()];
    const items = [];
    let skipped = 0;
    for (const item of all) {
      if (seen.has(item.url)) {
        skipped += 1;
        continue;
      }
      seen.add(item.url);
      if (item.width && item.width < minWidth) {
        skipped += 1;
        continue;
      }
      if (item.height && item.height < minHeight) {
        skipped += 1;
        continue;
      }
      items.push(item);
      if (items.length >= maxImages) break;
    }
    this.log(`Ditemukan ${items.length} gambar (${skipped} dilewati filter).`);
    return { items, scanned: all.length, skipped };
  }
}

export { sleep, AppError };
