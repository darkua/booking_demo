<script setup lang="ts">
</script>

<template>
  <div class="page">
    <header class="hero">
      <h1>AltaRise Beauty Salon</h1>
      <p class="lead">
        Demo: connect on WhatsApp to book services. Scan the code or open the sandbox link on your phone.
      </p>
    </header>
    <section class="card">
      <h2>Join our WhatsApp</h2>
      <div class="qr-wrap">
        <img src="/qr_code.svg" alt="WhatsApp QR" width="200" height="200" />
      </div>
      <ol class="steps">
        <li>Open WhatsApp on your phone.</li>
        <li>Send the sandbox join code from Twilio to the sandbox number, or scan the QR if it encodes that link.</li>
        <li>Message us to talk to the booking assistant.</li>
      </ol>
    </section>
    <p class="admin-link">
      <router-link to="/login">Staff login</router-link>
    </p>
  </div>
</template>

<style scoped>
.page {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
}
.hero h1 {
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
}
.lead {
  color: #444;
  line-height: 1.5;
}
.card {
  margin-top: 2rem;
  padding: 1.5rem;
  border-radius: 12px;
  background: #fafafa;
  border: 1px solid #eee;
}
.qr-wrap {
  display: flex;
  justify-content: center;
  margin: 1rem 0;
}
.steps {
  padding-left: 1.25rem;
  line-height: 1.6;
}
.admin-link {
  margin-top: 2rem;
  text-align: center;
}
a {
  color: #2563eb;
}
</style>
