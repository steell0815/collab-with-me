import { createReadStream, existsSync } from 'fs';
import { createServer } from 'http';
import crypto from 'crypto';
import { extname, join } from 'path';
import { URL } from 'url';
import { createRequire } from 'module';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import { v4 as uuid } from 'uuid';
import * as oauth from 'oauth4webapi';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import {
  BoardService,
  Column,
  FileBoardRepository,
  sanitizeTitle,
  sanitizeText
} from './board';
import { SSEHub } from './sseHub';

type Session = { sub: string; name?: string; email?: string };

const oidcConfig = {
  issuer: process.env.OIDC_ISSUER || '',
  clientId: process.env.OIDC_CLIENT_ID || '',
  clientSecret: process.env.OIDC_CLIENT_SECRET || '',
  redirectUri: process.env.OIDC_REDIRECT_URI || '',
  scopes: process.env.OIDC_SCOPES || 'openid profile email',
  sessionSecret: process.env.SESSION_SECRET || 'changeme'
};

const dataFile =
  process.env.BOARD_DATA_FILE || join(process.cwd(), 'data', 'board.json');
const repository = new FileBoardRepository(dataFile);
const hub = new SSEHub();
const boardService = new BoardService(repository, {
  notifyBoardUpdated: (_actor, cards) => {
    hub.broadcast({
      type: 'cardChanged',
      cards
    });
  }
});

const staticCandidates = [
  process.env.STATIC_DIR,
  join(process.cwd(), 'public'),
  join(process.cwd(), 'dist')
].filter((p): p is string => !!p);

const staticDirs = staticCandidates.filter((p) => existsSync(p));

let asMetadata: oauth.AuthorizationServer | null = null;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
const oauthClient: oauth.Client = {
  client_id: oidcConfig.clientId,
  client_secret: oidcConfig.clientSecret || undefined,
  token_endpoint_auth_method: oidcConfig.clientSecret ? 'client_secret_basic' : 'none'
};

const serveFile = (relativePath: string, res: any): boolean => {
  for (const root of staticDirs) {
    const abs = join(root, relativePath);
    if (existsSync(abs)) {
      const ext = extname(abs);
      const contentType =
        ext === '.html'
          ? 'text/html'
          : ext === '.js'
            ? 'text/javascript'
            : ext === '.css'
              ? 'text/css'
              : ext === '.svg'
                ? 'image/svg+xml'
                : 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      createReadStream(abs).pipe(res);
      return true;
    }
  }
  return false;
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

async function ensureOidc() {
  if (!oidcConfig.issuer || !oidcConfig.clientId || !oidcConfig.redirectUri) {
    return null;
  }
  if (!asMetadata) {
    const issuer = new URL(oidcConfig.issuer);
    const discovery = await oauth.discoveryRequest(issuer);
    asMetadata = await oauth.processDiscoveryResponse(issuer, discovery);
    if (!asMetadata.jwks_uri) {
      throw new Error('OIDC jwks_uri missing');
    }
    jwks = createRemoteJWKSet(new URL(asMetadata.jwks_uri));
  }
  return { as: asMetadata, client: oauthClient };
}

function signSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const hmac = crypto.createHmac('sha256', oidcConfig.sessionSecret);
  hmac.update(payload);
  const sig = hmac.digest('base64url');
  return `${payload}.${sig}`;
}

function verifySession(cookieVal?: string | null): Session | null {
  if (!cookieVal) return null;
  const [payload, sig] = cookieVal.split('.');
  if (!payload || !sig) return null;
  const hmac = crypto.createHmac('sha256', oidcConfig.sessionSecret);
  hmac.update(payload);
  const expected = hmac.digest('base64url');
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
  } catch {
    return null;
  }
}

function setSessionCookie(res: any, session: Session) {
  const value = signSession(session);
  const cookie = serializeCookie('session', value, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/'
  });
  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res: any) {
  const cookie = serializeCookie('session', '', {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
  res.setHeader('Set-Cookie', cookie);
}

// No-op placeholder for previous implementation; retained for compatibility
function loadOpenId(): never {
  throw new Error('openid-client Issuer not available');
}

function randomString(length = 32): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

function pkceChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

async function authenticate(req: any, res: any): Promise<Session | undefined> {
  const cookies = req.headers.cookie ? parseCookie(req.headers.cookie) : {};
  const session = verifySession(cookies['session']);
  if (session) return session;

  if (!oidcConfig.issuer || !oidcConfig.clientId || !oidcConfig.redirectUri) {
    return { sub: 'guest' };
  }

  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname === '/login' || url.pathname === '/oidc/callback') return undefined;

  res.writeHead(302, { Location: '/login' });
  res.end();
  return undefined;
}

async function handleLogin(_req: any, res: any) {
  const ctx = await ensureOidc();
  if (!ctx) {
    res.writeHead(500);
    res.end('OIDC not configured');
    return;
  }
  const state = randomString();
  const nonce = randomString();
  const codeVerifier = randomString(64);
  const codeChallenge = pkceChallenge(codeVerifier);
  const authUrl = new URL(ctx.as.authorization_endpoint!);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', oidcConfig.clientId);
  authUrl.searchParams.set('redirect_uri', oidcConfig.redirectUri);
  authUrl.searchParams.set('scope', oidcConfig.scopes);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('nonce', nonce);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const cookiePayload = JSON.stringify({ state, nonce, codeVerifier });
  const cookie = serializeCookie('oidc_state', cookiePayload, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/'
  });
  res.setHeader('Set-Cookie', cookie);
  res.writeHead(302, { Location: authUrl.toString() });
  res.end();
}

async function handleCallback(req: any, res: any) {
  const ctx = await ensureOidc();
  if (!ctx || !jwks) {
    res.writeHead(500);
    res.end('OIDC not configured');
    return;
  }
  const url = new URL(req.url || '', 'http://localhost');
  const cookies = req.headers.cookie ? parseCookie(req.headers.cookie) : {};
  const stateCookie = cookies['oidc_state'] || '';
  let parsed: any = {};
  try {
    parsed = JSON.parse(stateCookie);
  } catch {
    parsed = {};
  }
  const { state, codeVerifier } = parsed || {};
  const params = oauth.validateAuthResponse(ctx.as, ctx.client, url, state);
  if (!(params instanceof URLSearchParams)) {
    const error = (params as any).error || 'Invalid auth response';
    res.writeHead(400);
    res.end(error);
    return;
  }
  try {
    // Manual token request to avoid strict callback parameter branding
    const tokenEndpoint = ctx.as.token_endpoint;
    if (!tokenEndpoint) throw new Error('Missing token endpoint');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.get('code') || '',
      redirect_uri: oidcConfig.redirectUri,
      code_verifier: codeVerifier || ''
    });
    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };
    if (oidcConfig.clientSecret) {
      const basic = Buffer.from(
        `${encodeURIComponent(oidcConfig.clientId)}:${encodeURIComponent(oidcConfig.clientSecret)}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${basic}`;
    } else {
      body.append('client_id', oidcConfig.clientId);
    }

    const tokenRes = await fetch(tokenEndpoint, {
      method: 'POST',
      headers,
      body
    });
    if (!tokenRes.ok) {
      const txt = await tokenRes.text();
      throw new Error(`Token endpoint error: ${txt}`);
    }
    const tokenJson: any = await tokenRes.json();
    const idToken = tokenJson.id_token;
    if (!idToken) throw new Error('Missing id_token');

    const { payload } = await jwtVerify(idToken, jwks, {
      issuer: oidcConfig.issuer,
      audience: oidcConfig.clientId
    });
    const session: Session = {
      sub: (payload.sub as string) || (payload.email as string) || 'user',
      name: payload.name as string | undefined,
      email: payload.email as string | undefined
    };
    setSessionCookie(res, session);
    res.writeHead(302, { Location: '/' });
    res.end();
  } catch (err: any) {
    console.error(err);
    res.writeHead(400);
    res.end('OIDC callback failed');
  }
}

const server = createServer(async (req, res) => {
  try {
    if (!req.url || !req.method) {
      res.writeHead(400).end();
      return;
    }

    const url = new URL(req.url, 'http://localhost');

    const session = await authenticate(req, res);
    if (res.writableEnded) return;
    const authUser = session?.sub;

    if (req.method === 'GET' && url.pathname === '/login') {
      await handleLogin(req, res);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/oidc/callback') {
      await handleCallback(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/logout') {
      clearSessionCookie(res);
      res.writeHead(200);
      res.end('logged out');
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/me') {
      if (!session?.sub) {
        res.writeHead(401).end();
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(session));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/cards') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(boardService.listCards()));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/events') {
      const lastEventIdHeader = req.headers['last-event-id'];
      const lastEventId =
        typeof lastEventIdHeader === 'string' ? Number(lastEventIdHeader) : undefined;
      hub.subscribe(req, res, {
        initialMessage: {
          type: 'cardChanged',
          cards: repository.load()
        },
        lastEventId: Number.isFinite(lastEventId) ? lastEventId : undefined
      });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/cards') {
      const body = await parseBody(req);
      let title = body.title;
      const column = body.column as Column;
      const text = body.text as string | undefined;
      const expanded = body.expanded;
      const user = authUser || body.user;
      if (typeof title !== 'string' || typeof column !== 'string') {
        res.writeHead(400);
        res.end('Invalid payload');
        return;
      }
      try {
        title = sanitizeTitle(title);
      } catch (err: any) {
        res.writeHead(400);
        res.end(err?.message || 'Invalid title');
        return;
      }
      if (!isColumn(column)) {
        res.writeHead(400);
        res.end('Invalid column');
        return;
      }
      let safeText: string | undefined;
      try {
        safeText = sanitizeText(text);
      } catch (err: any) {
        res.writeHead(400);
        res.end(err?.message || 'Invalid text');
        return;
      }
      if (typeof user !== 'string' || user.trim() === '') {
        res.writeHead(401);
        res.end('User required');
        return;
      }
      const card = boardService.createCard(user, {
        title,
        column,
        text: safeText,
        expanded
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(card));
      return;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/cards/move') {
      const body = await parseBody(req);
      let title = body.title;
      const column = body.column as Column;
      const user = authUser || body.user;
      if (typeof title !== 'string' || typeof column !== 'string') {
        res.writeHead(400);
        res.end('Invalid payload');
        return;
      }
      try {
        title = sanitizeTitle(title);
      } catch (err: any) {
        res.writeHead(400);
        res.end(err?.message || 'Invalid title');
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

    if (req.method === 'PATCH' && url.pathname === '/api/cards/text') {
      const body = await parseBody(req);
      let title = body.title;
      const text = body.text as string | undefined;
      const user = authUser || body.user;
      if (typeof title !== 'string') {
        res.writeHead(400);
        res.end('Invalid payload');
        return;
      }
      try {
        title = sanitizeTitle(title);
      } catch (err: any) {
        res.writeHead(400);
        res.end(err?.message || 'Invalid title');
        return;
      }
      let safeText: string | undefined;
      try {
        safeText = sanitizeText(text);
      } catch (err: any) {
        res.writeHead(400);
        res.end(err?.message || 'Invalid text');
        return;
      }
      if (typeof user !== 'string' || user.trim() === '') {
        res.writeHead(401);
        res.end('User required');
        return;
      }
      try {
        const card = boardService.updateText(user, title, safeText);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(card));
      } catch (err: any) {
        res.writeHead(404);
        res.end(err?.message || 'Card not found');
      }
      return;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/cards/expanded') {
      const body = await parseBody(req);
      let title = body.title;
      const expanded = body.expanded;
      const user = authUser || body.user;
      if (typeof title !== 'string' || typeof expanded !== 'boolean') {
        res.writeHead(400);
        res.end('Invalid payload');
        return;
      }
      try {
        title = sanitizeTitle(title);
      } catch (err: any) {
        res.writeHead(400);
        res.end(err?.message || 'Invalid title');
        return;
      }
      if (typeof user !== 'string' || user.trim() === '') {
        res.writeHead(401);
        res.end('User required');
        return;
      }
      try {
        const card = boardService.updateExpanded(user, title, expanded);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(card));
      } catch (err: any) {
        res.writeHead(404);
        res.end(err?.message || 'Card not found');
      }
      return;
    }

    if (req.method === 'PATCH' && url.pathname === '/api/cards/title') {
      const body = await parseBody(req);
      let oldTitle = body.oldTitle;
      let newTitle = body.newTitle;
      const user = authUser || body.user;
      if (typeof oldTitle !== 'string' || typeof newTitle !== 'string') {
        res.writeHead(400);
        res.end('Invalid payload');
        return;
      }
      try {
        oldTitle = sanitizeTitle(oldTitle);
        newTitle = sanitizeTitle(newTitle);
      } catch (err: any) {
        res.writeHead(400);
        res.end(err?.message || 'Invalid title');
        return;
      }
      if (typeof user !== 'string' || user.trim() === '') {
        res.writeHead(401);
        res.end('User required');
        return;
      }
      try {
        const card = boardService.updateTitle(user, oldTitle, newTitle);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(card));
      } catch (err: any) {
        res.writeHead(404);
        res.end(err?.message || 'Card not found');
      }
      return;
    }

    if (req.method === 'DELETE' && url.pathname === '/api/cards') {
      const body = await parseBody(req);
      let title = body.title;
      const user = authUser || body.user;
      if (typeof title !== 'string') {
        res.writeHead(400);
        res.end('Title required');
        return;
      }
      try {
        title = sanitizeTitle(title);
      } catch (err: any) {
        res.writeHead(400);
        res.end(err?.message || 'Invalid title');
        return;
      }
      if (typeof user !== 'string' || user.trim() === '') {
        res.writeHead(401);
        res.end('User required');
        return;
      }
      try {
        boardService.deleteCard(user, title);
        res.writeHead(204);
        res.end();
      } catch (err: any) {
        res.writeHead(404);
        res.end(err?.message || 'Card not found');
      }
      return;
    }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      if (!serveFile('index.html', res)) {
        res.writeHead(404);
        res.end('Not found');
      }
      return;
    }

    if (req.method === 'GET') {
      const pathname = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
      if (serveFile(pathname, res)) {
        return;
      }
    }

    if (req.method === 'GET' && url.pathname === '/favicon.svg') {
      if (serveFile('favicon.svg', res)) {
        return;
      }
    }

    if (req.method === 'GET' && url.pathname === '/logo-smarter.svg') {
      if (serveFile('logo-smarter.svg', res)) {
        return;
      }
    }

    if (req.method === 'GET') {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
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

setInterval(() => hub.heartbeat(), 15000);

function isColumn(value: string): value is Column {
  return value === 'Todo' || value === 'In Progress' || value === 'Done' || value === 'Waste';
}
