import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('token'));

  const isAuthenticated = computed(() => !!token.value);

  function setToken(t: string | null) {
    token.value = t;
    if (t) localStorage.setItem('token', t);
    else localStorage.removeItem('token');
  }

  function logout() {
    setToken(null);
  }

  return { token, isAuthenticated, setToken, logout };
});
