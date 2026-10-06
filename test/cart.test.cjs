const { test } = require('node:test');
const assert = require('node:assert/strict');
const Cart = require('../public/cart.js');
const goods = [
  { id: 1, title: 'Tee', priceCents: 1595, available: true },
  { id: 2, title: 'Jogger', priceCents: 1495, available: true },
  { id: 3, title: 'No price', priceCents: null, available: false },
];

test('empty cart has a deterministic zero subtotal', () => {
  assert.deepEqual(Cart.summarize([], goods), { lines: [], count: 0, totalCents: 0 });
});

test('add, repeat, decrease and remove at zero are deterministic and immutable', () => {
  const original = [];
  let cart = Cart.changeQuantity(original, goods, 1, 1);
  cart = Cart.changeQuantity(cart, goods, 1, 1);
  assert.deepEqual(cart, [{ id: 1, count: 2 }]);
  assert.deepEqual(original, []);
  cart = Cart.changeQuantity(cart, goods, 1, -1);
  assert.deepEqual(cart, [{ id: 1, count: 1 }]);
  assert.deepEqual(Cart.changeQuantity(cart, goods, 1, -1), []);
  assert.deepEqual(Cart.changeQuantity([], goods, 1, -1), []);
});

test('prices and totals come from the catalog, in integer cents', () => {
  const result = Cart.summarize([{ id: 1, count: 3, priceCents: 1, title: 'Forged' }, { id: 2, count: 1 }], goods);
  assert.equal(result.totalCents, 6280);
  assert.equal(result.count, 4);
  assert.equal(result.lines[0].title, 'Tee');
  assert.equal(result.lines[0].lineCents, 4785);
});

test('invalid, unknown, unavailable and excessive stored values are sanitized', () => {
  const values = [null, 'bad', { id: 999, count: 1 }, { id: 3, count: 1 }, { id: 1, count: -2 }, { id: '1', count: 2 }, { id: 2, count: 1.5 }, { id: 2, count: Infinity }, { id: 1, count: 2 }, { id: 1, count: 1000 }];
  assert.deepEqual(Cart.normalizeCart(values, goods), [{ id: 1, count: 99 }]);
  for (const value of [null, {}, true, 4, '[]']) assert.deepEqual(Cart.normalizeCart(value, goods), []);
  assert.deepEqual(Cart.changeQuantity([], goods, 3, 1), []);
  assert.deepEqual(Cart.changeQuantity([], goods, 1, 500), []);
});

test('repeated clicks cannot exceed quantity limit', () => {
  let cart = [];
  for (let i = 0; i < 120; i++) cart = Cart.changeQuantity(cart, goods, 1, 1);
  assert.deepEqual(cart, [{ id: 1, count: 99 }]);
});

test('search is case-insensitive literal text and handles regex punctuation', () => {
  assert.deepEqual(Cart.searchGoods(goods, ' JOG '), [goods[1]]);
  assert.deepEqual(Cart.searchGoods(goods, ''), goods);
  for (const value of ['[', '(', '.*', '\\', '(a+)+$']) assert.deepEqual(Cart.searchGoods(goods, value), []);
});

test('storage retains only ids and counts; invalid JSON does not crash', () => {
  const storage = { raw: null, getItem() { return this.raw; }, setItem(key, value) { assert.equal(key, Cart.STORAGE_KEY); this.raw = value; } };
  assert.deepEqual(Cart.readCart(storage, goods), { cart: [], warning: '' });
  assert.equal(Cart.writeCart(storage, [{ id: 1, count: 2, priceCents: 99 }]), '');
  assert.equal(storage.raw, '[{"id":1,"count":2}]');
  assert.deepEqual(Cart.readCart(storage, goods).cart, [{ id: 1, count: 2 }]);
  storage.raw = '{';
  assert.deepEqual(Cart.readCart(storage, goods).cart, []);
  assert.match(Cart.readCart(storage, goods).warning, /could not be loaded/);
});

test('blocked or full storage returns a useful warning', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('full'); } };
  assert.match(Cart.readCart(blocked, goods).warning, /could not be loaded/);
  assert.match(Cart.writeCart(blocked, []), /could not save/);
});
