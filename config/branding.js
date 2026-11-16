/** Konfigurasi branding white-label: satu file untuk nama, warna, tautan. */
export const BRANDING = {
  product: 'Creator Harness',
  short: 'Creator',
  tagline: 'Semua kebutuhan konten kreator dalam satu sidebar.',
  version: '1.0.0',
  standard: 'Harness Extension v1.5',
  accent: '#22d3ee',
  accent2: '#818cf8',
  supportUrl: 'https://github.com/aisac-id/creator-extension/issues',
  docsUrl: 'https://github.com/aisac-id/harness-extension/blob/main/STANDARDS.md',
  maker: 'aisac-id',
  whitelabel: {
    enabled: false,
    company: '',
    logoText: '',
    footer: ''
  }
};

export const LICENSING = {
  publicKeyB64: 'CxlTn7Qi6vFEVGkKZzBLsV82zoGnOGh2OA2e5hnZ100',
  keyPrefix: 'CH1',
  trialDays: 14,
  freeLimits: { ideas: 25, scripts: 5, calendar: 20, deals: 3, metrics: 50 },
  features: {
    ai: ['pro', 'trial', 'bundle', 'enterprise'],
    platform: ['pro', 'trial', 'bundle', 'enterprise'],
    bulkExport: ['pro', 'trial', 'bundle', 'enterprise'],
    invoice: ['pro', 'trial', 'bundle', 'enterprise']
  }
};
