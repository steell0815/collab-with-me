import { mkdir, appendFile } from 'fs/promises';
import { dirname } from 'path';

export type UsageEvent = {
  timestamp: string;
  actionType: string;
  action: string;
  userId?: string;
  referrer?: string;
  userAgent?: string;
};

export class UsageLogger {
  constructor(private readonly filePath: string) {}

  async record(event: UsageEvent): Promise<void> {
    this.validate(event);
    await mkdir(dirname(this.filePath), { recursive: true });
    const line = JSON.stringify(event);
    await appendFile(this.filePath, `${line}\n`, 'utf-8');
  }

  private validate(event: UsageEvent) {
    if (!event.timestamp || !event.actionType || !event.action) {
      throw new Error('Usage event requires timestamp, actionType, and action');
    }
  }
}
