'use strict';

const PLACEHOLDER_IMAGE = '/images/product-placeholder.svg';

function normalizeImage(value) {
  if (typeof value !== 'string') return PLACEHOLDER_IMAGE;

  const image = value.trim();
  const localImage = /^\/?images\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]+\.(?:avif|gif|jpe?g|png|svg|webp)$/i;
  if (!localImage.test(image) || image.split('/').includes('..')) {
    return PLACEHOLDER_IMAGE;
  }

  return image.startsWith('/') ? image : `/${image}`;
}

function toPriceCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;

  // Shift the decimal before rounding, avoiding values such as 1.005 being
  // rounded down by a floating-point multiplication. Exponents remain valid.
  const [coefficient, exponent = '0'] = String(value).split('e');
  const cents = Math.round(Number(`${coefficient}e${Number(exponent) + 2}`));
  return Number.isSafeInteger(cents) ? cents : null;
}

function normalizeProduct(product) {
  if (!product || typeof product !== 'object' || !Number.isSafeInteger(product.id) || product.id < 1) {
    return null;
  }

  const priceCents = toPriceCents(product.salePrice);
  return Object.freeze({
    id: product.id,
    title: typeof product.title === 'string' && product.title.trim()
      ? product.title.trim()
      : 'Unknown Product',
    salePrice: priceCents === null ? null : priceCents / 100,
    priceCents,
    img: normalizeImage(product.img),
    available: priceCents !== null,
  });
}

function normalizeCatalog(source) {
  const seenIds = new Set();
  const products = Array.isArray(source?.goods) ? source.goods : [];
  const goods = products.map(normalizeProduct).filter((product) => {
    if (!product || seenIds.has(product.id)) return false;
    seenIds.add(product.id);
    return true;
  });

  return Object.freeze({ goods: Object.freeze(goods) });
}

module.exports = { normalizeCatalog, normalizeProduct };
