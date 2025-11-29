import { IncomingMessage, ServerResponse } from 'http';

type Client = {
  id: number;
  res: ServerResponse;
};

export type SSEMessage =
  | { type: 'cardChanged'; cards: unknown }
  | { type: 'heartbeat' };

type StoredEvent = { id: number; message: SSEMessage };

export class SSEHub {
  private clients = new Map<number, Client>();
  private nextId = 1;
  private nextEventId = 1;
  private history: StoredEvent[] = [];
  private historyLimit = 50;

  subscribe(
    req: IncomingMessage,
    res: ServerResponse,
    options?: { initialMessage?: SSEMessage; lastEventId?: number }
  ): void {
    const id = this.nextId++;
    this.clients.set(id, { id, res });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(`: connected ${id}\n\n`);

    if (options?.initialMessage) {
      this.write(res, options.initialMessage, this.nextEventId);
    }

    if (typeof options?.lastEventId === 'number') {
      const replay = this.history.filter((evt) => evt.id > options.lastEventId);
      replay.forEach((evt) => this.write(res, evt.message, evt.id));
    }

    const cleanup = () => this.unsubscribe(id);
    req.on('close', cleanup);
    req.on('error', cleanup);
  }

  unsubscribe(id: number): void {
    const client = this.clients.get(id);
    if (client) {
      try {
        client.res.end();
      } catch {
        // ignore
      }
    }
    this.clients.delete(id);
  }

  broadcast(message: SSEMessage): void {
    const id = this.nextEventId++;
    this.history.push({ id, message });
    if (this.history.length > this.historyLimit) {
      this.history.shift();
    }
    for (const client of this.clients.values()) {
      this.write(client.res, message, id);
    }
  }

  heartbeat(): void {
    const payload = ': keep-alive\n\n';
    for (const client of this.clients.values()) {
      client.res.write(payload);
    }
  }

  private write(res: ServerResponse, message: SSEMessage, id: number): void {
    res.write(`id: ${id}\n`);
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  }
}
