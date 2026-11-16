/** Panen teks, tabel, daftar, dan metadata halaman (reader-mode ringan). */
export class TextScraper {
  constructor({ doc = document, settings, log = null }) {
    this.doc = doc;
    this.settings = settings;
    this.log = log || (() => {});
  }

  meta() {
    const pick = (selector) => this.doc.querySelector(selector)?.getAttribute('content')?.trim() || '';
    const canonical = this.doc.querySelector('link[rel="canonical"]')?.href || this.doc.location?.href || '';
    return {
      title: pick('meta[property="og:title"]') || this.doc.title || '',
      description: pick('meta[property="og:description"]') || pick('meta[name="description"]'),
      author: pick('meta[name="author"]') || pick('meta[property="article:author"]'),
      publishedAt: pick('meta[property="article:published_time"]'),
      url: canonical
    };
  }

  container() {
    const candidates = [
      this.doc.querySelector('article'),
      this.doc.querySelector('main'),
      this.doc.querySelector('[role="main"]'),
      this.doc.body
    ].filter(Boolean);
    let best = this.doc.body;
    let bestScore = 0;
    candidates.forEach((node) => {
      const score = Array.from(node.querySelectorAll('p'))
        .reduce((sum, p) => sum + (p.textContent || '').trim().length, 0);
      if (score > bestScore) {
        best = node;
        bestScore = score;
      }
    });
    return best;
  }

  tables() {
    const output = [];
    Array.from(this.doc.querySelectorAll('table')).slice(0, 5).forEach((table) => {
      const headers = Array.from(table.querySelectorAll('thead th')).map((th) => (th.textContent || '').trim());
      const rows = Array.from(table.querySelectorAll('tbody tr')).slice(0, 60)
        .map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent || '').trim()));
      if (headers.length || rows.length) {
        output.push({ headers, rows, caption: (table.caption?.textContent || '').trim() });
      }
    });
    return output;
  }

  lists() {
    const output = [];
    Array.from(this.doc.querySelectorAll('ul, ol')).slice(0, 6).forEach((list) => {
      const items = Array.from(list.querySelectorAll(':scope > li')).slice(0, 25)
        .map((li) => (li.textContent || '').replace(/\s+/g, ' ').trim())
        .filter((text) => text.length > 3);
      if (items.length > 1) output.push({ ordered: list.tagName === 'OL', items });
    });
    return output;
  }

  run() {
    this.log('Mengekstrak teks halaman...');
    const limit = this.settings.get('scraper.textMaxChars', 20000);
    const root = this.container();
    const blocks = Array.from(root.querySelectorAll('h1, h2, h3, p, blockquote'))
      .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
      .filter((text) => text.length > 30);
    let text = blocks.join('\n\n');
    if (text.length < 200) {
      text = (root.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    }
    const truncated = text.length > limit;
    if (truncated) text = text.slice(0, limit);
    return {
      title: this.meta().title,
      text,
      truncated,
      meta: this.meta(),
      tables: this.tables(),
      lists: this.lists(),
      words: text.split(/\s+/).filter(Boolean).length
    };
  }
}
