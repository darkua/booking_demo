import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { StateService } from '../state/state.service';
import type { ChatFile, ChatMessage } from './chat.types';

export function phoneFromTwilio(from: string): string {
  return from.replace(/^whatsapp:/i, '').trim();
}

export function chatIdFromPhone(phoneE164: string): string {
  return Buffer.from(phoneE164, 'utf8').toString('base64url');
}

@Injectable()
export class ChatsService {
  constructor(private readonly state: StateService) {}

  chatFilePath(chatId: string) {
    return path.join(this.state.chatsDir, `${chatId}.json`);
  }

  async getById(chatId: string): Promise<ChatFile | null> {
    return this.state.readJsonFile<ChatFile>(this.chatFilePath(chatId));
  }

  async upsertFromInbound(from: string, body: string, twilioSid?: string): Promise<ChatFile> {
    const phoneE164 = phoneFromTwilio(from);
    const id = chatIdFromPhone(phoneE164);
    const file = this.chatFilePath(id);
    let chat = await this.state.readJsonFile<ChatFile>(file);
    const now = new Date().toISOString();
    const msg: ChatMessage = {
      id: randomUUID(),
      direction: 'in',
      body,
      createdAt: now,
      twilioSid,
    };
    if (!chat) {
      chat = {
        id,
        phoneE164,
        name: 'Unknown',
        lastInboundAt: now,
        messages: [msg],
      };
    } else {
      chat.lastInboundAt = now;
      chat.messages.push(msg);
    }
    await this.state.atomicWriteJson(file, chat);
    return chat;
  }

  async appendOutbound(chatId: string, body: string, twilioSid?: string): Promise<ChatFile> {
    const file = this.chatFilePath(chatId);
    const chat = await this.state.readJsonFile<ChatFile>(file);
    if (!chat) throw new Error('Chat not found');
    const now = new Date().toISOString();
    chat.messages.push({
      id: randomUUID(),
      direction: 'out',
      body,
      createdAt: now,
      twilioSid,
    });
    await this.state.atomicWriteJson(file, chat);
    return chat;
  }

  async setClientName(chatId: string, name: string): Promise<ChatFile> {
    const file = this.chatFilePath(chatId);
    const chat = await this.state.readJsonFile<ChatFile>(file);
    if (!chat) throw new Error('Chat not found');
    chat.name = name;
    await this.state.atomicWriteJson(file, chat);
    return chat;
  }

  async listChats(): Promise<ChatFile[]> {
    const files = await this.state.listJsonFiles(this.state.chatsDir);
    const out: ChatFile[] = [];
    for (const f of files) {
      const c = await this.state.readJsonFile<ChatFile>(path.join(this.state.chatsDir, f));
      if (c) out.push(c);
    }
    out.sort((a, b) => {
      const ta = a.lastInboundAt ? new Date(a.lastInboundAt).getTime() : 0;
      const tb = b.lastInboundAt ? new Date(b.lastInboundAt).getTime() : 0;
      return tb - ta;
    });
    return out;
  }

  within24h(lastInboundAt: string | null): boolean {
    if (!lastInboundAt) return false;
    const ms = Date.now() - new Date(lastInboundAt).getTime();
    return ms >= 0 && ms < 24 * 60 * 60 * 1000;
  }
}
