import { ImageScraper } from './ImageScraper.js';
import { TextScraper } from './TextScraper.js';

/** Orkestrasi panen: semua scraper terdaftar di satu hub. */
export class ScraperHub {
  constructor({ doc = document, win = window, settings, log = null }) {
    this.doc = doc;
    this.win = win;
    this.settings = settings;
    this.log = log || (() => {});
    this.registry = {
      images: new ImageScraper({ doc, win, settings, log }),
      text: new TextScraper({ doc, settings, log })
    };
  }

  register(id, scraper) {
    this.registry[id] = scraper;
    return this;
  }

  async harvest({ images = true, text = true } = {}) {
    const result = {
      sourceUrl: this.doc.location?.href || this.doc.baseURI,
      pageTitle: this.doc.title,
      images: null,
      text: null
    };
    if (images) {
      try {
        result.images = await this.registry.images.run();
      } catch (error) {
        this.log(`Panen gambar gagal: ${error.message}`);
        result.images = { items: [], scanned: 0, skipped: 0, error: error.message };
      }
    }
    if (text) {
      try {
        result.text = this.registry.text.run();
      } catch (error) {
        this.log(`Panen teks gagal: ${error.message}`);
        result.text = { title: '', text: '', tables: [], lists: [], error: error.message };
      }
    }
    return result;
  }
}
