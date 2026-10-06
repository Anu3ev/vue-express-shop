<script>
import ProductCard from './components/ProductCard.vue';
import FeedbackForm from './components/FeedbackForm.vue';
import * as ShopCart from './lib/cart.js';
import { money, imageFallback } from './lib/display.js';

export default {
  components: { ProductCard, FeedbackForm },
  data: () => ({
    goods: [],
    cart: [],
    query: '',
    searchDraft: '',
    loading: true,
    loadError: '',
    storageWarning: '',
    maxQuantity: ShopCart.MAX_QUANTITY,
  }),
  computed: {
    filteredGoods() {
      return ShopCart.searchGoods(this.goods, this.query);
    },
    summary() {
      return ShopCart.summarize(this.cart, this.goods);
    },
  },
  created() {
    // Request resources belong to this component, not reactive or saved state.
    this.catalogController = null;
    this.catalogTimeout = null;
  },
  mounted() {
    this.loadCatalog();
    window.addEventListener('storage', this.syncCart);
  },
  beforeUnmount() {
    window.removeEventListener('storage', this.syncCart);
    this.catalogController?.abort();
    this.catalogController = null;
    clearTimeout(this.catalogTimeout);
    this.catalogTimeout = null;
  },
  methods: {
    money,
    imageFallback,
    async loadCatalog() {
      if (this.catalogController) return;

      const controller = new AbortController();
      this.catalogController = controller;
      this.catalogTimeout = setTimeout(() => controller.abort(), 10000);
      this.loading = true;
      this.loadError = '';

      try {
        const response = await fetch('/api/catalog', { signal: controller.signal });
        if (!response.ok) throw new Error('Catalog request failed');

        const data = await response.json();
        if (!Array.isArray(data?.goods)) throw new Error('Invalid catalog');

        const validProducts = data.goods.every(good => {
          if (!good || !Number.isSafeInteger(good.id)) return false;
          if (typeof good.title !== 'string' || typeof good.img !== 'string') return false;
          if (typeof good.available !== 'boolean') return false;
          if (!good.available) return true;

          return Number.isSafeInteger(good.priceCents) && good.priceCents >= 0;
        });
        if (!validProducts) throw new Error('Invalid catalog');
        if (this.catalogController !== controller) return;

        this.goods = data.goods;
        this.restoreCart();
      } catch {
        // Unmount cancels silently; a timeout still needs a retry message.
        if (this.catalogController !== controller) return;

        this.loadError = 'We could not load the catalog. Check your connection and try again.';
      } finally {
        if (this.catalogController === controller) {
          clearTimeout(this.catalogTimeout);
          this.catalogTimeout = null;
          this.catalogController = null;
          this.loading = false;
        }
      }
    },
    restoreCart() {
      try {
        const saved = ShopCart.readCart(window.localStorage, this.goods);
        this.cart = saved.cart;
        this.storageWarning = saved.warning;
      } catch {
        this.storageWarning = 'Browser storage is unavailable. Your cart will last only until this page is closed.';
      }
    },
    syncCart(event) {
      if (this.loading || this.loadError) return;
      if (event.key !== ShopCart.STORAGE_KEY && event.key !== null) return;

      this.restoreCart();
    },
    saveCart() {
      try {
        this.storageWarning = ShopCart.writeCart(window.localStorage, this.cart);
      } catch {
        this.storageWarning = 'Browser storage is unavailable. Your cart will last only until this page is closed.';
      }
    },
    changeCount(id, delta) {
      this.cart = ShopCart.changeQuantity(this.cart, this.goods, id, delta);
      this.saveCart();
    },
    addToCart(id) {
      this.changeCount(id, 1);
      this.openDialog('cart');
    },
    removeItem(id) {
      this.cart = this.cart.filter(item => item.id !== id);
      this.saveCart();
    },
    openDialog(name) {
      for (const key of ['cart', 'search']) {
        if (key !== name && this.$refs[key].open) this.$refs[key].close();
      }
      if (name === 'search') this.searchDraft = this.query;
      if (this.$refs[name].open) return;

      this.$refs[name].showModal();
    },
    closeDialog(name) {
      this.$refs[name].close();
    },
    closeOnBackdrop(event, name) {
      if (event.target !== this.$refs[name]) return;

      const bounds = event.target.getBoundingClientRect();
      const outsideHorizontally = event.clientX < bounds.left || event.clientX > bounds.right;
      const outsideVertically = event.clientY < bounds.top || event.clientY > bounds.bottom;
      if (outsideHorizontally || outsideVertically) this.closeDialog(name);
    },
    submitSearch() {
      this.query = this.searchDraft.trim();
      this.closeDialog('search');
    },
    clearSearch() {
      this.query = '';
      this.searchDraft = '';
    },
  },
};
</script>

<template>
  <div
    id="shop"
  >
    <header class="shop-header container">
      <a
        class="shop-logo"
        href="/"
        aria-label="Super Expensive Shop home"
      >
        <img
          src="/images/logo.png"
          alt="Super Expensive Shop"
          width="905"
          height="725"
        />
      </a>
      <nav
        class="shop-actions"
        aria-label="Shop navigation"
      >
        <a href="#catalog">Catalog</a>
        <button
          type="button"
          class="text-button"
          @click="openDialog('search')"
        >
          Search
        </button>
        <button
          type="button"
          class="text-button"
          @click="openDialog('cart')"
          :aria-label="'Open cart, ' + summary.count + ' items'"
        >
          Cart ({{ summary.count }})
        </button>
      </nav>
    </header>
    <main class="container pallette_1">
      <p class="demo-note">
        Storefront demo · No checkout or payments · Your cart stays in this
        browser
      </p>
      <section
        id="catalog"
        aria-labelledby="catalog-title"
        :aria-busy="loading"
      >
        <div class="catalog-heading">
          <h1
            id="catalog-title"
            class="h1-like fw-400"
          >
            Catalog
          </h1>
          <div
            v-if="query"
            class="search-summary"
          >
            Search: “{{ query }}”
            <button
              type="button"
              class="text-button"
              @click="clearSearch"
            >
              Clear search
            </button>
          </div>
        </div>
        <p
          v-if="loading"
          role="status"
          class="state-message"
        >
          Loading products…
        </p>
        <div
          v-else-if="loadError"
          role="alert"
          class="state-message error-state"
        >
          <p>{{ loadError }}</p>
          <button
            type="button"
            class="bttn-reg c_button"
            @click="loadCatalog"
          >
            Try again
          </button>
        </div>
        <template v-else>
          <div
            v-if="filteredGoods.length"
            class="goods-list row is-grid"
          >
            <product-card
              v-for="good in filteredGoods"
              :key="good.id"
              :good="good"
              @add="addToCart"
            ></product-card>
          </div>
          <div
            v-else
            class="state-message"
            role="status"
          >
            <p v-if="query">No products match your search.</p>
            <p v-else>No products are available right now.</p>
            <button
              v-if="query"
              type="button"
              class="text-button"
              @click="clearSearch"
            >
              Show all products
            </button>
          </div>
        </template>
      </section>
      <p
        v-if="storageWarning"
        role="status"
        class="storage-warning"
      >
        {{ storageWarning }}
      </p>
      <feedback-form></feedback-form>
    </main>
    <footer class="shop-footer pallette_2">
      <img
        src="/images/logo.png"
        alt="Super Expensive Shop"
        class="footer-logo"
        width="905"
        height="725"
      />
      <p>
        Educational project by
        <a href="https://github.com/Anu3ev/vue-express-shop">Anu3ev</a>
      </p>
      <p>
        <a href="#catalog">Catalog</a>
        ·
        <a href="#feedback">Feedback validation demo</a>
      </p>
    </footer>

    <dialog
      ref="search"
      class="shop-dialog search-dialog"
      aria-labelledby="search-title"
      @click="closeOnBackdrop($event, 'search')"
    >
      <div class="dialog-heading">
        <h2 id="search-title">Search products</h2>
        <button
          type="button"
          class="text-button"
          aria-label="Close search"
          @click="closeDialog('search')"
        >
          Close
        </button>
      </div>
      <form
        class="search-form"
        @submit.prevent="submitSearch"
      >
        <label for="product-search">Product name</label>
        <input
          id="product-search"
          v-model="searchDraft"
          type="search"
          maxlength="200"
          autocomplete="off"
          placeholder="Try Jogger"
          autofocus
        />
        <button
          class="bttn-reg c_button"
          type="submit"
        >
          Search
        </button>
      </form>
    </dialog>

    <dialog
      ref="cart"
      class="shop-dialog cart-dialog"
      aria-labelledby="cart-title"
      @click="closeOnBackdrop($event, 'cart')"
    >
      <div class="dialog-heading">
        <h2 id="cart-title">Shopping Cart</h2>
        <button
          type="button"
          class="text-button"
          aria-label="Close cart"
          @click="closeDialog('cart')"
        >
          Close
        </button>
      </div>
      <p class="demo-note">
        Saved on this device. Demo only; no orders are placed.
      </p>
      <p
        v-if="storageWarning"
        role="status"
        class="storage-warning"
      >
        {{ storageWarning }}
      </p>
      <p
        v-if="!summary.lines.length"
        class="state-message"
      >
        You have no items in your shopping cart.
      </p>
      <ul
        v-else
        class="cart-lines no-list-style no-pad"
      >
        <li
          v-for="item in summary.lines"
          :key="item.id"
          class="cart-line"
          :data-item-id="item.id"
        >
          <img
            :src="item.img"
            :alt="item.title"
            width="75"
            height="100"
            @error="imageFallback"
          />
          <div class="cart-line-content">
            <h3>{{ item.title }}</h3>
            <p>{{ money(item.priceCents) }} each</p>
            <div class="cart-quantity">
              <button
                type="button"
                :aria-label="'Decrease quantity of ' + item.title"
                @click="changeCount(item.id, -1)"
              >
                −
              </button>
              <output :aria-label="'Quantity of ' + item.title">
                {{ item.count }}
              </output>
              <button
                type="button"
                :aria-label="'Increase quantity of ' + item.title"
                :disabled="item.count >= maxQuantity"
                @click="changeCount(item.id, 1)"
              >
                +
              </button>
              <button
                type="button"
                class="text-button remove-item"
                :aria-label="'Remove ' + item.title"
                @click="removeItem(item.id)"
              >
                Remove
              </button>
            </div>
            <p class="line-total">{{ money(item.lineCents) }}</p>
          </div>
        </li>
      </ul>
      <div class="cart-subtotal">
        <span>Subtotal</span>
        <strong data-testid="subtotal">
          {{ money(summary.totalCents) }}
        </strong>
      </div>
      <button
        type="button"
        class="bttn-reg c_button continue-shopping"
        @click="closeDialog('cart')"
      >
        Continue shopping
      </button>
    </dialog>
  </div>
</template>
