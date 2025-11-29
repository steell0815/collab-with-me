import { createReadStream, existsSync } from 'fs';
import { createServer } from 'http';
import { extname, join } from 'path';
import { URL } from 'url';
import { BoardService, Column, InMemoryBoardRepository } from './board';

const repository = new InMemoryBoardRepository();
const boardService = new BoardService(repository);

const publicDir = join(process.cwd(), 'public');

const serveFile = (path: string, res: any) => {
  if (!existsSync(path)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  const ext = extname(path);
  const contentType =
    ext === '.html'
      ? 'text/html'
      : ext === '.js'
        ? 'text/javascript'
        : ext === '.css'
          ? 'text/css'
          : 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': contentType });
  createReadStream(path).pipe(res);
};

const parseBody = async (req: any) =>
  new Promise<Record<string, unknown>>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });

const server = createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      res.writeHead(400).end();
      return;
    }

    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/api/cards') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(boardService.listCards()));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/cards') {
      const body = await parseBody(req);
      const title = body.title;
      const column = body.column as Column;
      const user = body.user;
      if (typeof title !== 'string' || typeof column !== 'string') {
        res.writeHead(400);
        res.end('Invalid payload');
        return;
      }
      if (!isColumn(column)) {
        res.writeHead(400);
        res.end('Invalid column');
        return;
      }
      if (typeof user !== 'string' || user.trim() === '') {
        res.writeHead(401);
        res.end('User required');
        return;
      }
      const card = boardService.createCard(user, { title, column });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(card));
      return;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/cards/move') {
      const body = await parseBody(req);
      const title = body.title;
      const column = body.column as Column;
      const user = body.user;
      if (typeof title !== 'string' || typeof column !== 'string') {
        res.writeHead(400);
        res.end('Invalid payload');
        return;
      }
      if (!isColumn(column)) {
        res.writeHead(400);
        res.end('Invalid column');
        return;
      }
      if (typeof user !== 'string' || user.trim() === '') {
        res.writeHead(401);
        res.end('User required');
        return;
      }
      try {
        const card = boardService.moveCard(user, title, column);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(card));
      } catch (err: any) {
        res.writeHead(404);
        res.end(err?.message || 'Card not found');
      }
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      serveFile(join(publicDir, 'index.html'), res);
      return;
    }

    const staticPath = join(publicDir, url.pathname);
    if (req.method === 'GET' && staticPath.startsWith(publicDir)) {
      serveFile(staticPath, res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Internal server error');
  }
});

const port = Number(process.env.PORT || 5173);

server.listen(port, () => {
  console.log(`Feedback server running at http://localhost:${port}`);
});

function isColumn(value: string): value is Column {
  return value === 'Todo' || value === 'In Progress' || value === 'Done' || value === 'Waste';
}
