# Vue Express Shop

**A small educational storefront built with Vue 2 and Express.**

The demo is branded **Super Expensive Shop** and combines a clothing catalog, product search, a shopping cart, and a feedback-form validation exercise. It was developed as JavaScript coursework in 2021 and shows how browser components communicate with a simple Node.js API.

## Features

- Browse eight sample products with images and prices.
- Search product titles using a case-insensitive regular expression.
- Add products to a slide-out cart, increase or decrease quantities, and view line totals and a subtotal.
- Remove a product by decreasing its quantity from one.
- Store the shared cart in local JSON files and record cart actions in an activity log.
- Validate name, email, and phone fields in the browser. The feedback form does not submit messages.
- Explore fallback values for missing product titles, images, and prices in the sample data.

## Tech stack

- **Frontend:** Vue 2 loaded from a CDN, JavaScript, HTML, CSS, and SCSS sources
- **Backend:** Node.js, Express 4, and `body-parser`
- **Storage:** JSON files accessed through Node's `fs` module
- **UI assets:** local product images and logo; Font Awesome 4.7 loaded from a CDN

There is no frontend bundler or build step. The browser loads `scripts.js` and the checked-in `styles/main.css` directly.

## Run locally

### Requirements

- Git, Node.js, and npm
- A browser with internet access for Vue and Font Awesome
- A writable checkout: cart requests modify JSON files in the repository root

The repository does not pin a Node.js or npm version. Its lockfile contains the original Express 4.17.1 dependency tree.

```bash
git clone https://github.com/Anu3ev/js_level2.git
cd js_level2
npm ci
node server.js
```

Open **http://localhost:5500**.

Run the server from the repository root because its file paths are relative to the working directory. The port is hard-coded to `5500` in `server.js`. Stop the server with `Ctrl+C`.

Opening `index.html` directly or using a static-only server will not provide the catalog and cart API. The existing compiled CSS is sufficient to run the demo; a Sass compiler and stylesheet build command are not configured in `package.json`.

### Try the demo

1. Add a product to the cart and use its `+` and `-` buttons.
2. Refresh the page to load the saved cart from the server.
3. Search for `Jogger`; submit an empty search to show all products again.
4. Enter invalid feedback-form values to see the validation messages. The phone field expects a format such as `+7(000)000-0000`.

## Project structure

```text
.
├── index.html          # Page shell and CDN dependencies
├── scripts.js          # Vue components, event bus, and HTTP helpers
├── server.js           # Static server, API routes, and file persistence
├── products/
│   └── data.json       # Sample catalog
├── images/             # Logo, favicon, and product photos
├── sass/               # SCSS source files
├── styles/
│   └── main.css        # Stylesheet loaded by the page
├── cart.json           # Shared cart, initially []
├── stats.json          # Cart action log, initially []
├── totalPrice.json     # Stored subtotal array, initially [0]
├── package.json
├── package-lock.json
└── LICENSE
```

The repository also contains a checked-in `node_modules/` directory.

## How it works

The root Vue instance renders the header, main content, and footer. `shopMain` loads catalog and cart data and owns the main application state. Product, search, and cart components communicate through a shared Vue event bus.

HTTP helpers wrap `XMLHttpRequest` in promises. Express serves the frontend and handles catalog and cart requests. Cart changes recalculate item totals and write the updated cart to disk; action records are appended to `stats.json`.

### API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/catalogData` | Return the catalog as an object with a `goods` array |
| `GET` | `/cartItems` | Read the cart, recalculate line totals, write it back, and return it |
| `POST` | `/addToCart` | Add a product or change an existing product's quantity |
| `POST` | `/removeItem` | Remove a product by its `id` and return the updated cart |
| `GET` | `/totalPrice` | Write and return the current in-memory subtotal as a one-element array |

POST requests use JSON bodies. `/addToCart` receives a product object; for existing items, `mathOperation: "plus"` increases the quantity and the other branch decreases it. `/removeItem` uses the product's `id` and `title` for removal and logging. The frontend supplies these requests.

The subtotal is calculated when cart data is read or changed. Calling `/totalPrice` before a cart operation can return `[null]` because the in-memory value has not been initialized.

## Scope and limitations

This is a learning project. Keep it in a trusted local environment.

- **One shared cart:** there are no user accounts, sessions, checkout, payments, or order processing.
- **Demo controls:** category, account, and several footer links are placeholders. The feedback form only demonstrates client-side validation.
- **Basic persistence:** JSON writes have no transaction or concurrency protection. Error handling is incomplete, and activity timestamps can be missing or lag behind an action.
- **No production safeguards:** the API trusts client-supplied product data, prices, and quantities. Express exposes the project root as static content, including data and source files.
- **Search edge cases:** the query is passed directly to `RegExp`; malformed expressions can cause an error.
- **External assets:** Vue, icon styles, and the missing-image placeholder depend on third-party services.
- **Legacy dependencies:** the project uses Vue 2 and a 2021 server dependency lockfile. Review and update dependencies before extending or deploying it.

To reset a local demo, stop the server and back up any data you want to keep. Set `cart.json` and `stats.json` to `[]`, set `totalPrice.json` to `[0]`, then restart the server. This clears the saved cart and action history.

## Tests and tooling

There is no application test suite or lint configuration. `npm test` runs the default placeholder command and exits with an error. No `start`, `dev`, or `build` scripts are defined; start the application with `node server.js`.

## Project history

The original repository name is `js_level2`. The `lesson3`, `lesson4`, `lesson5-6`, and `lesson7` branches preserve stages of the coursework. The `master` branch contains the Vue frontend and Express backend described here.

## License

The license declarations currently conflict: [`LICENSE`](LICENSE) contains the GNU General Public License v3.0 text, while [`package.json`](package.json) declares `ISC`. The intended license needs clarification by the maintainer.
