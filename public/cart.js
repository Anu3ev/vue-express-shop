/* Cart rules and storage adapters shared by the browser and Node's test runner. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
    return;
  }

  root.ShopCart = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const STORAGE_KEY = 'vue-express-shop.cart.v1';
  const MAX_QUANTITY = 99;

  function normalizeCart(value, goods) {
    if (!Array.isArray(value)) return [];
    const availableGoods = goods.filter(good => {
      if (!good.available) return false;

      return Number.isSafeInteger(good.priceCents) && good.priceCents >= 0;
    });
    const available = new Set(availableGoods.map(good => good.id));
    const counts = new Map();
    for (const item of value.slice(0, 1000)) {
      if (!item || !Number.isSafeInteger(item.id) || !available.has(item.id)) continue;
      if (!Number.isSafeInteger(item.count) || item.count < 1) continue;
      counts.set(item.id, Math.min(MAX_QUANTITY, (counts.get(item.id) || 0) + item.count));
    }
    return [...counts].map(([id, count]) => ({ id, count }));
  }

  function changeQuantity(cart, goods, id, delta) {
    const next = normalizeCart(cart, goods);
    if (!Number.isSafeInteger(id) || (delta !== 1 && delta !== -1)) return next;
    const good = goods.find(item => item.id === id && item.available);
    if (!good) return next;
    const item = next.find(item => item.id === id);
    if (!item && delta === 1) {
      next.push({ id, count: 1 });
    } else if (item) {
      item.count = Math.min(MAX_QUANTITY, item.count + delta);
    }
    return normalizeCart(next, goods);
  }

  function summarize(cart, goods) {
    const lines = normalizeCart(cart, goods).map(item => {
      const good = goods.find(good => good.id === item.id);
      return { ...good, count: item.count, lineCents: good.priceCents * item.count };
    });
    return {
      lines,
      count: lines.reduce((sum, item) => sum + item.count, 0),
      totalCents: lines.reduce((sum, item) => sum + item.lineCents, 0),
    };
  }

  function searchGoods(goods, query) {
    const term = String(query || '').trim().toLocaleLowerCase('en');
    return goods.filter(good => good.title.toLocaleLowerCase('en').includes(term));
  }

  function readCart(storage, goods) {
    try {
      const raw = storage.getItem(STORAGE_KEY);
      const savedCart = raw ? JSON.parse(raw) : [];
      return { cart: normalizeCart(savedCart, goods), warning: '' };
    } catch {
      return { cart: [], warning: 'Your saved cart could not be loaded. You can start a new cart.' };
    }
  }

  function writeCart(storage, cart) {
    try {
      const savedItems = cart.map(({ id, count }) => ({ id, count }));
      storage.setItem(STORAGE_KEY, JSON.stringify(savedItems));
      return '';
    } catch {
      return 'Your browser could not save the cart. It will last only until this page is closed.';
    }
  }

  return { STORAGE_KEY, MAX_QUANTITY, normalizeCart, changeQuantity, summarize, searchGoods, readCart, writeCart };
});
