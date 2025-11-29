import { describe, expect, it } from 'vitest';
import { SSEHub } from '../../src/sseHub';
import { PassThrough } from 'stream';
import { IncomingMessage, ServerResponse } from 'http';

const createFakeRes = () => {
  const stream = new PassThrough();
  const res = new ServerResponse({} as IncomingMessage);
  res.assignSocket(stream as any);
  return { res, stream };
};

describe('SSEHub', () => {
  it('broadcasts messages to subscribers', async () => {
    const hub = new SSEHub();
    const { res, stream } = createFakeRes();
    stream.resume();
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(Buffer.from(c)));

    hub.subscribe(
      {
        on() {
          return this;
        }
      } as unknown as IncomingMessage,
      res,
      { type: 'cardChanged', cards: [] }
    );
    hub.broadcast({ type: 'cardChanged', cards: [{ id: 1 }] });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const output = Buffer.concat(chunks).toString();
    expect(output).toContain('cardChanged');
  });
});
