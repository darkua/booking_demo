<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { login } from '../api/client';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();

const username = ref('altarise');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const token = await login(username.value, password.value);
    auth.setToken(token);
    const redirect = (route.query.redirect as string) || '/dashboard';
    await router.push(redirect);
  } catch {
    error.value = 'Invalid username or password';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page">
    <h1>AltaRise — staff login</h1>
    <form class="card" @submit.prevent="submit">
      <label>
        Username
        <input v-model="username" autocomplete="username" />
      </label>
      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" />
      </label>
      <p v-if="error" class="err">{{ error }}</p>
      <button type="submit" :disabled="loading">{{ loading ? 'Signing in…' : 'Sign in' }}</button>
    </form>
    <p><router-link to="/">← Back to client page</router-link></p>
  </div>
</template>

<style scoped>
.page {
  max-width: 400px;
  margin: 3rem auto;
  padding: 1rem;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 12px;
  border: 1px solid #e5e5e5;
  background: #fff;
}
label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}
input {
  padding: 0.5rem 0.65rem;
  border: 1px solid #ccc;
  border-radius: 8px;
}
button {
  padding: 0.65rem 1rem;
  border-radius: 8px;
  border: none;
  background: #111;
  color: #fff;
  cursor: pointer;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.err {
  color: #b91c1c;
  font-size: 0.9rem;
}
a {
  color: #2563eb;
}
</style>
