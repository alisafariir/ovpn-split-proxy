'use strict';

const net = require('net');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 1080;

/**
 * Minimal SOCKS5 server (no auth). Forwards connections; when VPN is up, system routing sends traffic through VPN.
 * Returns a net.Server; call .close() to stop.
 */
function createSocks5Server(options, onLog) {
  const opts = options || {};
  const host = opts.host || DEFAULT_HOST;
  const port = opts.port || DEFAULT_PORT;
  const log = (level, msg) => {
    if (typeof onLog === 'function') onLog(level, msg);
  };

  const server = net.createServer((clientSocket) => {
    let state = 'greeting';
    let targetSocket = null;
    let buf = Buffer.alloc(0);

    function tryRequest(data) {
      if (data.length < 7) return 0;
      if (data[0] !== 0x05 || data[1] !== 0x01) {
        clientSocket.end();
        return -1;
      }
      let targetHost = '';
      let hostLen = 0;
      const atype = data[3];
      if (atype === 1) {
        if (data.length < 10) return 0;
        targetHost = data[4] + '.' + data[5] + '.' + data[6] + '.' + data[7];
        hostLen = 10;
      } else if (atype === 3) {
        hostLen = 4 + 1 + data[4] + 2;
        if (data.length < hostLen) return 0;
        targetHost = data.slice(5, 5 + data[4]).toString();
      } else if (atype === 4) {
        if (data.length < 22) return 0;
        const parts = [];
        for (let i = 0; i < 16; i += 2) parts.push(data.slice(4 + i, 6 + i).toString('hex'));
        targetHost = parts.join(':');
        hostLen = 22;
      } else {
        clientSocket.end();
        return -1;
      }
      const targetPort = data.readUInt16BE(hostLen - 2);

      const connOpts = { host: targetHost, port: targetPort };
      if (opts && opts.localAddress) connOpts.localAddress = opts.localAddress;
      targetSocket = net.createConnection(connOpts, () => {
        clientSocket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
      });

      targetSocket.on('data', (chunk) => clientSocket.write(chunk));
      targetSocket.on('end', () => clientSocket.end());
      targetSocket.on('error', () => { try { clientSocket.end(); } catch (_) {} });
      clientSocket.on('end', () => targetSocket && targetSocket.end());
      clientSocket.on('error', () => { try { if (targetSocket) targetSocket.destroy(); } catch (_) {} });
      return hostLen;
    }

    clientSocket.on('data', (data) => {
      if (state === 'done') {
        targetSocket && targetSocket.write(data);
        return;
      }
      buf = Buffer.concat([buf, data]);
      if (state === 'greeting') {
        if (buf.length < 2) return;
        if (buf[0] !== 0x05) {
          clientSocket.end();
          return;
        }
        const nmethods = buf[1];
        if (buf.length < 2 + nmethods) return;
        clientSocket.write(Buffer.from([0x05, 0x00]));
        buf = buf.slice(2 + nmethods);
        state = 'request';
      }
      if (state === 'request' && buf.length >= 7) {
        const consumed = tryRequest(buf);
        if (consumed > 0) {
          state = 'done';
          if (buf.length > consumed) targetSocket && targetSocket.write(buf.slice(consumed));
        } else if (consumed === -1) return;
      }
    });

    clientSocket.on('error', () => {});
  });

  server.listen(port, host, () => {});
  server.on('error', (err) => {
    log('error', 'SOCKS5 server error: ' + err.message);
  });

  return server;
}

module.exports = {
  createSocks5Server,
  DEFAULT_HOST,
  DEFAULT_PORT,
};
