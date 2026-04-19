<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  adminAiChat,
  fetchBookingsNextThreeDays,
  fetchChat,
  fetchChats,
  patchBooking,
  sendChatMessage,
  sendTemplateReminder,
  type Booking,
  type Chat,
} from '../api/client';
import {
  bookingInSalonCell,
  formatBookingTimeInSalon,
  formatSalonWindowSubtitle,
  salonThreeDayStarts,
} from '../salonCalendar';
import type { DateTime } from 'luxon';

const HOUR_START = 8;
const HOUR_END = 18;

const bookings = ref<Booking[]>([]);
const chats = ref<Chat[]>([]);
const selectedChatId = ref<string | null>(null);
const selectedChat = ref<Chat | null>(null);
const outboundBody = ref('');
const adminInput = ref('');
const adminMessages = ref<{ role: 'user' | 'assistant'; content: string }[]>([]);

/** Same tool names as `BOOKING_TOOL_DEFINITIONS` / admin AI chat. */
const MCP_SERVER_TOOLS = [
  'list_bookings_next_3_days',
  'list_bookings_month',
  'create_booking',
  'update_booking',
  'cancel_booking',
  'list_services',
] as const;
const pollTimer = ref<number | null>(null);

/** Viewport ≤480px: single-day column with &lt; &gt; navigation. */
const CALENDAR_NARROW_MQ = '(max-width: 480px)';
const isNarrowCalendar = ref(false);
const mobileCalendarDayIndex = ref(0);

/** Recomputed on each poll tick so "today" rolls at midnight in salon TZ. */
const threeDayStarts = ref<DateTime[]>(salonThreeDayStarts());

const dayColumnLabels = computed(() =>
  threeDayStarts.value.map((d, i) => {
    const label = ['Today', 'Tomorrow', 'Day after'][i] ?? `+${i}`;
    return {
      title: label,
      sub: d.toFormat('ccc d MMM'),
      date: d,
    };
  }),
);

const displayedColumnLabels = computed(() => {
  const cols = dayColumnLabels.value;
  if (isNarrowCalendar.value) {
    const i = Math.min(Math.max(mobileCalendarDayIndex.value, 0), 2);
    return cols[i] ? [cols[i]] : [];
  }
  return cols;
});

const displayedDayStarts = computed(() => {
  const days = threeDayStarts.value;
  if (isNarrowCalendar.value) {
    const i = Math.min(Math.max(mobileCalendarDayIndex.value, 0), 2);
    return days[i] ? [days[i]] : [];
  }
  return days;
});

function syncCalendarBreakpoint() {
  if (typeof window === 'undefined') return;
  isNarrowCalendar.value = window.matchMedia(CALENDAR_NARROW_MQ).matches;
}

function prevCalendarDay() {
  mobileCalendarDayIndex.value = Math.max(0, mobileCalendarDayIndex.value - 1);
}

function nextCalendarDay() {
  mobileCalendarDayIndex.value = Math.min(2, mobileCalendarDayIndex.value + 1);
}

let calendarMqCleanup: (() => void) | null = null;

const salonWindowLine = computed(() => formatSalonWindowSubtitle());

const hourRows = computed(() => {
  const rows: number[] = [];
  for (let h = HOUR_START; h <= HOUR_END; h++) rows.push(h);
  return rows;
});

function bookingsInCell(day: DateTime, hour: number): Booking[] {
  return bookings.value.filter((b) => bookingInSalonCell(b.start, day, hour));
}

function within24h(iso: string | null) {
  if (!iso) return false;
  const ms = Date.now() - new Date(iso).getTime();
  return ms >= 0 && ms < 24 * 60 * 60 * 1000;
}

function formatChatListTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function loadBookings() {
  threeDayStarts.value = salonThreeDayStarts();
  bookings.value = await fetchBookingsNextThreeDays({ includeCanceled: true });
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
  if (!selectedChatId.value || !selectedChat.value) return;
  const b = bookings.value.find(
    (x) => x.phoneE164 === selectedChat.value!.phoneE164 && !x.canceled,
  );
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

async function markConfirmed(b: Booking) {
  try {
    await patchBooking(b.id, { confirmed: true });
    await loadBookings();
  } catch {
    alert('Could not update booking');
  }
}

const bookingDetailBubble = ref<{
  booking: Booking;
  left: number;
  top: number;
} | null>(null);

function openBookingDetail(b: Booking, e: MouseEvent | KeyboardEvent) {
  const el = e.currentTarget as HTMLElement;
  const r = el.getBoundingClientRect();
  const width = 240;
  let left = r.left + r.width / 2 - width / 2;
  left = Math.max(10, Math.min(left, window.innerWidth - width - 10));
  const estHeight = 160;
  let top = r.bottom + 6;
  if (top + estHeight > window.innerHeight - 10) {
    top = Math.max(10, r.top - estHeight - 6);
  }
  bookingDetailBubble.value = { booking: b, left, top };
}

function closeBookingDetail() {
  bookingDetailBubble.value = null;
}

function onPillClick(b: Booking, e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button.mini')) return;
  openBookingDetail(b, e);
}

function onPillKeydown(b: Booking, e: KeyboardEvent) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if ((e.target as HTMLElement).closest('button.mini')) return;
  e.preventDefault();
  openBookingDetail(b, e);
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

onMounted(async () => {
  syncCalendarBreakpoint();
  const mq = window.matchMedia(CALENDAR_NARROW_MQ);
  mq.addEventListener('change', syncCalendarBreakpoint);
  calendarMqCleanup = () => mq.removeEventListener('change', syncCalendarBreakpoint);

  await loadBookings();
  await loadChats();
  pollTimer.value = window.setInterval(() => {
    void loadChats();
    void refreshSelectedChat();
    void loadBookings();
  }, 4000);
});

onUnmounted(() => {
  calendarMqCleanup?.();
  if (pollTimer.value) clearInterval(pollTimer.value);
});
</script>

<template>
  <div class="dash">
    <section class="panel">
      <h2 class="cal-title">Next 3 bookable days</h2>
      <p class="cal-sub">{{ salonWindowLine }}</p>
      <p class="legend">
        <span class="dot confirmed"></span> Confirmed
        <span class="dot pending"></span> Pending confirmation
        <span class="dot canceled"></span> Canceled
      </p>
      <div v-if="isNarrowCalendar" class="cal-day-nav">
        <button
          type="button"
          class="cal-day-nav-btn"
          aria-label="Previous day"
          :disabled="mobileCalendarDayIndex <= 0"
          @click="prevCalendarDay"
        >
          &lt;
        </button>
        <div class="cal-day-nav-label">
          <span class="cal-day-nav-title">{{ displayedColumnLabels[0]?.title }}</span>
          <span class="cal-day-nav-sub">{{ displayedColumnLabels[0]?.sub }}</span>
        </div>
        <button
          type="button"
          class="cal-day-nav-btn"
          aria-label="Next day"
          :disabled="mobileCalendarDayIndex >= 2"
          @click="nextCalendarDay"
        >
          &gt;
        </button>
      </div>
      <div
        class="day-grid"
        :class="{ 'day-grid--narrow': isNarrowCalendar }"
      >
        <template v-if="!isNarrowCalendar">
          <div class="corner"></div>
          <div v-for="col in dayColumnLabels" :key="col.sub" class="day-head">
            <div class="dh-title">{{ col.title }}</div>
            <div class="dh-sub">{{ col.sub }}</div>
          </div>
        </template>
        <template v-for="hour in hourRows" :key="hour">
          <div class="hour-label">{{ hour }}:00</div>
          <div
            v-for="(col, ci) in displayedDayStarts"
            :key="`${hour}-${ci}`"
            class="cell"
          >
            <div
              v-for="b in bookingsInCell(col, hour)"
              :key="b.id"
              class="pill"
              :class="
                b.canceled ? 'canceled' : b.confirmed ? 'confirmed' : 'pending'
              "
              role="button"
              tabindex="0"
              :aria-label="`Booking details: ${b.clientName}, ${formatBookingTimeInSalon(b.start)}`"
              @click="onPillClick(b, $event)"
              @keydown="onPillKeydown(b, $event)"
            >
              <span class="pill-calendar" aria-hidden="true">
                <svg
                  class="cal-ico"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <span class="p-time">{{ formatBookingTimeInSalon(b.start) }}</span>
              <span class="p-name">{{ b.clientName }}</span>
              <button
                v-if="!b.confirmed && !b.canceled"
                type="button"
                class="mini"
                @click.stop="markConfirmed(b)"
              >
                Confirm
              </button>
            </div>
          </div>
        </template>
      </div>
    </section>

    <Teleport to="body">
      <div
        v-if="bookingDetailBubble"
        class="detail-overlay"
        role="presentation"
        @click="closeBookingDetail"
      >
        <div
          class="detail-bubble"
          role="dialog"
          aria-label="Booking details"
          :style="{
            left: bookingDetailBubble.left + 'px',
            top: bookingDetailBubble.top + 'px',
          }"
          @click.stop
        >
          <button type="button" class="detail-close" aria-label="Close" @click="closeBookingDetail">
            ×
          </button>
          <dl class="detail-dl">
            <dt>Name</dt>
            <dd>{{ bookingDetailBubble.booking.clientName }}</dd>
            <dt>Phone</dt>
            <dd>{{ bookingDetailBubble.booking.phoneE164 }}</dd>
            <dt>Services</dt>
            <dd>{{ bookingDetailBubble.booking.services.join(', ') }}</dd>
          </dl>
        </div>
      </div>
    </Teleport>

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
          <div class="t-phone">{{ c.phoneE164 }}</div>
          <div class="t-time">{{ formatChatListTime(c.lastInboundAt) }}</div>
          <div
            class="t-session"
            :class="{ 't-session--live': within24h(c.lastInboundAt) }"
          >
            {{ within24h(c.lastInboundAt) ? 'Session OK' : 'Template only' }}
          </div>
        </button>
      </div>

      <div class="thread-main" v-if="selectedChat">
        <div class="thread-head">
          <h3 class="thread-title">Conversation</h3>
          <button type="button" class="secondary thread-reminder" @click="sendReminder">
            Send Confirmation Reminder
          </button>
        </div>
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
      </div>
      <div v-else class="thread-main muted">Select a chat</div>
    </section>

    <section class="mcp panel">
      <h3 class="mcp-heading">MCP Server</h3>
      <p class="mcp-tools-label">Tools available (API-backed, same as OpenAI tool layer):</p>
      <ul class="mcp-tools">
        <li v-for="name in MCP_SERVER_TOOLS" :key="name">
          <code>{{ name }}</code>
        </li>
      </ul>
      <div class="mcp-msgs">
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
          placeholder="Ask using natural language (tools run on the server)…"
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
  background: #fff;
}
.panel {
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  padding: 1rem;
  background: rgba(15, 23, 42, 0.07);
  overflow-x: auto;
}
.cal-title {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
}
.cal-sub {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: #555;
}
.legend {
  font-size: 0.85rem;
  margin: 0 0 0.75rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 0.35rem;
}
.dot.confirmed {
  background: #16a34a;
}
.dot.pending {
  background: #eab308;
}
.dot.canceled {
  background: #9ca3af;
}
.day-grid {
  display: grid;
  grid-template-columns: 52px repeat(3, minmax(120px, 1fr));
  gap: 4px;
  align-items: stretch;
}
.day-grid--narrow {
  grid-template-columns: 44px minmax(0, 1fr);
}
.cal-day-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
  padding: 0.35rem 0.25rem;
}
.cal-day-nav-btn {
  flex: 0 0 auto;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 8px;
  background: #fff;
  font-size: 1rem;
  line-height: 1;
  color: #374151;
  cursor: pointer;
}
.cal-day-nav-btn:hover:not(:disabled) {
  background: rgba(15, 23, 42, 0.06);
}
.cal-day-nav-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.cal-day-nav-label {
  flex: 1;
  text-align: center;
  min-width: 0;
}
.cal-day-nav-title {
  display: block;
  font-weight: 700;
  font-size: 0.85rem;
}
.cal-day-nav-sub {
  display: block;
  font-size: 0.75rem;
  color: #6b7280;
  margin-top: 0.1rem;
}
.corner {
  min-height: 8px;
}
.day-head {
  text-align: center;
  font-size: 0.8rem;
  padding: 0.25rem;
}
.dh-title {
  font-weight: 700;
}
.dh-sub {
  color: #666;
}
.hour-label {
  font-size: 0.75rem;
  color: #666;
  padding-top: 0.25rem;
}
.cell {
  min-height: 52px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  border-radius: 6px;
  background: #fff;
  padding: 2px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pill {
  font-size: 0.7rem;
  padding: 2px 4px;
  border-radius: 4px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
  outline: none;
}
.pill:focus-visible {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #2563eb;
}
.pill-calendar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  opacity: 0.8;
  pointer-events: none;
}
.cal-ico {
  width: 14px;
  height: 14px;
  display: block;
}
.pill.confirmed {
  background: #dcfce7;
  border: 1px solid #16a34a;
}
.pill.pending {
  background: #fef9c3;
  border: 1px solid #ca8a04;
}
.pill.canceled {
  background: #f3f4f6;
  border: 1px solid #9ca3af;
  color: #6b7280;
  text-decoration: line-through;
}
.pill.canceled .p-name {
  text-decoration: line-through;
}
.p-time {
  font-weight: 600;
}
.p-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mini {
  font-size: 0.65rem;
  padding: 1px 4px;
  border-radius: 4px;
  border: 1px solid #999;
  background: #fff;
  cursor: pointer;
}
.split {
  display: grid;
  grid-template-columns: minmax(0, 140px) minmax(260px, 1fr);
  gap: 1rem;
  min-height: 320px;
}
@media (max-width: 700px) {
  .split {
    grid-template-columns: 1fr;
  }
}
.threads {
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  padding: 0.5rem 0.45rem;
  background: rgba(15, 23, 42, 0.05);
  max-height: 420px;
  overflow: auto;
  min-width: 0;
}
.thread {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.4rem 0.45rem;
  margin-bottom: 0.35rem;
  border-radius: 8px;
  border: 1px solid rgba(15, 23, 42, 0.1);
  background: rgba(15, 23, 42, 0.06);
  cursor: pointer;
}
.thread.active {
  border-color: #2563eb;
  background: #eff6ff;
}
.t-phone {
  font-weight: 600;
  font-size: 0.72rem;
  line-height: 1.25;
  word-break: break-all;
  color: #111;
}
.t-time {
  margin-top: 0.2rem;
  font-size: 0.65rem;
  line-height: 1.2;
  color: #6b7280;
}
.t-session {
  margin-top: 0.25rem;
  font-size: 0.62rem;
  line-height: 1.2;
  font-weight: 500;
  color: #6b7280;
}
.t-session--live {
  color: #15803d;
}
.thread-main {
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  background: rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 260px;
  box-sizing: border-box;
}
.thread-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.thread-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
.thread-reminder {
  flex-shrink: 0;
  font-size: 0.8rem;
  padding: 0.4rem 0.65rem;
  white-space: nowrap;
}
@media (max-width: 700px) {
  .thread-main {
    min-width: 0;
  }
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
.mcp-heading {
  margin: 0 0 0.35rem;
  font-size: 1.05rem;
}
.mcp-tools-label {
  margin: 0 0 0.35rem;
  font-size: 0.78rem;
  color: #4b5563;
  line-height: 1.35;
}
.mcp-tools {
  margin: 0 0 0.75rem;
  padding-left: 1.15rem;
  font-size: 0.78rem;
  line-height: 1.45;
  color: #374151;
}
.mcp-tools code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-size: 0.76rem;
  background: rgba(15, 23, 42, 0.06);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}
.mcp-msgs {
  min-height: 120px;
  max-height: 200px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 0.5rem;
}
</style>

<style>
/* Teleport to body — unscoped so overlay stacks above app */
.detail-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(15, 23, 42, 0.12);
}
.detail-bubble {
  position: fixed;
  z-index: 2001;
  width: 240px;
  padding: 0.65rem 1.75rem 0.75rem 0.75rem;
  background: #fff;
  border: 1px solid rgba(15, 23, 42, 0.15);
  border-radius: 10px;
  box-shadow:
    0 4px 6px -1px rgba(0, 0, 0, 0.08),
    0 10px 15px -3px rgba(0, 0, 0, 0.1);
  font-size: 0.8rem;
  color: #111;
}
.detail-close {
  position: absolute;
  top: 4px;
  right: 6px;
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border: none;
  background: transparent;
  font-size: 1.25rem;
  line-height: 1;
  color: #6b7280;
  cursor: pointer;
  border-radius: 4px;
}
.detail-close:hover {
  background: rgba(15, 23, 42, 0.08);
  color: #111;
}
.detail-dl {
  margin: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.25rem 0.75rem;
  align-items: start;
}
.detail-dl dt {
  margin: 0;
  font-weight: 600;
  color: #4b5563;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.detail-dl dd {
  margin: 0;
  word-break: break-word;
}
</style>
