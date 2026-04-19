<script setup lang="ts">
import { RouterLink, RouterView, useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';

const router = useRouter();
const auth = useAuthStore();

function logout() {
  auth.logout();
  void router.push('/login');
}
</script>

<template>
  <div class="app">
    <header class="app-header">
      <nav class="nav-links" aria-label="Main">
        <RouterLink to="/">Clients</RouterLink>
        <RouterLink to="/dashboard">Dashboard</RouterLink>
      </nav>
      <button
        v-if="auth.isAuthenticated"
        type="button"
        class="btn-logout"
        @click="logout"
      >
        Log out
      </button>
    </header>
    <main class="app-main">
      <RouterView />
    </main>
    <footer class="app-footer">
      <div class="footer-inner">
        <img class="footer-logo" src="/altarise-logo.png" alt="AltaRise" />
        <div class="footer-text">
          <p class="footer-line">
            <a href="https://altarise.io" target="_blank" rel="noopener noreferrer">altarise.io</a>
            <span class="footer-sep">·</span>
            <span>© 2026 AltaRise. All rights reserved.</span>
          </p>
          <p class="footer-disclaimer">
            Disclaimer: This is a product demo; do not share any real PII.
          </p>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  color: #111;
  background: #fff;
}
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.65rem 1.25rem;
  background: #fff;
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
}
.nav-links {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}
.nav-links a {
  color: #2563eb;
  text-decoration: none;
  font-size: 0.95rem;
}
.nav-links a.router-link-active {
  font-weight: 600;
  color: #1d4ed8;
}
.btn-logout {
  margin-left: auto;
  background: transparent;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 8px;
  padding: 0.4rem 0.85rem;
  font-size: 0.9rem;
  cursor: pointer;
  color: #374151;
}
.btn-logout:hover {
  background: rgba(15, 23, 42, 0.05);
}
.app-main {
  flex: 1;
  background: #fff;
}
.app-footer {
  margin-top: auto;
  padding: 1.25rem 1.25rem 1.5rem;
  border-top: 1px solid rgba(15, 23, 42, 0.1);
  background: #fff;
}
.footer-inner {
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
}
@media (min-width: 640px) {
  .footer-inner {
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
  }
}
.footer-logo {
  height: 36px;
  width: auto;
  object-fit: contain;
}
.footer-text {
  font-size: 0.8rem;
  line-height: 1.45;
  color: #4b5563;
}
.footer-line {
  margin: 0;
}
.footer-line a {
  color: #2563eb;
  text-decoration: none;
}
.footer-line a:hover {
  text-decoration: underline;
}
.footer-sep {
  margin: 0 0.35rem;
  color: #9ca3af;
}
.footer-disclaimer {
  margin: 0.35rem 0 0;
  font-size: 0.75rem;
  color: #6b7280;
  max-width: 36rem;
}
@media (min-width: 640px) {
  .footer-disclaimer {
    margin-top: 0;
  }
  .footer-text {
    text-align: left;
  }
}
</style>
