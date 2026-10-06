'use strict';

const path = require('node:path');
const express = require('express');
const { normalizeCatalog } = require('./lib/catalog.cjs');
const sourceCatalog = require('./products/data.json');

const app = express();
const catalog = normalizeCatalog(sourceCatalog);

app.disable('x-powered-by');
app.set('json escape', true);

// The API never accepts cart data or client-provided prices. Carts belong to
// each browser; the server only publishes this bundled, read-only catalog.
for (const route of ['/api/catalog', '/catalogData']) {
  app.get(route, (request, response) => {
    response.json(catalog);
  });

  app.all(route, (request, response) => {
    response.set('Allow', 'GET, HEAD').status(405).json({
      error: 'Method not allowed',
    });
  });
}

// Vercel serves public/ directly. Local Express must never expose the repo
// root, catalog source, dependencies, or obsolete shared-cart files.
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, 'public'), {
    dotfiles: 'ignore',
    index: 'index.html',
  }));
}

app.use((request, response) => {
  response.status(404).json({ error: 'Not found' });
});

app.use((error, request, response, next) => {
  if (response.headersSent) return next(error);

  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;

  response.status(status).json({
    error: status >= 500 ? 'Internal server error' : 'Bad request',
  });
});

// Exporting the app lets Vercel own the listener and lets tests bind a random
// available port. Running `node server.js` still starts the local demo.
module.exports = app;

if (require.main === module) {
  const port = Number(process.env.PORT || 5500);
  app.listen(port, () => {
    console.log(`Shop available at http://localhost:${port}`);
  });
}
