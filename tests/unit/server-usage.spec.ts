import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { IncomingMessage, ServerResponse } from 'http';
import { PassThrough } from 'stream';

let usageFile: string;
let requestHandler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;

const readUsageEvents = () => {
  if (!existsSync(usageFile)) return [];
  const content = readFileSync(usageFile, 'utf-8').trim();
  if (!content) return [];
  return content.split('\n').map((line) => JSON.parse(line));
};

const performRequest = async (url: string, headers: Record<string, string> = {}) => {
  const socket = new PassThrough();
  const req = new IncomingMessage(socket as any);
  req.url = url;
  req.method = 'GET';
  req.headers = headers;

  const resStream = new PassThrough();
  const res = new ServerResponse(req);
  res.assignSocket(resStream as any);
  resStream.resume();

  await requestHandler(req, res);
  await new Promise((resolve) => res.on('finish', resolve));
};

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), 'usage-server-'));
  usageFile = join(dir, 'usage.json');
  process.env.NODE_ENV = 'test';
  process.env.BOARD_DATA_FILE = join(dir, 'board.json');
  process.env.USAGE_DATA_FILE = usageFile;
  ({ requestHandler } = await import('../../src/server'));
});

beforeEach(async () => {
  if (existsSync(usageFile)) {
    rmSync(usageFile);
  }
});

describe('server usage logging', () => {
  it('logs page and API requests with metadata', async () => {
    await performRequest('/');
    await performRequest('/api/cards', {
      'user-agent': 'vitest-agent',
      referer: 'http://localhost/test'
    });

    await new Promise((resolve) => setTimeout(resolve, 5));
    const events = readUsageEvents();
    expect(events.length).toBeGreaterThanOrEqual(2);
    const pageEvent = events.find((e: any) => e.action === 'GET /');
    const apiEvent = events.find((e: any) => e.action === 'GET /api/cards');
    expect(pageEvent?.actionType).toBe('page');
    expect(apiEvent?.actionType).toBe('api');
    expect(apiEvent?.userAgent).toContain('vitest-agent');
    expect(apiEvent?.referrer).toContain('http://localhost/test');
    expect(typeof apiEvent?.timestamp).toBe('string');
  });
});
