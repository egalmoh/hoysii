import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const script = readFileSync(new URL('../public/pwa-install.js', import.meta.url), 'utf8');

function browser({ standalone = false, ios = false } = {}) {
  const window = new EventTarget();
  const media = Object.assign(new EventTarget(), { matches: standalone });
  window.isSecureContext = true;
  window.matchMedia = () => media;
  vm.runInNewContext(script, {
    window, Event,
    navigator: { standalone: false, userAgent: ios ? 'iPhone' : 'Android', platform: '', maxTouchPoints: 0 },
  });
  return { window, media, api: window.hoysiiPwa };
}

function offerInstall(window, { outcome = 'accepted', prompt = async () => {} } = {}) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  event.prompt = prompt;
  event.userChoice = Promise.resolve({ outcome });
  window.dispatchEvent(event);
  assert.equal(event.defaultPrevented, true);
}

test('captures an install offer before Profile opens, consumes it once and marks acceptance', async () => {
  const { window, api } = browser();
  let prompts = 0;
  offerInstall(window, { prompt: async () => { prompts += 1; } });
  assert.equal(api.getState().canPrompt, true);
  assert.equal(await api.install(), 'accepted');
  assert.equal(api.getState().installed, true);
  assert.equal(await api.install(), 'unavailable');
  assert.equal(prompts, 1);
});

test('dismissing an offer keeps browser instructions available and accepts a fresh offer', async () => {
  const { window, api } = browser();
  offerInstall(window, { outcome: 'dismissed' });
  assert.equal(await api.install(), 'dismissed');
  assert.equal(api.getState().installed, false);
  assert.equal(api.getState().canPrompt, false);
  assert.equal(await api.install(), 'unavailable');
  offerInstall(window);
  assert.equal(await api.install(), 'accepted');
});

test('duplicate taps never open duplicate prompts and errors clear the busy state', async () => {
  const { window, api } = browser();
  let rejectPrompt;
  let prompts = 0;
  offerInstall(window, { prompt: () => { prompts += 1; return new Promise((_, reject) => { rejectPrompt = reject; }); } });
  const first = api.install();
  assert.equal(api.getState().busy, true);
  assert.equal(await api.install(), 'unavailable');
  rejectPrompt(new Error('Browser cannot open prompt'));
  assert.equal(await first, 'unavailable');
  assert.equal(api.getState().busy, false);
  assert.equal(api.getState().installed, false);
  assert.equal(prompts, 1);
});

test('standalone launch and browser-menu installation suppress further offers', async () => {
  const standalone = browser({ standalone: true });
  assert.equal(standalone.api.getState().installed, true);
  assert.equal(await standalone.api.install(), 'unavailable');
  const { window, api } = browser();
  let changes = 0;
  window.addEventListener('hoysii:pwa-change', () => { changes += 1; });
  window.dispatchEvent(new Event('appinstalled'));
  assert.equal(api.getState().installed, true);
  assert.equal(changes, 1);
});

test('iPhone without a native prompt uses instructions, and display changes notify the UI', async () => {
  const { window, media, api } = browser({ ios: true });
  assert.equal(api.getState().isIOS, true);
  assert.equal(api.getState().canPrompt, false);
  assert.equal(await api.install(), 'unavailable');
  let changed = false;
  window.addEventListener('hoysii:pwa-change', () => { changed = true; });
  media.matches = true;
  media.dispatchEvent(new Event('change'));
  assert.equal(changed, true);
  assert.equal(api.getState().installed, true);
});
