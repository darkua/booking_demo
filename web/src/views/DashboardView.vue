<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  adminAiChat,
  fetchBookingsMonth,
  fetchChat,
  fetchChats,
  sendChatMessage,
  sendTemplateReminder,
  type Booking,
  type Chat,
} from '../api/client';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const now = new Date();
const viewYear = ref(now.getFullYear());
const viewMonth = ref(now.getMonth() + 1);
const bookings = ref<Booking[]>([]);
const chats = ref<Chat[]>([]);
const selectedChatId = ref<string | null>(null);
const selectedChat = ref<Chat | null>(null);
const outboundBody = ref('');
const adminInput = ref('');
const adminMessages = ref<{ role: 'user' | 'assistant'; content: string }[]>([]);
const pollTimer = ref<number | null>(null);

const monthLabel = computed(() =>
  new Date(viewYear.value, viewMonth.value - 1, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  }),
);

const calendarCells = computed(() => {
  const y = viewYear.value;
  const m = viewMonth.value;
  const first = new Date(y, m - 1, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const cells: { day: number | null; key: string; bookings: Booking[] }[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ day: null, key: `p-${i}`, bookings: [] });
  }
  const byDay = new Map<number, Booking[]>();
  for (const b of bookings.value) {
    const d = new Date(b.start);
    if (d.getFullYear() === y && d.getMonth() + 1 === m) {
      const day = d.getDate();
      const list = byDay.get(day) ?? [];
      list.push(b);
      byDay.set(day, list);
    }
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      key: `d-${d}`,
      bookings: byDay.get(d) ?? [],
    });
  }
  return cells;
});

function within24h(iso: string | null) {
  if (!iso) return false;
  const ms = Date.now() - new Date(iso).getTime();
  return ms >= 0 && ms < 24 * 60 * 60 * 1000;
}

async function loadBookings() {
  bookings.value = await fetchBookingsMonth(viewYear.value, viewMonth.value);
}

async function loadChats() {
  chats.value = await fetchChats();
}

async function refreshSelectedChat() {
  if (!selectedChatId.value) {
    selectedChat.value = null;
    return;
  }
  selectedChat.value = await fetchChat(selectedChatId.value);
}

function selectChat(id: string) {
  selectedChatId.value = id;
  void refreshSelectedChat();
}

async function sendOutbound() {
  if (!selectedChatId.value || !outboundBody.value.trim()) return;
  try {
    await sendChatMessage(selectedChatId.value, outboundBody.value.trim());
    outboundBody.value = '';
    await refreshSelectedChat();
    await loadChats();
  } catch (e: unknown) {
    alert(e instanceof Error ? e.message : 'Could not send (check 24h window)');
  }
}

async function sendReminder() {
  if (!selectedChatId.value) return;
  const b = bookings.value.find((x) => x.clientId === selectedChatId.value);
  try {
    await sendTemplateReminder(selectedChatId.value, {
      bookingId: b?.id,
    });
    await refreshSelectedChat();
    await loadChats();
  } catch {
    alert('Template send failed. Set TWILIO_APPOINTMENT_TEMPLATE_SID and vars.');
  }
}

async function runAdminAi() {
  const text = adminInput.value.trim();
  if (!text) return;
  adminInput.value = '';
  adminMessages.value.push({ role: 'user', content: text });
  const payload = adminMessages.value.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const result = await adminAiChat(payload);
  const lastAssistant = [...result].reverse().find(
    (m) => m.role === 'assistant' && typeof m.content === 'string',
  ) as { role: string; content: string } | undefined;
  if (lastAssistant?.content) {
    adminMessages.value.push({ role: 'assistant', content: lastAssistant.content });
  } else {
    adminMessages.value.push({
      role: 'assistant',
      content: '(No text reply — check API / tools.)',
    });
  }
}

function logout() {
  auth.logout();
  void router.push('/login');
}

function prevMonth() {
  let m = viewMonth.value - 1;
  let y = viewYear.value;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  viewMonth.value = m;
  viewYear.value = y;
  void loadBookings();
}

function nextMonth() {
  let m = viewMonth.value + 1;
  let y = viewYear.value;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  viewMonth.value = m;
  viewYear.value = y;
  void loadBookings();
}

onMounted(async () => {
  await loadBookings();
  await loadChats();
  pollTimer.value = window.setInterval(() => {
    void loadChats();
    void refreshSelectedChat();
    void loadBookings();
  }, 4000);
});

onUnmounted(() => {
  if (pollTimer.value) clearInterval(pollTimer.value);
});

watch([viewYear, viewMonth], () => {
  void loadBookings();
});
</script>

<template>
  <div class="dash">
    <header class="top">
      <h1>Dashboard</h1>
      <button type="button" class="ghost" @click="logout">Log out</button>
    </header>

    <section class="panel">
      <div class="cal-head">
        <button type="button" @click="prevMonth">←</button>
        <h2>{{ monthLabel }}</h2>
        <button type="button" @click="nextMonth">→</button>
      </div>
      <div class="weekdays">
        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span
        ><span>Fri</span><span>Sat</span>
      </div>
      <div class="grid">
        <div
          v-for="c in calendarCells"
          :key="c.key"
          class="cell"
          :class="{ muted: c.day === null }"
        >
          <template v-if="c.day !== null">
            <div class="daynum">{{ c.day }}</div>
            <div v-for="b in c.bookings" :key="b.id" class="pill" :title="b.services.join(', ')">
              {{ new Date(b.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}
            </div>
          </template>
        </div>
      </div>
    </section>

    <section class="split">
      <div class="threads">
        <h3>Chats</h3>
        <button
          v-for="c in chats"
          :key="c.id"
          type="button"
          class="thread"
          :class="{ active: c.id === selectedChatId }"
          @click="selectChat(c.id)"
        >
          <div class="t-title">{{ c.name || c.phoneE164 }}</div>
          <div class="t-sub">{{ c.phoneE164 }}</div>
          <div class="t-meta">
            {{ c.lastInboundAt ? new Date(c.lastInboundAt).toLocaleString() : '—' }}
            ·
            {{ within24h(c.lastInboundAt) ? 'session OK' : 'template only' }}
          </div>
        </button>
      </div>

      <div class="thread-main" v-if="selectedChat">
        <h3>Conversation</h3>
        <div class="msgs">
          <div
            v-for="m in selectedChat.messages"
            :key="m.id"
            class="msg"
            :class="m.direction"
          >
            {{ m.body }}
          </div>
        </div>
        <p v-if="!within24h(selectedChat.lastInboundAt)" class="warn">
          Outside 24h session — free-text send is blocked; use template reminder.
        </p>
        <div class="row">
          <input
            v-model="outboundBody"
            placeholder="Reply on WhatsApp…"
            :disabled="!within24h(selectedChat.lastInboundAt)"
            @keydown.enter.prevent="sendOutbound"
          />
          <button
            type="button"
            :disabled="!within24h(selectedChat.lastInboundAt)"
            @click="sendOutbound"
          >
            Send
          </button>
        </div>
        <button type="button" class="secondary" @click="sendReminder">
          Send appointment template
        </button>
      </div>
      <div v-else class="thread-main muted">Select a chat</div>
    </section>

    <section class="admin panel">
      <h3>Admin AI (bookings tools)</h3>
      <div class="admin-msgs">
        <div
          v-for="(m, i) in adminMessages"
          :key="i"
          class="msg"
          :class="m.role"
        >
          {{ m.content }}
        </div>
      </div>
      <div class="row">
        <input
          v-model="adminInput"
          placeholder="Ask to list or create bookings…"
          @keydown.enter.prevent="runAdminAi"
        />
        <button type="button" @click="runAdminAi">Send</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.dash {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1rem 1rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ghost {
  background: transparent;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 0.35rem 0.75rem;
  cursor: pointer;
}
.panel {
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  padding: 1rem;
  background: #fafafa;
}
.cal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 0.25rem;
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.cell {
  min-height: 72px;
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 4px;
  background: #fff;
  font-size: 0.75rem;
}
.cell.muted {
  background: transparent;
  border-color: transparent;
}
.daynum {
  font-weight: 600;
}
.pill {
  background: #dbeafe;
  border-radius: 4px;
  padding: 1px 4px;
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.split {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1rem;
  min-height: 320px;
}
.threads {
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  padding: 0.75rem;
  background: #fff;
  max-height: 420px;
  overflow: auto;
}
.thread {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.65rem;
  margin-bottom: 0.35rem;
  border-radius: 8px;
  border: 1px solid #eee;
  background: #fafafa;
  cursor: pointer;
}
.thread.active {
  border-color: #2563eb;
  background: #eff6ff;
}
.t-title {
  font-weight: 600;
  font-size: 0.9rem;
}
.t-sub,
.t-meta {
  font-size: 0.75rem;
  color: #555;
}
.thread-main {
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  padding: 0.75rem 1rem;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.thread-main.muted {
  color: #888;
  align-items: center;
  justify-content: center;
}
.msgs {
  flex: 1;
  max-height: 280px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
}
.msg.in {
  align-self: flex-start;
  background: #f3f4f6;
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  max-width: 90%;
}
.msg.out {
  align-self: flex-end;
  background: #dbeafe;
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
  max-width: 90%;
}
.msg.user {
  align-self: flex-end;
  background: #111827;
  color: #fff;
}
.msg.assistant {
  align-self: flex-start;
  background: #ecfdf5;
  padding: 0.35rem 0.5rem;
  border-radius: 8px;
}
.row {
  display: flex;
  gap: 0.5rem;
}
.row input {
  flex: 1;
  padding: 0.5rem 0.65rem;
  border-radius: 8px;
  border: 1px solid #ccc;
}
.row button,
.secondary {
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: none;
  background: #111;
  color: #fff;
  cursor: pointer;
}
.secondary {
  align-self: flex-start;
  background: #4338ca;
}
.warn {
  color: #b45309;
  font-size: 0.85rem;
}
.admin-msgs {
  min-height: 120px;
  max-height: 200px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}
</style>
