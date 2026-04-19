import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StateService implements OnModuleInit {
  private readonly logger = new Logger(StateService.name);
  readonly root: string;
  readonly chatsDir: string;
  readonly bookingsDir: string;
  readonly servicesFile: string;

  constructor(private readonly config: ConfigService) {
    this.root = path.resolve(this.config.get<string>('stateRoot')!);
    this.chatsDir = path.join(this.root, 'chats');
    this.bookingsDir = path.join(this.root, 'bookings');
    this.servicesFile = path.join(this.root, 'services.json');
  }

  async onModuleInit() {
    await fs.mkdir(this.chatsDir, { recursive: true });
    await fs.mkdir(this.bookingsDir, { recursive: true });
    this.logger.log(`State root: ${this.root}`);
  }

  async atomicWriteJson(filePath: string, data: unknown) {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const base = path.basename(filePath);
    const tmp = path.join(dir, `.${base}.${process.pid}.${Date.now()}.tmp`);
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(tmp, filePath);
  }

  async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async listJsonFiles(dir: string): Promise<string[]> {
    try {
      const names = await fs.readdir(dir);
      return names.filter((n) => n.endsWith('.json'));
    } catch {
      return [];
    }
  }

  async deleteFile(filePath: string): Promise<boolean> {
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
