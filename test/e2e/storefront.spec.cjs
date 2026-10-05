const { test: base, expect } = require('@playwright/test');

const STORAGE_KEY = 'vue-express-shop.cart.v1';
const product = (page, id) => page.locator(`[data-product-id="${id}"]`);
const cart = page => page.getByRole('dialog', { name: 'Shopping Cart' });
const search = page => page.getByRole('dialog', { name: 'Search products' });
const line = (page, id) => cart(page).locator(`[data-item-id="${id}"]`);

// Every page created by the normal test context must finish without an
// uncaught JavaScript error, including the deliberately broken API/storage cases.
const test = base.extend({
  context: async ({ context }, use) => {
    const pageErrors = [];
    context.on('page', page => page.on('pageerror', error => pageErrors.push(error.message)));
    await use(context);
    expect(pageErrors, 'uncaught browser JavaScript errors').toEqual([]);
  },
});

async function loadCatalog(page) {
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(8);
}

async function openCart(page) {
  await page.getByRole('button', { name: /^Open cart,/ }).click();
  await expect(cart(page)).toBeVisible();
}

async function addProduct(page, id) {
  await product(page, id).getByRole('button').click();
  await expect(cart(page)).toBeVisible();
}

async function closeCart(page) {
  await page.getByRole('button', { name: 'Close cart', exact: true }).click();
  await expect(cart(page)).not.toBeVisible();
}

async function runSearch(page, query) {
  await page.getByRole('navigation').getByRole('button', { name: 'Search', exact: true }).click();
  await expect(search(page)).toBeVisible();
  await search(page).getByLabel('Product name').fill(query);
  await search(page).getByRole('button', { name: 'Search', exact: true }).click();
  await expect(search(page)).not.toBeVisible();
}

test('catalog renders all eight products and safely marks the missing price unavailable', async ({ page }) => {
  await loadCatalog(page);
  await expect(product(page, 1)).toContainText('$60.00');
  await expect(product(page, 3)).toContainText('Price unavailable');
  await expect(product(page, 3).getByRole('button')).toBeDisabled();
  await expect(product(page, 5).getByRole('heading')).toHaveText('Unknown Product');
  await expect(product(page, 8).getByRole('img')).toHaveAttribute('src', '/images/product-placeholder.svg');
  await expect(page.getByRole('button', { name: /^Open cart,/ })).toHaveText('Cart (0)');
});

test('search treats malformed regex text literally, clears, and matches Jogger case-insensitively', async ({ page }) => {
  await loadCatalog(page);
  await runSearch(page, '[');
  await expect(page.locator('.product-card')).toHaveCount(0);
  await expect(page.getByText('No products match your search.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show all products' }).click();
  await expect(page.locator('.product-card')).toHaveCount(8);

  await runSearch(page, '  jOgGeR  ');
  await expect(page.locator('.product-card')).toHaveCount(3);
  for (const id of [6, 7, 8]) await expect(product(page, id)).toBeVisible();
  await expect(page.locator('.search-summary')).toContainText('jOgGeR');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(page.locator('.product-card')).toHaveCount(8);
  await expect(page.locator('.search-summary')).toHaveCount(0);
});

test('repeated adds and plus/minus use quantities, then decrementing one removes the item', async ({ page }) => {
  await loadCatalog(page);
  await addProduct(page, 1);
  await expect(line(page, 1).getByRole('status')).toHaveText('1');
  await expect(page.getByTestId('subtotal')).toHaveText('$60.00');
  await closeCart(page);

  await addProduct(page, 1);
  await expect(cart(page).locator('.cart-line')).toHaveCount(1);
  await expect(line(page, 1).getByRole('status')).toHaveText('2');
  await expect(page.getByTestId('subtotal')).toHaveText('$120.00');
  await line(page, 1).getByRole('button', { name: /^Increase quantity/ }).click();
  await expect(line(page, 1).getByRole('status')).toHaveText('3');
  await expect(page.getByTestId('subtotal')).toHaveText('$180.00');
  await line(page, 1).getByRole('button', { name: /^Decrease quantity/ }).click();
  await expect(page.getByTestId('subtotal')).toHaveText('$120.00');
  await line(page, 1).getByRole('button', { name: /^Decrease quantity/ }).click();
  await expect(page.getByTestId('subtotal')).toHaveText('$60.00');
  await line(page, 1).getByRole('button', { name: /^Decrease quantity/ }).click();
  await expect(cart(page).locator('.cart-line')).toHaveCount(0);
  await expect(cart(page)).toContainText('You have no items in your shopping cart.');
  await expect(page.getByTestId('subtotal')).toHaveText('$0.00');
  await closeCart(page);
  await expect(page.getByRole('button', { name: /^Open cart,/ })).toHaveText('Cart (0)');
});

test('decimal prices total exactly, persist on reload, and explicit removal clears a line', async ({ page }) => {
  await loadCatalog(page);
  await addProduct(page, 2);
  await expect(page.getByTestId('subtotal')).toHaveText('$15.95');
  await closeCart(page);
  await addProduct(page, 4);
  await expect(page.getByTestId('subtotal')).toHaveText('$30.90');
  await page.reload();
  await expect(page.getByRole('button', { name: /^Open cart,/ })).toHaveText('Cart (2)');
  await openCart(page);
  await expect(page.getByTestId('subtotal')).toHaveText('$30.90');
  await expect(cart(page).locator('.cart-line')).toHaveCount(2);
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).toEqual([
    { id: 2, count: 1 }, { id: 4, count: 1 },
  ]);
  await line(page, 2).getByRole('button', { name: /^Remove / }).click();
  await expect(line(page, 2)).toHaveCount(0);
  await expect(page.getByTestId('subtotal')).toHaveText('$14.95');
  await line(page, 4).getByRole('button', { name: /^Remove / }).click();
  await expect(page.getByTestId('subtotal')).toHaveText('$0.00');
});

test('separate browser contexts keep their carts private', async ({ page, browser }) => {
  await loadCatalog(page);
  await addProduct(page, 1);
  const otherContext = await browser.newContext();
  const otherErrors = [];
  try {
    const otherPage = await otherContext.newPage();
    otherPage.on('pageerror', error => otherErrors.push(error.message));
    await otherPage.goto(page.url());
    await expect(otherPage.locator('.product-card')).toHaveCount(8);
    await expect(otherPage.getByRole('button', { name: /^Open cart,/ })).toHaveText('Cart (0)');
    await addProduct(otherPage, 4);
    await expect(otherPage.getByTestId('subtotal')).toHaveText('$14.95');
    await expect(page.getByTestId('subtotal')).toHaveText('$60.00');
    await page.reload();
    await openCart(page);
    await expect(page.getByTestId('subtotal')).toHaveText('$60.00');
    expect(otherErrors).toEqual([]);
  } finally {
    await otherContext.close();
  }
});

test('tabs in the same browser synchronize saved cart changes', async ({ page, context }) => {
  await loadCatalog(page);
  const otherPage = await context.newPage();
  await loadCatalog(otherPage);
  await addProduct(page, 2);
  await expect(otherPage.getByRole('button', { name: /^Open cart,/ })).toHaveText('Cart (1)');
  await openCart(otherPage);
  await expect(otherPage.getByTestId('subtotal')).toHaveText('$15.95');
  await line(otherPage, 2).getByRole('button', { name: /^Remove / }).click();
  await expect(page.getByTestId('subtotal')).toHaveText('$0.00');
});

test('malformed saved JSON recovers to an empty usable cart', async ({ page }) => {
  await page.addInitScript(key => localStorage.setItem(key, '[broken-json'), STORAGE_KEY);
  await loadCatalog(page);
  await expect(page.locator('main .storage-warning')).toContainText('Your saved cart could not be loaded');
  await addProduct(page, 1);
  await expect(page.getByTestId('subtotal')).toHaveText('$60.00');
  await expect(page.locator('.storage-warning')).toHaveCount(0);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY)).toEqual([{ id: 1, count: 1 }]);
});

test('unavailable browser storage warns and preserves in-memory cart interactions', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('Storage blocked for this test', 'SecurityError'); },
    });
  });
  await loadCatalog(page);
  await expect(page.locator('main .storage-warning')).toContainText('Browser storage is unavailable');
  await addProduct(page, 1);
  await line(page, 1).getByRole('button', { name: /^Increase quantity/ }).click();
  await expect(page.getByTestId('subtotal')).toHaveText('$120.00');
  await expect(cart(page).locator('.storage-warning')).toContainText('Browser storage is unavailable');
  await page.reload();
  await openCart(page);
  await expect(page.getByTestId('subtotal')).toHaveText('$0.00');
});

test('storage write failures report a warning without losing the active cart', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded for this test', 'QuotaExceededError'); };
  });
  await loadCatalog(page);
  await addProduct(page, 2);
  await expect(page.getByTestId('subtotal')).toHaveText('$15.95');
  await expect(cart(page).locator('.storage-warning')).toContainText('Your browser could not save the cart');
  await line(page, 2).getByRole('button', { name: /^Increase quantity/ }).click();
  await expect(page.getByTestId('subtotal')).toHaveText('$31.90');
});

test('API failure is visible and retry loads the catalog', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/catalog', async route => {
    requests += 1;
    if (requests === 1) await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Unavailable"}' });
    else await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('We could not load the catalog');
  await expect(page.locator('.product-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.product-card')).toHaveCount(8);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(requests).toBe(2);
});

test('malformed API data fails safely with a retry action', async ({ page }) => {
  await page.route('**/api/catalog', route => route.fulfill({ json: { goods: [{ id: 1, available: true, priceCents: 'free' }] } }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('We could not load the catalog');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(0);
});

test('empty catalog has an honest empty state', async ({ page }) => {
  await page.route('**/api/catalog', route => route.fulfill({ json: { goods: [] } }));
  await page.goto('/');
  await expect(page.getByText('No products are available right now.', { exact: true })).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await openCart(page);
  await expect(page.getByTestId('subtotal')).toHaveText('$0.00');
});

test('search and cart close with Escape, backdrop and buttons without adding navigation history', async ({ page }) => {
  await page.goto('/?previous=1');
  await expect(page.locator('.product-card')).toHaveCount(8);
  await loadCatalog(page);
  const originalUrl = page.url();
  const originalHistoryLength = await page.evaluate(() => history.length);

  for (const kind of ['search', 'cart']) {
    const dialog = kind === 'search' ? search(page) : cart(page);
    const opener = kind === 'search'
      ? page.getByRole('navigation').getByRole('button', { name: 'Search', exact: true })
      : page.getByRole('button', { name: /^Open cart,/ });
    await opener.click();
    await expect(dialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
    await opener.click();
    await expect(dialog).toBeVisible();
    await page.mouse.click(1, 1);
    await expect(dialog).not.toBeVisible();
    await opener.click();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: `Close ${kind}`, exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page).toHaveURL(originalUrl);
    expect(await page.evaluate(() => ({ hash: location.hash, length: history.length }))).toEqual({ hash: '', length: originalHistoryLength });
  }

  await page.goBack();
  await expect(page).toHaveURL(/\?previous=1$/);
  await page.goForward();
  await expect(page).toHaveURL(originalUrl);
  await expect(search(page)).not.toBeVisible();
  await expect(cart(page)).not.toBeVisible();
});

test('feedback shows validation errors and valid sample never sends or stores the form', async ({ page }) => {
  await loadCatalog(page);
  const requests = [];
  page.on('request', request => requests.push({ method: request.method(), type: request.resourceType(), url: request.url() }));
  const originalUrl = page.url();
  const storageBefore = await page.evaluate(() => ({ ...localStorage }));
  const form = page.locator('.feedback-form');
  await form.getByRole('button', { name: 'Validate sample' }).click();
  await expect(form.locator('[aria-invalid="true"]')).toHaveCount(3);
  await expect(form.getByLabel('Name', { exact: true })).toBeFocused();
  await expect(page.locator('#name-error')).toBeVisible();
  await expect(page.locator('#email-error')).toBeVisible();
  await expect(page.locator('#phone-error')).toBeVisible();
  await form.getByLabel('Name', { exact: true }).fill("Alex O'Neil");
  await form.getByLabel('Email', { exact: true }).fill('alex@example.com');
  await form.getByLabel('Phone number', { exact: true }).fill('+7(000)000-0000');
  await form.getByLabel('Message (optional)').fill('Sample feedback for client-side validation only.');
  await form.getByRole('button', { name: 'Validate sample' }).click();
  await expect(form.getByRole('status')).toHaveText('Validation passed. This demo did not send your message.');
  await expect(form.locator('[aria-invalid="true"]')).toHaveCount(0);
  await form.getByRole('button', { name: 'Validate sample' }).click();
  await expect(form.getByRole('status')).toBeVisible();
  await expect(page).toHaveURL(originalUrl);
  expect(requests.filter(request => !['GET', 'HEAD'].includes(request.method))).toEqual([]);
  expect(requests.filter(request => ['document', 'fetch', 'xhr'].includes(request.type))).toEqual([]);
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storageBefore);
  await form.getByLabel('Email', { exact: true }).fill('invalid-address');
  await expect(form.getByRole('status')).toHaveCount(0);
  await form.getByRole('button', { name: 'Validate sample' }).click();
  await expect(page.locator('#email-error')).toBeVisible();
  await expect(form.locator('[aria-invalid="true"]')).toHaveCount(1);
});

test('catalog and cart fit the viewport and produce review screenshots', async ({ page }, testInfo) => {
  await loadCatalog(page);
  await page.locator('footer').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const catalogScreenshot = testInfo.outputPath('catalog.png');
  await page.screenshot({ path: catalogScreenshot, fullPage: true, animations: 'disabled' });
  await testInfo.attach('Catalog', { path: catalogScreenshot, contentType: 'image/png' });
  await addProduct(page, 1);
  const bounds = await cart(page).boundingBox();
  const viewport = page.viewportSize();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  await expect(page.getByRole('button', { name: 'Continue shopping' })).toBeVisible();
  const cartScreenshot = testInfo.outputPath('cart.png');
  await page.screenshot({ path: cartScreenshot, animations: 'disabled' });
  await testInfo.attach('Cart', { path: cartScreenshot, contentType: 'image/png' });
});
