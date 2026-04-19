<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router';
</script>

<template>
  <div class="app">
    <nav class="nav">
      <RouterLink to="/">Clients</RouterLink>
      <RouterLink to="/dashboard">Dashboard</RouterLink>
    </nav>
    <RouterView />
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  color: #111;
}
.nav {
  display: flex;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #eee;
  background: #fff;
}
.nav a {
  color: #2563eb;
  text-decoration: none;
}
.nav a.router-link-active {
  font-weight: 600;
}
</style>
