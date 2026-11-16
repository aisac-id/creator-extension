import { el, downloadText, readFile, chooseFile } from '../../ui/Dom.js';
import { field, input, badge, note } from './PanelKit.js';

/** Bagian Secret Vault: mode kunci, unlock, passphrase, dan import/export .env. */
export class VaultSection {
  constructor(panel) {
    this.panel = panel;
    this.app = panel.app;
    this.services = panel.services;
    this.node = el('div');
    this.panel.track(this.services.vault.onChange(() => this.render()));
    this.render();
  }

  async render() {
    const vault = this.services.vault;
    const mode = vault.isLocked ? 'Terkunci' : (vault.mode === 'passphrase' ? 'Passphrase' : 'Kunci perangkat');
    const children = [
      el('div', { class: 'hx-section-head' },
        el('h3', { class: 'hx-section-title', text: 'Secret Vault' }),
        badge(mode, vault.isLocked ? 'is-warn' : 'is-ok')
      ),
      note('API key dan token disimpan terenkripsi AES-GCM 256. Tidak pernah masuk storage.sync atau log.')
    ];

    if (vault.isLocked) {
      const pass = el('input', { class: 'hx-input', type: 'password', placeholder: 'Passphrase vault' });
      children.push(
        field('Buka vault', pass),
        el('button', {
          class: 'hx-btn is-small is-primary', type: 'button', text: 'Buka',
          onclick: async () => {
            try {
              await vault.unlock(pass.value);
              this.app.toast.success('Vault terbuka.');
            } catch (error) {
              this.app.toast.error(error.message);
            }
          }
        })
      );
      this.node.replaceChildren(...children);
      return;
    }

    const next = el('input', { class: 'hx-input', type: 'password', placeholder: 'Passphrase baru (min 8 karakter)' });
    const confirm = el('input', { class: 'hx-input', type: 'password', placeholder: 'Ulangi passphrase' });
    children.push(
      el('div', { class: 'hx-grid hx-grid-2' },
        field('Passphrase baru', next),
        field('Konfirmasi', confirm)
      ),
      el('div', { class: 'hx-row' },
        el('button', {
          class: 'hx-btn is-small', type: 'button', text: 'Aktifkan passphrase',
          onclick: async () => {
            try {
              if (next.value !== confirm.value) throw new Error('Passphrase tidak sama.');
              await vault.setPassphrase(next.value);
              next.value = '';
              confirm.value = '';
              this.app.toast.success('Vault memakai passphrase.');
            } catch (error) {
              this.app.toast.error(error.message);
            }
          }
        }),
        vault.mode === 'passphrase'
          ? el('button', {
            class: 'hx-btn is-small', type: 'button', text: 'Kunci sekarang',
            onclick: () => {
              vault.lock();
              this.app.toast.info('Vault dikunci.');
            }
          })
          : el('button', {
            class: 'hx-btn is-small', type: 'button', text: 'Pakai kunci perangkat',
            onclick: async () => {
              try {
                await vault.setPassphrase('');
                this.app.toast.success('Vault memakai kunci perangkat.');
              } catch (error) {
                this.app.toast.error(error.message);
              }
            }
          })
      ),
      el('div', { class: 'hx-row' },
        el('button', { class: 'hx-btn is-small', type: 'button', text: 'Import .env', onclick: () => this.importEnv() }),
        el('button', { class: 'hx-btn is-small', type: 'button', text: 'Export nama (.env)', onclick: () => this.exportEnv() }),
        el('button', { class: 'hx-btn is-small', type: 'button', text: 'Salin daftar nama', onclick: () => this.copyNames() })
      ),
      el('p', { class: 'hx-muted hx-small', text: `${vault.names.length} secret tersimpan: ${vault.names.join(', ') || '—'}` })
    );
    this.node.replaceChildren(...children);
  }

  async importEnv() {
    const file = await chooseFile('.env,text/plain');
    if (!file) return;
    try {
      const names = await this.services.vault.importEnv(await readFile(file));
      this.app.toast.success(`${names.length} variabel diimpor.`);
    } catch (error) {
      this.app.toast.error(error.message);
    }
  }

  async exportEnv() {
    try {
      const text = await this.services.vault.exportEnv(false);
      downloadText(text, 'creator-secrets.env', 'text/plain');
      this.app.toast.info('File .env berisi nama variabel tanpa nilai.');
    } catch (error) {
      this.app.toast.error(error.message);
    }
  }

  async copyNames() {
    try {
      await navigator.clipboard.writeText(this.services.vault.names.join('\n'));
      this.app.toast.success('Daftar nama secret disalin.');
    } catch {
      this.app.toast.error('Gagal menyalin.');
    }
  }
}
