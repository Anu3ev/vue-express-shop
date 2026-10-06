# Vue Express Shop

**An educational storefront built with Vue and an Express catalog API.**

The demo is branded **Super Expensive Shop**. It started as JavaScript coursework in 2021. The original layout and sample catalog are retained, while the runtime, cart behavior, error states and deployment setup have been refreshed.

## Features

- Browse eight sample products with local images and clear fallbacks.
- Search product titles with case-insensitive, literal text, including punctuation.
- Add products to a cart, increase or decrease quantities, remove items, and see exact cent-based totals.
- Keep a separate cart in each visitor's browser across reloads; synchronize changes between tabs.
- Recover from an invalid saved cart or unavailable browser storage without breaking the page.
- Retry failed catalog requests and distinguish loading, empty and search-no-results states.
- Try a labeled, accessible feedback-validation exercise. It never sends or stores messages.
- Use keyboard-accessible cart and search dialogs on desktop or mobile.

A product without a price is marked unavailable. Missing prices are never silently replaced with an invented amount. Quantities are capped at 99 per product.

## Stack

- **Frontend:** Vue 3, JavaScript, HTML and CSS
- **Backend:** Node.js 24 and Express 5
- **Catalog:** bundled, read-only JSON data
- **Cart:** browser `localStorage`, storing only product IDs and quantities
- **Tests:** Node's test runner and Playwright

The frontend has no bundler. A small build script copies the pinned Vue production runtime and its license into `public/vendor/`. All assets required by the shop are served locally, with no CDN dependency. The original compiled stylesheet is retained; current UI overrides live in `public/styles/app.css`.

## Run locally

Requirements: Git, Node.js 24 and npm. `.nvmrc` selects Node 24 when using nvm.

```bash
git clone https://github.com/Anu3ev/vue-express-shop.git
cd vue-express-shop
npm ci
npm start
```

Open **http://localhost:5500**. `npm start` prepares browser assets automatically. Use `PORT=3000 npm start` to choose another port on macOS/Linux, or set `$env:PORT=3000` before `npm start` in PowerShell.

```bash
npm run dev       # Build assets and restart the server when source files change
npm run build     # Copy the pinned Vue browser runtime into public/vendor
npm run check     # JavaScript syntax, unit/API tests, and asset build
npm run test:e2e  # Desktop and mobile browser tests
```

Before the first browser test run:

```bash
npx playwright install chromium
```

On a minimal Linux machine, `npx playwright install --with-deps chromium` also installs browser system dependencies and may need administrator access. CI uses this command.

`npm run dev` watches the Node server; refresh the browser after frontend edits. Opening `index.html` directly or using a static-only server will not provide the catalog API.

### Try the demo

1. Add a product, increase its quantity and decrease it back to one.
2. Close the cart and refresh. Your cart should still be present in the same browser.
3. Decrease a quantity from one to remove that item, or use **Remove**.
4. Search for `Jogger`, then try `[` and clear the search. Punctuation is ordinary text.
5. Press Escape to close a dialog and reopen it from the header.
6. Submit empty or invalid sample feedback fields, then enter valid sample values. No network request sends the form.

To reset the cart, remove its items in the UI or delete the `vue-express-shop.cart.v1` local-storage key using your browser's developer tools. Clearing site data also clears it.

## Architecture

```text
Browser                              Express / Vercel Function
  Vue UI ─── GET /api/catalog ───────► bundled products/data.json
  Cart IDs + quantities                read-only catalog response
    └── localStorage
  Totals derived from catalog prices
```

Express never accepts prices or writes cart data. Each browser has its own demo cart, avoiding shared-user state, concurrent file writes and dependence on a persistent server filesystem. Serverless instances can restart without losing the visitor's saved cart.

Prices and line totals are derived from the catalog in integer cents. Saved carts are checked against currently available products, unknown IDs and invalid counts are discarded, and duplicate entries are combined within the quantity limit. This is a display-only demo; a real checkout must validate pricing and stock again on the server.

### API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` / `HEAD` | `/api/catalog` | Return `{ "goods": [...] }` with normalized product records |
| `GET` / `HEAD` | `/catalogData` | Compatibility alias for the original catalog URL |

Other methods on catalog endpoints return JSON `405`. Unknown routes and the old shared-cart endpoints return JSON `404`. The previous `/cartItems`, `/addToCart`, `/removeItem` and `/totalPrice` API is intentionally removed.

### Structure

```text
public/
  index.html              # Page shell and root Vue bindings
  scripts.js              # Vue components, dialogs, loading and feedback states
  cart.js                 # Pure cart/search/persistence helpers
  images/                 # Original logo/product photos and local fallback
  styles/main.css         # Original compiled coursework stylesheet
  styles/app.css          # Maintained responsive/accessibility overrides
  vendor/                 # Generated Vue runtime; not committed
lib/catalog.cjs           # Safe catalog normalization
server.js                 # Read-only API; local public/ static server
products/data.json        # Original sample catalog
docs/product-sources.txt  # Retained links to the sample product sources
sass/                     # Historical SCSS sources for main.css
tools/build.cjs           # Reproducible local vendor-asset build
test/                     # Unit/API and browser tests
vercel.json               # Express deployment and response headers
```

Only `public/` is web-accessible. Source files, catalog source, package manifests, dependencies and Git metadata are not static web content. `node_modules/` and generated files are ignored rather than committed. Historical commits and coursework branches remain unchanged.

## Deploy on Vercel

The project follows [Vercel's Express support](https://vercel.com/docs/frameworks/backend/express): the root `server.js` exports the application, and `public/` assets are served by Vercel's CDN. No database, secret or environment variable is required for the demo.

1. Import this GitHub repository into your Vercel account.
2. Use the **Express** framework preset, repository root, Node.js **24.x**, and build command **`npm run build`**. Leave Output Directory at its framework default.
3. Deploy a preview from the proposed change branch before promoting or merging it.
4. Check `/`, `/api/catalog`, a product image, and the add/search/reload flows on the deployed URL. `/server.js`, `/package.json` and `/products/data.json` must return `404`.

Authentication, the project/team choice and any GitHub integration permissions must be approved by the account owner. No deployment URL is claimed here until a real deployment is verified. Use a suitable free account/plan if eligible; this project does not require purchasing infrastructure.

## Test coverage

`npm test` covers catalog normalization, unavailable/malformed prices, integer-cent totals, cart operations, invalid storage, literal search, read-only API behavior, source-file isolation and serverless/CWD-independent module loading.

Playwright covers the browser flows on desktop and mobile, including repeat clicks, persistence/isolation, failure recovery, unavailable storage, dialogs and feedback validation. CI performs a clean install, the application checks and browser tests. A green test run is evidence for those scenarios, not a claim of production ecommerce readiness.

## Scope and limitations

- This is a portfolio/coursework demo. There are no accounts, checkout, payments, inventory reservations or order processing.
- Cart storage is local to this site in one browser. It does not sync between devices, and private browsing or clearing site data can remove it. If storage is blocked, the cart remains in memory for the current page.
- Concurrent changes from different tabs use the browser's last-write-wins behavior; this is not a transactional order system.
- Feedback is a client-side validation exercise with the original Russian phone format. Use sample details, not real personal data.
- Product descriptions and photos are retained sample coursework assets, not a live store inventory. Review any third-party asset rights before reuse outside this demo.
- `sass/` is historical source for the original checked-in stylesheet. Current maintained overrides are plain CSS; there is no Sass compilation task.

## Project history

The original repository name was `js_level2`. The `lesson3`, `lesson4`, `lesson5-6` and `lesson7` branches preserve stages of the coursework. The original implementation used Vue 2, Express 4, a shared JSON-file cart and external CDN assets; those runtime limitations are replaced in this refresh.

## License

Original project code is licensed under the [MIT License](LICENSE).

Third-party code and assets retain their respective licenses and notices. Product photos and other sample coursework assets are not covered by this MIT grant unless separately stated; their reuse rights have not been verified. Source links are retained in [docs/product-sources.txt](docs/product-sources.txt). Vue's MIT license is included alongside its generated runtime.
