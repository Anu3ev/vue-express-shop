'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { test, before, after } = require('node:test');
const app = require('../server.js');
const { normalizeCatalog, normalizeProduct } = require('../lib/catalog.cjs');

const root = path.resolve(__dirname, '..');
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('catalog has eight products with normalized, safe display data', async () => {
  const response = await fetch(`${baseUrl}/api/catalog`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /^application\/json/);
  assert.equal(response.headers.get('x-powered-by'), null);
  const { goods } = await response.json();

  assert.equal(goods.length, 8);
  for (const product of goods) {
    assert.deepEqual(Object.keys(product).sort(), ['available', 'id', 'img', 'priceCents', 'salePrice', 'title']);
    assert.equal(Number.isInteger(product.id), true);
    assert.equal(typeof product.title, 'string');
    assert.ok(product.title.length > 0);
    assert.match(product.img, /^\/images\//);
    assert.equal(typeof product.available, 'boolean');
    if (product.available) {
      assert.equal(Number.isInteger(product.priceCents), true);
      assert.equal(product.salePrice, product.priceCents / 100);
    } else {
      assert.equal(product.priceCents, null);
      assert.equal(product.salePrice, null);
    }
  }

  assert.equal(goods.find((product) => product.id === 3).available, false);
  assert.equal(goods.find((product) => product.id === 5).title, 'Unknown Product');
  assert.equal(goods.find((product) => product.id === 8).img, '/images/product-placeholder.svg');
  assert.equal(goods.find((product) => product.id === 2).priceCents, 1595);
});

test('compatibility catalog endpoint returns the same JSON', async () => {
  const current = await (await fetch(`${baseUrl}/api/catalog`)).json();
  const legacy = await (await fetch(`${baseUrl}/catalogData`)).json();
  assert.deepEqual(legacy, current);

  const head = await fetch(`${baseUrl}/api/catalog`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
});

test('local server serves the page and image fallback only from public', async () => {
  const index = await fetch(`${baseUrl}/`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get('content-type'), /^text\/html/);
  assert.equal(await index.text(), fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'));

  const placeholder = await fetch(`${baseUrl}/images/product-placeholder.svg`);
  assert.equal(placeholder.status, 200);
  assert.match(placeholder.headers.get('content-type'), /^image\/svg\+xml/);
  assert.match(await placeholder.text(), /<svg/);
});

test('missing, invalid and unsafe prices stay unavailable; legitimate cents round', () => {
  for (const salePrice of [undefined, null, '', '10', -1, NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
    const product = normalizeProduct({ id: 1, salePrice });
    assert.equal(product.salePrice, null);
    assert.equal(product.priceCents, null);
    assert.equal(product.available, false);
  }

  for (const [salePrice, expected] of [[0, 0], [15.95, 1595], [1.005, 101], [10.075, 1008], [1e-7, 0]]) {
    const product = normalizeProduct({ id: 1, salePrice });
    assert.equal(product.priceCents, expected);
    assert.equal(product.salePrice, expected / 100);
    assert.equal(product.available, true);
  }
});

test('normalization provides fallbacks and excludes unsafe images and invalid identities', () => {
  for (const title of [undefined, null, '', '  ', 123]) {
    assert.equal(normalizeProduct({ id: 1, title }).title, 'Unknown Product');
  }

  for (const img of [undefined, null, '', 'https://example.com/p.png', 'javascript:alert(1)', '/images/../server.js', '/images/%2e%2e/p.png', '//example.com/p.png']) {
    assert.equal(normalizeProduct({ id: 1, img }).img, '/images/product-placeholder.svg');
  }

  assert.equal(normalizeProduct({ id: 1, title: '  Shirt  ', img: 'images/products/shirts/1.jpg' }).title, 'Shirt');
  assert.equal(normalizeProduct({ id: 1, img: 'images/products/shirts/1.jpg' }).img, '/images/products/shirts/1.jpg');
  for (const id of [undefined, null, '1', 0, -1, 1.5, Infinity]) {
    assert.equal(normalizeProduct({ id }), null);
  }
  assert.deepEqual(normalizeCatalog(null), { goods: [] });
  const catalog = normalizeCatalog({ goods: [null, { id: 1, salePrice: 10 }, { id: 1, salePrice: 20 }] });
  assert.equal(catalog.goods.length, 1);
  assert.equal(catalog.goods[0].priceCents, 1000);
  assert.equal(Object.isFrozen(catalog), true);
  assert.equal(Object.isFrozen(catalog.goods), true);
  assert.equal(Object.isFrozen(catalog.goods[0]), true);
});

test('source, data, dependency and dotfile paths are not publicly served', async () => {
  const paths = [
    '/server.js', '/package.json', '/package-lock.json', '/README.md',
    '/products/data.json', '/cart.json', '/stats.json', '/totalPrice.json',
    '/.git/config', '/.env', '/node_modules/express/package.json',
    '/lib/catalog.cjs', '/test/server.test.cjs', '/public/../server.js',
    '/images/../../package.json', '/%2e%2e/server.js',
  ];
  for (const pathname of paths) {
    const response = await fetch(`${baseUrl}${pathname}`);
    assert.equal(response.status, 404, pathname);
    assert.match(response.headers.get('content-type'), /^application\/json/, pathname);
    assert.deepEqual(await response.json(), { error: 'Not found' }, pathname);
  }
});

test('legacy cart routes no longer read or change shared state', async () => {
  for (const route of ['/cartItems', '/addToCart', '/removeItem', '/totalPrice']) {
    for (const method of ['GET', 'POST']) {
      const response = await fetch(`${baseUrl}${route}`, {
        method,
        ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: '{"id":1,"salePrice":0,"count":999}' } : {}),
      });
      assert.equal(response.status, 404, `${method} ${route}`);
      assert.deepEqual(await response.json(), { error: 'Not found' });
    }
  }
});

test('write methods reject even malformed JSON and leave catalog files and results unchanged', async () => {
  const catalogPath = path.join(root, 'products/data.json');
  const beforeFile = fs.readFileSync(catalogPath, 'utf8');
  const beforeCatalog = await (await fetch(`${baseUrl}/api/catalog`)).json();

  for (const route of ['/api/catalog', '/catalogData']) {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      const response = await fetch(`${baseUrl}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: '{"salePrice":0, broken',
      });
      assert.equal(response.status, 405, `${method} ${route}`);
      assert.equal(response.headers.get('allow'), 'GET, HEAD');
      assert.deepEqual(await response.json(), { error: 'Method not allowed' });
    }
  }

  assert.equal(fs.readFileSync(catalogPath, 'utf8'), beforeFile);
  assert.deepEqual(await (await fetch(`${baseUrl}/api/catalog`)).json(), beforeCatalog);
});

test('unknown routes and malformed URLs produce bounded JSON errors', async () => {
  const missing = await fetch(`${baseUrl}/does-not-exist`);
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'Not found' });

  const invalid = await fetch(`${baseUrl}/%E0%A4%A`);
  assert.ok([400, 404].includes(invalid.status));
  assert.match(invalid.headers.get('content-type'), /^application\/json/);
  const body = await invalid.json();
  assert.equal(typeof body.error, 'string');
  assert.equal(JSON.stringify(body).includes(root), false);
});

test('exported app loads its catalog independently of the current working directory', async () => {
  const script = `
    const app = require(${JSON.stringify(path.join(root, 'server.js'))});
    const server = app.listen(0, '127.0.0.1', async () => {
      try {
        const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/catalog');
        const catalog = await response.json();
        if (response.status !== 200 || catalog.goods.length !== 8) process.exitCode = 1;
      } catch { process.exitCode = 1; }
      finally { server.close(); }
    });
  `;
  const child = spawn(process.execPath, ['-e', script], { cwd: os.tmpdir(), stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, stderr);
});

test('Vercel app exports the read-only API and leaves public assets to the platform', async () => {
  const script = `
    const assert = require('node:assert/strict');
    const app = require(${JSON.stringify(path.join(root, 'server.js'))});
    const server = app.listen(0, '127.0.0.1', async () => {
      const base = 'http://127.0.0.1:' + server.address().port;
      try {
        const response = await fetch(base + '/api/catalog');
        assert.equal(response.status, 200);
        assert.equal((await response.json()).goods.length, 8);
        for (const pathname of ['/index.html', '/images/logo.png', '/server.js', '/products/data.json']) {
          const hidden = await fetch(base + pathname);
          assert.equal(hidden.status, 404);
          assert.deepEqual(await hidden.json(), { error: 'Not found' });
        }
      } catch (error) { console.error(error); process.exitCode = 1; }
      finally { server.close(); }
    });
  `;
  const child = spawn(process.execPath, ['-e', script], {
    cwd: os.tmpdir(),
    env: { ...process.env, VERCEL: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, stderr);
});
