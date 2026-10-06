/* global Vue, ShopCart */
'use strict';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});
const money = cents => currencyFormatter.format(cents / 100);

function imageFallback(event) {
  const image = event.target;
  if (image.src.endsWith('/images/product-placeholder.svg')) return;

  image.src = '/images/product-placeholder.svg';
}

const ProductCard = {
  props: {
    good: { type: Object, required: true },
  },
  emits: ['add'],
  computed: {
    priceLabel() {
      if (!this.good.available) return 'Price unavailable';

      return money(this.good.priceCents);
    },
    cartButtonLabel() {
      if (!this.good.available) return `${this.good.title} unavailable`;

      return `Add ${this.good.title} to cart`;
    },
  },
  methods: { imageFallback },
  template: `
    <article
      class="cell-3 m-b-30 cell-4-m cell-6-sm cell-12-xs product-card"
      :data-product-id="good.id"
    >
      <div class="product-item">
        <div class="product-image square rel-img m-b-20">
          <img
            :src="good.img"
            :alt="good.title"
            loading="lazy"
            @error="imageFallback"
          >
        </div>
        <div class="product-item__title text-center">
          <h2 class="product-name fw-400">{{ good.title }}</h2>
          <p class="product-price fw-700">{{ priceLabel }}</p>
        </div>
        <button
          type="button"
          class="bttn-reg in-product c_button w-100"
          :disabled="!good.available"
          :aria-label="cartButtonLabel"
          @click="$emit('add', good.id)"
        >
          <template v-if="good.available">ADD TO CART</template>
          <template v-else>UNAVAILABLE</template>
        </button>
      </div>
    </article>`,
};

const FeedbackForm = {
  data: () => ({
    name: '',
    email: '',
    phone: '',
    message: '',
    errors: {},
    validated: false,
  }),
  methods: {
    validate() {
      const errors = {};
      if (!/^[\p{L}][\p{L}\s'’-]{1,99}$/u.test(this.name.trim())) {
        errors.name = 'Enter a name using letters, spaces, hyphens or apostrophes.';
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) {
        errors.email = 'Enter a valid email address.';
      }
      if (!/^(\+7|8)\([0-9]{3}\)[0-9]{3}-[0-9]{4}$/.test(this.phone.trim())) {
        errors.phone = 'Use +7(000)000-0000 or 8(000)000-0000.';
      }

      this.errors = errors;
      this.validated = Object.keys(errors).length === 0;
      if (this.validated) return;

      this.$nextTick(() => {
        const invalidInput = this.$el.querySelector('[aria-invalid="true"]');
        invalidInput?.focus();
      });
    },
    edited(field) {
      this.validated = false;
      if (field) delete this.errors[field];
    },
  },
  template: `
    <section id="feedback" class="feedback-section" aria-labelledby="feedback-title">
      <h2 id="feedback-title" class="h1-like text-center fw-400">
        Feedback validation demo
      </h2>
      <p class="demo-note">
        Nothing is sent or stored. Use sample details to try the validation.
      </p>
      <form class="feedback-form" novalidate @submit.prevent="validate">
        <div class="field">
          <label for="feedback-name">Name</label>
          <input
            id="feedback-name"
            v-model="name"
            type="text"
            maxlength="100"
            required
            placeholder="Example: Alex Smith"
            autocomplete="off"
            :aria-invalid="Boolean(errors.name)"
            :aria-describedby="errors.name ? 'name-error' : undefined"
            @input="edited('name')"
          >
          <p v-if="errors.name" id="name-error" class="input-error">
            {{ errors.name }}
          </p>
        </div>
        <div class="field">
          <label for="feedback-email">Email</label>
          <input
            id="feedback-email"
            v-model="email"
            type="email"
            maxlength="254"
            required
            placeholder="alex@example.com"
            autocomplete="off"
            :aria-invalid="Boolean(errors.email)"
            :aria-describedby="errors.email ? 'email-error' : undefined"
            @input="edited('email')"
          >
          <p v-if="errors.email" id="email-error" class="input-error">
            {{ errors.email }}
          </p>
        </div>
        <div class="field">
          <label for="feedback-phone">Phone number</label>
          <input
            id="feedback-phone"
            v-model="phone"
            type="tel"
            maxlength="20"
            required
            placeholder="+7(000)000-0000"
            autocomplete="off"
            :aria-invalid="Boolean(errors.phone)"
            :aria-describedby="errors.phone ? 'phone-error' : 'phone-hint'"
            @input="edited('phone')"
          >
          <small id="phone-hint">Format: +7(000)000-0000</small>
          <p v-if="errors.phone" id="phone-error" class="input-error">
            {{ errors.phone }}
          </p>
        </div>
        <div class="field">
          <label for="feedback-message">Message (optional)</label>
          <textarea
            id="feedback-message"
            v-model="message"
            rows="4"
            maxlength="2000"
            @input="edited()"
          ></textarea>
        </div>
        <button type="submit" class="bttn-reg c_button">Validate sample</button>
        <p v-if="validated" role="status" class="success-state">
          Validation passed. This demo did not send your message.
        </p>
      </form>
    </section>`,
};

Vue.createApp({
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
}).mount('#shop');
