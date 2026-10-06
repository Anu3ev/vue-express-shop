const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ShopCart = require('../public/cart.js');

const source = readFileSync(path.join(__dirname, '../public/scripts.js'), 'utf8');
const goods = [{ id: 1, title: 'Tee', img: '/images/tee.jpg', available: true, priceCents: 1595 }];
const successfulResponse = { ok: true, json: async () => ({ goods }) };

// Capture the real Options API hooks without mounting a DOM. Browser UI
// behavior remains covered by Playwright; this fixture controls request timing.
function createCatalogHarness({ fetch }) {
  let definition;
  let timerId = 0;
  const timers = new Map();
  const removedEvents = [];
  const window = {
    localStorage: { getItem: () => null },
    removeEventListener: name => removedEvents.push(name),
  };
  const context = {
    Vue: {
      createApp(options) {
        definition = options;
        return { mount() {} };
      },
    },
    ShopCart,
    AbortController,
    Intl,
    window,
    fetch,
    setTimeout(callback) {
      timers.set(++timerId, callback);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  vm.runInNewContext(source, context);

  const app = definition.data();
  for (const [name, method] of Object.entries(definition.methods)) {
    app[name] = method.bind(app);
  }
  definition.created.call(app);
  return {
    app,
    timers,
    removedEvents,
    unmount: () => definition.beforeUnmount.call(app),
  };
}

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

test('shipped Vue templates compile to executable render functions', () => {
  const { compile } = require('vue');
  const html = readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
  const pageTemplate = html.match(/<body>([\s\S]*)<\/body>/)[1];
  const componentTemplates = [...source.matchAll(/template: `([\s\S]*?)`,/g)];

  assert.equal(typeof compile(pageTemplate), 'function');
  for (const match of componentTemplates) {
    assert.equal(typeof compile(match[1]), 'function');
  }
});
