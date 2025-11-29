import { IncomingMessage, ServerResponse } from 'http';

type Client = {
  id: number;
  res: ServerResponse;
};

export type SSEMessage =
  | { type: 'cardChanged'; cards: unknown }
  | { type: 'heartbeat' };

export class SSEHub {
  private clients = new Map<number, Client>();
  private nextId = 1;

  subscribe(req: IncomingMessage, res: ServerResponse): void {
    const id = this.nextId++;
    this.clients.set(id, { id, res });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(`: connected ${id}\n\n`);

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
    const payload = `data: ${JSON.stringify(message)}\n\n`;
    for (const client of this.clients.values()) {
      client.res.write(payload);
    }
  }

  heartbeat(): void {
    const payload = ': keep-alive\n\n';
    for (const client of this.clients.values()) {
      client.res.write(payload);
    }
  }
}
