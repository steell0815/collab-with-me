import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { UsageLogger } from '../../src/usageLogger';

const createTempFile = () => {
  const dir = mkdtempSync(join(tmpdir(), 'usage-'));
  return join(dir, 'usage.json');
};

describe('UsageLogger', () => {
  it('creates the file and appends entries', async () => {
    const file = createTempFile();
    const logger = new UsageLogger(file);

    await logger.record({
      timestamp: '2024-01-01T00:00:00.000Z',
      actionType: 'api',
      action: 'GET /api/me',
      userId: 'alice'
    });
    await logger.record({
      timestamp: '2024-01-01T00:00:01.000Z',
      actionType: 'page',
      action: 'GET /'
    });

    const lines = readFileSync(file, 'utf-8').trim().split('\n');
    expect(lines.length).toBe(2);
    const first = JSON.parse(lines[0]);
    const second = JSON.parse(lines[1]);
    expect(first.action).toBe('GET /api/me');
    expect(first.userId).toBe('alice');
    expect(second.actionType).toBe('page');
  });

  it('rejects invalid events', async () => {
    const file = createTempFile();
    const logger = new UsageLogger(file);
    await expect(
      logger.record({
        // @ts-expect-error intentional for test
        timestamp: '',
        actionType: 'api',
        action: ''
      })
    ).rejects.toBeInstanceOf(Error);
  });
});
