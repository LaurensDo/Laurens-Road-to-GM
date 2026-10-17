// Minimaler Nachbau der GitHub-Contents-API für den Sync-Test (mit CORS wie bei GitHub).
// Aufruf: node tools/mock-github.mjs [Port]
import http from 'node:http';

export function startMockGithub(port = 4180, { token = 'ghp_mock', repo = 'me/sync', isPrivate = true } = {}) {
  const files = new Map();
  let counter = 0;
  const log = [];
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization,content-type,x-github-api-version,accept',
    'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  };
  // Wie GitHub: Lesende Antworten darf der Browser 60 s cachen. Die App muss das umgehen (die App hängt dafür einen wechselnden Parameter an die Adresse).
  const caching = { 'Cache-Control': 'private, max-age=60, s-maxage=60', Vary: 'Accept, Authorization' };
  const send = (res, status, body, type = 'application/json') => {
    res.writeHead(status, { ...cors, ...(res.req.method === 'GET' ? caching : {}), 'Content-Type': type });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    log.push(`${req.method} ${url.pathname}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      return res.end();
    }
    if (url.pathname === '/__state') return send(res, 200, Object.fromEntries([...files].map(([k, v]) => [k, v.text])));
    if (req.headers.authorization !== `Bearer ${token}`) return send(res, 401, { message: 'Bad credentials' });
    const m = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/contents\/(.+))?$/);
    if (!m || `${m[1]}/${m[2]}` !== repo) return send(res, 404, { message: 'Not Found' });
    const path = decodeURIComponent(m[3] ?? '');
    if (!path) return send(res, 200, { private: isPrivate, permissions: { push: true } });
    const file = files.get(path);
    if (req.method === 'GET') {
      if (!file) return send(res, 404, { message: 'Not Found' });
      if ((req.headers.accept ?? '').includes('raw')) return send(res, 200, file.text, 'text/plain');
      return send(res, 200, { type: 'file', sha: file.sha, size: file.text.length, encoding: 'base64', content: Buffer.from(file.text).toString('base64').replace(/(.{60})/g, '$1\n') });
    }
    if (req.method === 'PUT') {
      let data = '';
      req.on('data', (c) => (data += c));
      req.on('end', () => {
        const body = JSON.parse(data);
        if (file && !body.sha) return send(res, 422, { message: "Invalid request. \"sha\" wasn't supplied." });
        if (file && body.sha !== file.sha) return send(res, 409, { message: 'does not match' });
        const sha = `sha${++counter}`;
        files.set(path, { text: Buffer.from(body.content, 'base64').toString('utf8'), sha });
        send(res, file ? 200 : 201, { content: { sha } });
      });
      return;
    }
    send(res, 405, {});
  });
  return new Promise((resolve) => server.listen(port, () => resolve({ server, files, log, close: () => server.close() })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startMockGithub(Number(process.argv[2] ?? 4180));
  console.log('Mock-GitHub läuft auf Port', process.argv[2] ?? 4180);
}
