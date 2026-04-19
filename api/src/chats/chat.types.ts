export type ChatMessage = {
  id: string;
  direction: 'in' | 'out';
  body: string;
  createdAt: string;
  twilioSid?: string;
};

export type ChatFile = {
  id: string;
  phoneE164: string;
  name: string;
  lastInboundAt: string | null;
  messages: ChatMessage[];
};
