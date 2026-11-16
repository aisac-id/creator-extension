import { el, mountIcon } from '../../ui/Dom.js';
import { clamp } from '../../core/Format.js';
import { STEPS, TOTAL_STEPS } from './steps.js';
import { Tour, TOUR_STEPS } from './Tour.js';

const ONBOARD_KEY = 'hx.onboarded';
const STEP_KEY = 'hx.onboard.step';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Alur onboarding 12 langkah: aksi nyata, bisa dilewati, dan disimpan untuk dilanjutkan. */
export class OnboardingFlow {
  constructor(app, { force = false } = {}) {
    this.app = app;
    this.force = force;
    this.index = 0;
    this.busy = false;
    this.root = null;
    this.cleanup = null;
    this.state = {
      tourDone: false,
      demoIds: [],
      demoCount: 0,
      exportId: null,
      exported: null,
      llmTested: false,
      platformTested: false,
      rpaDone: false
    };
  }

  get services() {
    return this.app.services;
  }

  async start() {
    const done = await this.services.storage.get(ONBOARD_KEY, false);
    if (done && !this.force) return;
    if (this.force) await this.services.storage.set(ONBOARD_KEY, false);
    const saved = Number(await this.services.storage.get(STEP_KEY, 0)) || 0;
    this.index = this.force ? 0 : clamp(saved, 0, TOTAL_STEPS - 1);
    await this.render();
  }

  async persist() {
    await this.services.storage.set(STEP_KEY, this.index);
  }

  async render() {
    this.cleanup?.();
    this.cleanup = null;
    if (this.app.state.mode === 'rail') await this.app.applyMode('sidebar');
    const step = STEPS[this.index];
    const host = this.app.onboardingHost;
    this.root = this.root || el('div', { class: 'hx-onboard', role: 'dialog', 'aria-modal': 'true' });
    host.hidden = false;
    host.replaceChildren(this.root);

    const close = el('button', { class: 'hx-icon-btn', type: 'button', title: 'Tutup & lanjut nanti', 'aria-label': 'Tutup panduan' });
    close.append(mountIcon('close', 16));
    close.addEventListener('click', () => this.later());

    const head = el('div', { class: 'hx-onboard-head' },
      el('div', { class: 'hx-onboard-step', text: `${this.index + 1}/${TOTAL_STEPS}` }),
      el('div', { class: 'hx-onboard-title', text: step.title }),
      close
    );

    this.nextBtn = el('button', {
      class: 'hx-btn is-primary',
      type: 'button',
      text: step.nextLabel || 'Lanjut'
    });
    this.nextBtn.addEventListener('click', () => this.next());

    const body = el('div', { class: 'hx-onboard-body' });
    if (step.enter) await step.enter(this);
    const built = await step.build?.(this);
    if (Array.isArray(built)) body.append(...built.flat(3).filter((node) => node instanceof Node));
    else if (built instanceof Node) body.append(built);

    const back = el('button', {
      class: 'hx-btn is-small',
      type: 'button',
      text: 'Kembali',
      disabled: this.index === 0
    });
    back.addEventListener('click', () => this.back());
    const skip = el('button', { class: 'hx-btn is-ghost is-small', type: 'button', text: 'Lewati', title: 'Lewati seluruh panduan' });
    skip.addEventListener('click', () => this.skip());
    const dots = el('div', { class: 'hx-onboard-dots' },
      STEPS.map((entry, index) => el('span', {
        class: `hx-onboard-dot${index === this.index ? ' is-on' : ''}`,
        title: entry.title
      }))
    );
    const foot = el('div', { class: 'hx-onboard-actions' }, back, skip, dots, this.nextBtn);
    const card = el('div', { class: 'hx-onboard-card' }, head, body, foot);
    this.root.replaceChildren(card);
    await this.persist();
  }

  gate(allowed) {
    if (this.nextBtn) this.nextBtn.disabled = !allowed;
  }

  async next() {
    if (this.busy) return;
    const step = STEPS[this.index];
    this.busy = true;
    try {
      if (step.onNext) {
        const proceed = await step.onNext(this);
        if (proceed === false) return;
      }
      if (this.index >= TOTAL_STEPS - 1) {
        await this.finish();
        return;
      }
      this.index += 1;
      await this.render();
    } catch (error) {
      this.app.toast.error(error.message || 'Langkah gagal dijalankan.');
    } finally {
      this.busy = false;
    }
  }

  async back() {
    if (this.index === 0) return;
    this.index -= 1;
    await this.render();
  }

  async later() {
    await this.persist();
    this.close();
    this.app.toast.info('Panduan disimpan. Lanjutkan dari tombol ? kapan saja.');
  }

  async skip() {
    await this.services.storage.set(ONBOARD_KEY, true);
    this.close();
    this.app.toast.info('Panduan dilewati. Semua fitur tetap bisa dipakai.');
  }

  async finish() {
    await this.services.storage.set(ONBOARD_KEY, true);
    await this.services.storage.remove(STEP_KEY);
    this.close();
    this.app.toast.success('Panduan selesai. Selamat berkarya!');
  }

  close() {
    this.cleanup?.();
    this.cleanup = null;
    if (this.app.onboardingHost) {
      this.app.onboardingHost.hidden = true;
      this.app.onboardingHost.replaceChildren();
    }
    this.root = null;
  }

  runTour() {
    return new Promise((resolve) => {
      const tour = new Tour(this.app, TOUR_STEPS, () => {
        this.state.tourDone = true;
        resolve();
      });
      tour.start();
    });
  }

  /** Sembunyikan panduan sebentar agar user melihat panel nyata, lalu lanjutkan. */
  async peek(tabId) {
    if (!this.root) return;
    this.root.hidden = true;
    await this.app.selectTab(tabId);
    await sleep(1600);
    if (this.root) this.root.hidden = false;
  }
}
