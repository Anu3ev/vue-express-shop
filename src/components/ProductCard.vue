<script>
import { money, imageFallback } from '../lib/display.js';

export default {
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
  methods: { imageFallback }
};
</script>

<template>
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
  </article>
</template>
