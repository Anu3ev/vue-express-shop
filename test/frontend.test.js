import { afterEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import App from '../src/App.vue';
import ProductCard from '../src/components/ProductCard.vue';
import FeedbackForm from '../src/components/FeedbackForm.vue';

const goods = [{ id: 1, title: 'Tee', img: '/images/tee.jpg', available: true, priceCents: 1595 }];
const successfulResponse = { ok: true, json: async () => ({ goods }) };

// Use the imported SFC's real Options API hooks without mounting a DOM.
// Playwright covers browser behavior; this fixture controls request timing.
function createCatalogHarness({ fetch }) {
  let timerId = 0;
  const timers = new Map();
  const removedEvents = [];
  const window = {
    localStorage: { getItem: () => null },
    removeEventListener: name => removedEvents.push(name),
  };
  vi.stubGlobal('window', window);
  vi.stubGlobal('fetch', fetch);
  vi.stubGlobal('setTimeout', callback => {
    timers.set(++timerId, callback);
    return timerId;
  });
  vi.stubGlobal('clearTimeout', id => timers.delete(id));

  const app = App.data();
  for (const [name, method] of Object.entries(App.methods)) {
    app[name] = method.bind(app);
  }
  App.created.call(app);
  return {
    app,
    timers,
    removedEvents,
    unmount: () => App.beforeUnmount.call(app),
  };
}

afterEach(() => vi.unstubAllGlobals());

test('catalog ignores a repeated load while the current request is pending', async () => {
  const response = Promise.withResolvers();
  let requests = 0;
  const { app, timers } = createCatalogHarness({
    fetch() {
      requests += 1;
      return response.promise;
    },
  });
  const pending = app.loadCatalog();
  await app.loadCatalog();
  assert.equal(requests, 1);

  response.resolve(successfulResponse);
  await pending;
  assert.deepEqual(app.goods, goods);
  assert.equal(app.loading, false);
  assert.equal(app.catalogController, null);
  assert.equal(timers.size, 0);
});

test('unmount aborts the owned request and clears its timer without showing an error', async () => {
  let requestSignal;
  const { app, timers, removedEvents, unmount } = createCatalogHarness({
    fetch(url, { signal }) {
      requestSignal = signal;
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    },
  });
  const pending = app.loadCatalog();
  unmount();
  await pending;

  assert.equal(requestSignal.aborted, true);
  assert.equal(timers.size, 0);
  assert.equal(app.catalogController, null);
  assert.equal(app.catalogTimeout, null);
  assert.equal(app.loadError, '');
  assert.deepEqual(removedEvents, ['storage']);
});

test('a response that finishes after unmount does not restore catalog or cart state', async () => {
  const response = Promise.withResolvers();
  const { app, unmount } = createCatalogHarness({ fetch: () => response.promise });
  const pending = app.loadCatalog();
  unmount();
  response.resolve(successfulResponse);
  await pending;

  assert.equal(app.goods.length, 0);
  assert.equal(app.cart.length, 0);
  assert.equal(app.storageWarning, '');
  assert.equal(app.loadError, '');
});

test('a request timeout still offers retry and releases request resources', async () => {
  const { app, timers } = createCatalogHarness({
    fetch(url, { signal }) {
      return new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      });
    },
  });
  const pending = app.loadCatalog();
  const timeout = timers.values().next().value;
  timeout();
  await pending;

  assert.match(app.loadError, /try again/);
  assert.equal(app.loading, false);
  assert.equal(app.catalogController, null);
  assert.equal(timers.size, 0);
});

test('a failed catalog request can be retried successfully', async () => {
  let requests = 0;
  const { app, timers } = createCatalogHarness({
    async fetch() {
      requests += 1;
      if (requests === 1) throw new Error('Network unavailable');
      return successfulResponse;
    },
  });
  await app.loadCatalog();
  assert.match(app.loadError, /try again/);
  await app.loadCatalog();

  assert.equal(requests, 2);
  assert.deepEqual(app.goods, goods);
  assert.equal(app.loadError, '');
  assert.equal(app.loading, false);
  assert.equal(timers.size, 0);
});

test('shipped Vue templates compile to executable render functions', async () => {
  assert.equal(App.components.ProductCard, ProductCard);
  assert.equal(App.components.FeedbackForm, FeedbackForm);
  // Vitest's Node environment compiles SFC templates for server rendering.
  for (const component of [App, ProductCard, FeedbackForm]) {
    assert.equal(typeof component.ssrRender, 'function');
  }

  assert.match(await renderToString(createSSRApp(App)), /Loading products…/);
  const productHtml = await renderToString(createSSRApp(ProductCard, { good: goods[0] }));
  assert.match(productHtml, /Add Tee to cart/);
  assert.match(productHtml, /\$15\.95/);
  assert.match(await renderToString(createSSRApp(FeedbackForm)), /Validate sample/);
});
