import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { StateService } from '../state/state.service';

export type ServiceItem = { id: string; name: string; category?: string };

const DEFAULT_SERVICES: ServiceItem[] = [
  { id: 'haircut-styling', category: 'Hair Services', name: 'Haircut & Styling' },
  { id: 'blow-dry', category: 'Hair Services', name: 'Blow Dry' },
  { id: 'hair-coloring', category: 'Hair Services', name: 'Hair Coloring' },
  { id: 'highlights-balayage', category: 'Hair Services', name: 'Highlights / Balayage' },
  { id: 'hair-treatments', category: 'Hair Services', name: 'Hair Treatments' },
  { id: 'manicure', category: 'Nails', name: 'Manicure' },
  { id: 'pedicure', category: 'Nails', name: 'Pedicure' },
  { id: 'gel-shellac', category: 'Nails', name: 'Gel / Shellac' },
  { id: 'nail-extensions', category: 'Nails', name: 'Nail Extensions' },
  { id: 'makeup', category: 'Beauty', name: 'Makeup (Day / Evening)' },
  { id: 'eyebrow-shaping', category: 'Beauty', name: 'Eyebrow Shaping' },
  { id: 'eyelash-extensions', category: 'Beauty', name: 'Eyelash Extensions' },
  { id: 'facial-treatments', category: 'Beauty', name: 'Facial Treatments' },
  { id: 'waxing', category: 'Waxing', name: 'Full Body / Partial' },
];

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly logger = new Logger(CatalogService.name);

  constructor(private readonly state: StateService) {}

  async onModuleInit() {
    const existing = await this.state.readJsonFile<{ services: ServiceItem[] }>(
      this.state.servicesFile,
    );
    if (!existing?.services?.length) {
      await this.state.atomicWriteJson(this.state.servicesFile, {
        services: DEFAULT_SERVICES,
      });
      this.logger.log('Seeded services.json');
    }
  }

  async getServices(): Promise<ServiceItem[]> {
    const doc = await this.state.readJsonFile<{ services: ServiceItem[] }>(
      this.state.servicesFile,
    );
    return doc?.services?.length ? doc.services : DEFAULT_SERVICES;
  }

  formatServicesForPrompt(): string {
    return DEFAULT_SERVICES.map((s) => `- ${s.name} (${s.category})`).join('\n');
  }
}
