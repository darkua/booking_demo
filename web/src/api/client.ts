import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function login(username: string, password: string) {
  const { data } = await api.post<{ access_token: string }>('/auth/login', {
    username,
    password,
  });
  return data.access_token;
}

export type Booking = {
  id: string;
  clientId: string;
  start: string;
  services: string[];
  durationMinutes: number;
};

export type Chat = {
  id: string;
  phoneE164: string;
  name: string;
  lastInboundAt: string | null;
  messages: {
    id: string;
    direction: 'in' | 'out';
    body: string;
    createdAt: string;
  }[];
};

export async function fetchBookingsMonth(year: number, month: number) {
  const { data } = await api.get<Booking[]>('/bookings', {
    params: { year, month },
  });
  return data;
}

export async function fetchChats() {
  const { data } = await api.get<Chat[]>('/chats');
  return data;
}

export async function fetchChat(id: string) {
  const { data } = await api.get<Chat>(`/chats/${id}`);
  return data;
}

export async function sendChatMessage(chatId: string, body: string) {
  return api.post(`/chats/${chatId}/messages`, { body });
}

export async function sendTemplateReminder(
  chatId: string,
  payload: { bookingId?: string; var1?: string; var2?: string },
) {
  return api.post(`/chats/${chatId}/template-reminder`, payload);
}

export async function adminAiChat(messages: Record<string, unknown>[]) {
  const { data } = await api.post<{ messages: Record<string, unknown>[] }>(
    '/admin/ai/chat',
    { messages },
  );
  return data.messages;
}
