<script>
export default {
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
  }
};
</script>

<template>
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
  </section>
</template>
