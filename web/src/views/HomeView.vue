<script setup lang="ts">
</script>

<template>
  <div class="page">
    <header class="hero">
      <h1>AltaRise Beauty Salon</h1>
    </header>
    <section class="card">
      <div class="qr-wrap">
        <img src="/qr_code.svg" alt="WhatsApp QR" width="200" height="200" />
      </div>
      <ol class="subtitle-list">
        <li>
          Scan the QR code and send the twelve-character code to add AltaRise Twilio WhatsApp Sandbox (simulation of Provider WBA).
        </li>
        <li>
          Talk with our AI agent: try asking about services available and scheduling a booking.
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.page {
  max-width: 640px;
  margin: 0 auto;
  padding: 2rem 1rem 4rem;
  background: #fff;
}
.hero {
  text-align: center;
}
.hero h1 {
  font-size: 1.75rem;
  font-weight: 600;
  margin: 0 0 1.5rem;
  color: #111;
}
.card {
  margin-top: 0.5rem;
  padding: 1.5rem;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.07);
  border: 1px solid rgba(15, 23, 42, 0.12);
}
.qr-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 1.25rem;
}
.subtitle-list {
  margin: 0;
  padding-left: 1.35rem;
  text-align: left;
  line-height: 1.55;
  font-size: 0.95rem;
  color: #374151;
}
.subtitle-list li {
  margin-bottom: 0.65rem;
}
.subtitle-list li:last-child {
  margin-bottom: 0;
}
</style>
