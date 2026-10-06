# Vue Express Shop

A small storefront built with Vue 3, Vite and Express. Browse the catalog, search products and manage a cart that stays in your browser after a reload.

## Features

- Eight sample products with images and availability
- Product search and cart quantities with exact totals
- Browser-local cart persistence and synchronization between tabs
- Responsive, keyboard-accessible dialogs
- Loading, empty and error states with retry
- Client-side feedback form validation

This is an educational demo: there are no accounts, checkout, payments or order processing. The feedback form does not send messages.

## Run locally

Requires Node.js 24 and npm.

```bash
npm ci
npm run dev
```

Open http://localhost:5173. Vite serves the frontend with hot reload; Express serves the catalog API.

To run the production build locally:

```bash
npm start
```

Open http://localhost:5500. This builds the frontend and starts Express with the generated site.

## Commands

```bash
npm run dev       # Frontend and API development servers
npm run build     # Production frontend in dist/
npm start         # Build and serve the complete app
npm run check     # Build, syntax and unit/API/component checks
npm run test:e2e  # Desktop and mobile browser tests
```

Before running browser tests for the first time:

```bash
npx playwright install chromium
```

## Deploy

Import the repository into Vercel. Build settings are included in `vercel.json`: Vite, `npm run build`, and `dist` output. The Express catalog is deployed as a Node.js function alongside the frontend. No database, secrets or additional services are required.

## About the demo

The original 2021 coursework layout and sample products are retained. Cart data is stored only in the visitor's browser; the catalog is read-only. Products without a price are unavailable. Historical lesson branches remain in the repository.

## License

Original code is released under the [MIT License](LICENSE). Bundled dependency licenses are included in the build. Product photos and other third-party materials retain their original rights.
