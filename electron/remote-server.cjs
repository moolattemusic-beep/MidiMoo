/**
 * The server that hands the instrument's own interface to a phone.
 *
 * It serves the same built bundle the desktop window loads, and holds a
 * WebSocket open to each phone. It keeps no state of its own beyond who is
 * connected and what each of them is holding down — that last part matters more
 * than it sounds: if a phone disappears mid-chord, someone has to send the
 * note-offs it now never will.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { WebSocketServer } = require('ws');
const { HeldGestures, resolveFile } = require('./remote-safety.cjs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

const PING_MS = 2000;
const SILENCE_MS = 5000;

/** The address a phone on the same network can actually reach. */
function lanAddress() {
  const preferred = [];
  const rest = [];
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      // Wi-Fi first: it is the one the phone is almost certainly on.
      (name.startsWith('en') ? preferred : rest).push(address.address);
    }
  }
  return preferred[0] ?? rest[0] ?? '127.0.0.1';
}

/**
 * @param {object} options
 * @param {number} options.port
 * @param {string} options.distDir      where the built bundle lives
 * @param {string|null} options.devUrl  in development the phone loads from Vite instead
 * @param {(fn: string, args: any[]) => void} options.onCommand
 * @param {(releases: Array<{fn: string, args: any[]}>) => void} options.onClientGone
 * @param {() => void} options.onWantsSnapshot
 * @param {(status: object) => void} options.onStatus
 * @param {(fn: unknown) => boolean} options.isAllowed
 */
function createRemoteServer(options) {
  const { port, distDir, devUrl, onCommand, onClientGone, onWantsSnapshot, onStatus, isAllowed } = options;

  const held = new WeakMap();
  const alive = new WeakMap();

  const server = http.createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end('bad request');
      return;
    }

    const file = resolveFile(distDir, pathname);
    if (!file) {
      response.writeHead(403).end('forbidden');
      return;
    }

    fs.readFile(file, (error, contents) => {
      if (error) {
        response.writeHead(404, { 'Content-Type': 'text/plain' }).end('not found');
        return;
      }
      const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
      if (path.basename(file) === 'index.html') {
        // How the bundle knows which of the two it is. The desktop loads the
        // same files over file://, where this line is absent.
        const marked = contents
          .toString('utf8')
          .replace('<body>', '<body>\n    <script>window.__MIDIMOO_REMOTE__ = true;</script>');
        response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }).end(marked);
        return;
      }
      response.writeHead(200, { 'Content-Type': type }).end(contents);
    });
  });

  const sockets = new WebSocketServer({ server });

  const announce = () => onStatus?.({
    running: true,
    url: `http://${lanAddress()}:${port}`,
    devUrl,
    clients: sockets.clients.size,
  });

  sockets.on('connection', (socket) => {
    held.set(socket, new HeldGestures());
    alive.set(socket, Date.now());
    onWantsSnapshot?.();
    announce();

    socket.on('message', (raw) => {
      alive.set(socket, Date.now());
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (message?.t === 'pong') return;
      if (message?.t !== 'cmd') return;
      // The socket is open to the local network, so only the listed commands
      // get through — this is the boundary, not the phone's good manners.
      if (!isAllowed(message.fn) || !Array.isArray(message.args)) return;
      held.get(socket)?.record(message.fn, message.args);
      onCommand(message.fn, message.args);
    });

    const finish = () => {
      const gestures = held.get(socket);
      const releases = gestures ? gestures.releases() : [];
      held.delete(socket);
      alive.delete(socket);
      // Whatever it was holding when it vanished is owed a note-off. Without
      // this a phone going out of range leaves a chord sounding for good.
      if (releases.length) onClientGone?.(releases);
      announce();
    };
    socket.on('close', finish);
    socket.on('error', finish);
  });

  // A dropped Wi-Fi connection does not always close the socket, so silence is
  // what counts as gone rather than a close event.
  const heartbeat = setInterval(() => {
    const now = Date.now();
    for (const socket of sockets.clients) {
      if (now - (alive.get(socket) ?? now) > SILENCE_MS) {
        socket.terminate();
        continue;
      }
      try { socket.send(JSON.stringify({ t: 'ping' })); } catch { /* it is going anyway */ }
    }
  }, PING_MS);

  const broadcast = (message) => {
    const payload = JSON.stringify(message);
    for (const socket of sockets.clients) {
      if (socket.readyState === socket.OPEN) {
        try { socket.send(payload); } catch { /* dropped; the heartbeat will clear it */ }
      }
    }
  };

  const stop = () => new Promise((resolve) => {
    clearInterval(heartbeat);
    for (const socket of sockets.clients) socket.terminate();
    sockets.close(() => server.close(() => {
      onStatus?.({ running: false, url: null, devUrl, clients: 0 });
      resolve();
    }));
  });

  const start = () => new Promise((resolve, reject) => {
    server.once('error', reject);
    // 0.0.0.0 rather than localhost: the whole point is that another device reaches it.
    server.listen(port, '0.0.0.0', () => {
      server.removeListener('error', reject);
      announce();
      resolve({ running: true, url: `http://${lanAddress()}:${port}`, devUrl, clients: 0 });
    });
  });

  return { start, stop, broadcast, address: () => `http://${lanAddress()}:${port}` };
}

module.exports = { createRemoteServer, lanAddress };
