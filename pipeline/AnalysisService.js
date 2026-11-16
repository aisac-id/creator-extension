/** Analisis lokal untuk dataset hasil panen. */
export class AnalysisService {
  analyze(dataset, items = []) {
    const kinds = {};
    const domains = {};
    const seen = new Set();
    let duplicates = 0;
    let words = 0;
    let bytes = Number(dataset?.bytes) || 0;

    items.forEach((item) => {
      const kind = item.kind || 'lain';
      kinds[kind] = (kinds[kind] || 0) + 1;
      bytes += Number(item.bytes) || 0;
      if (item.text) words += String(item.text).split(/\s+/).filter(Boolean).length;
      if (item.url) {
        try {
          const domain = new URL(item.url).hostname.replace(/^www\./, '');
          domains[domain] = (domains[domain] || 0) + 1;
        } catch {
          // URL relatif tidak dihitung
        }
        if (seen.has(item.url)) duplicates += 1;
        seen.add(item.url);
      }
    });

    return {
      count: items.length,
      bytes,
      duplicates,
      kinds,
      words,
      domains: Object.entries(domains)
        .map(([domain, count]) => ({ domain, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    };
  }

  async analyzeDataset(library, datasetId) {
    const dataset = await library.getDataset(datasetId);
    const items = await library.itemsOf(datasetId, { limit: 5000 });
    return { dataset, stats: this.analyze(dataset, items) };
  }
}
