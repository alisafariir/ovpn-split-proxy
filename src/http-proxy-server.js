'use strict';

const net = require('net');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 1080;

/**
 * Minimal HTTP proxy server (no auth). CONNECT for HTTPS, GET/POST etc. for HTTP.
 * options.localAddress = bind outbound to this IP (e.g. VPN IP in proxy mode).
 * Returns a net.Server; call .close() to stop.
 */
function createHttpProxyServer(options, onLog) {
  const opts = options || {};
  const host = opts.host || DEFAULT_HOST;
  const port = opts.port || DEFAULT_PORT;
  const log = (level, msg) => {
    if (typeof onLog === 'function') onLog(level, msg);
  };

  const server = net.createServer((clientSocket) => {
    let buf = Buffer.alloc(0);
    let targetSocket = null;

    function connectOutbound(host, port, onConnect) {
      const connOpts = { host, port };
      if (opts.localAddress) connOpts.localAddress = opts.localAddress;
      const sock = net.createConnection(connOpts, onConnect);
      sock.on('error', (err) => {
        try { clientSocket.end(); } catch (_) {}
      });
      return sock;
    }

    function flush() {
      if (buf.length === 0) return;
      const data = buf;
      buf = Buffer.alloc(0);
      clientSocket.on('data', (chunk) => {
        if (targetSocket && !targetSocket.destroyed) targetSocket.write(chunk);
      });
      clientSocket.on('end', () => { if (targetSocket && !targetSocket.destroyed) targetSocket.end(); });
      clientSocket.on('error', () => { try { if (targetSocket) targetSocket.destroy(); } catch (_) {} });
      targetSocket.on('data', (chunk) => clientSocket.write(chunk));
      targetSocket.on('end', () => clientSocket.end());
      targetSocket.on('error', () => { try { clientSocket.end(); } catch (_) {} });
      targetSocket.write(data);
    }

    clientSocket.on('data', (chunk) => {
      if (targetSocket) {
        targetSocket.write(chunk);
        return;
      }
      buf = Buffer.concat([buf, chunk]);
      const str = buf.toString('binary');
      const idx = str.indexOf('\r\n\r\n');
      if (idx === -1) return;
      const head = str.slice(0, idx);
      const firstLine = head.split('\r\n')[0];
      const method = firstLine.split(/\s+/)[0];
      const urlPart = firstLine.split(/\s+/)[1] || '';

      if (method === 'CONNECT') {
        const match = urlPart.match(/^([^:\s]+):(\d+)$/);
        if (!match) {
          clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
          return;
        }
        const targetHost = match[1];
        const targetPort = parseInt(match[2], 10);
        targetSocket = connectOutbound(targetHost, targetPort, () => {
          clientSocket.write('HTTP/1.1 200 Connection established\r\n\r\n');
          if (buf.length > idx + 4) targetSocket.write(buf.slice(idx + 4));
          buf = Buffer.alloc(0);
          flush();
        });
        return;
      }

      let targetHost = '';
      let targetPort = 80;
      if (urlPart.startsWith('http://')) {
        try {
          const u = new URL(urlPart);
          targetHost = u.hostname;
          targetPort = parseInt(u.port || '80', 10);
        } catch (_) {
          clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
          return;
        }
      }
      if (!targetHost) {
        const hostLine = head.split('\r\n').find((l) => /^Host:\s+/i.test(l));
        if (hostLine) {
          const h = hostLine.replace(/^Host:\s+/i, '').trim().split(':')[0];
          const p = hostLine.replace(/^Host:\s+/i, '').trim().split(':')[1];
          targetHost = h;
          if (p) targetPort = parseInt(p, 10);
        }
      }
      if (!targetHost) {
        clientSocket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        return;
      }

      const path = urlPart.startsWith('http://') ? (() => {
        try {
          const u = new URL(urlPart);
          return u.pathname + (u.search || '');
        } catch (_) { return urlPart; }
      })() : urlPart;

      const newFirstLine = firstLine.replace(urlPart, path);
      const rest = head.split('\r\n').slice(1).join('\r\n');
      const newHead = newFirstLine + '\r\n' + rest + '\r\n\r\n';
      const bodyStart = idx + 4;
      buf = Buffer.concat([Buffer.from(newHead, 'binary'), bodyStart < buf.length ? buf.slice(bodyStart) : Buffer.alloc(0)]);

      targetSocket = connectOutbound(targetHost, targetPort, () => {
        flush();
      });
    });

    clientSocket.on('error', () => {});
  });

  server.listen(port, host, () => {});
  server.on('error', (err) => {
    log('error', 'HTTP proxy error: ' + err.message);
  });

  return server;
}

module.exports = {
  createHttpProxyServer,
  DEFAULT_HOST,
  DEFAULT_PORT,
};
