'use strict';

const execa = require('execa');

const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 1080;

/**
 * Spawn tun2socks.exe; onLog(level, text) optional.
 */
function startTun2socks(tun2socksPath, options, onLog) {
  const opts = options || {};
  const host = opts.host || DEFAULT_HOST;
  const port = opts.port || DEFAULT_PORT;
  const listen = host + ':' + port;

  const args = ['-listen', listen];

  const child = execa(tun2socksPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const log = (level, msg) => {
    if (typeof onLog === 'function') onLog(level, msg);
  };

  child.stdout.on('data', (chunk) => {
    const line = chunk.toString().trim();
    if (line) log('info', line);
  });
  child.stderr.on('data', (chunk) => {
    const line = chunk.toString().trim();
    if (line) {
      if (line.toLowerCase().includes('error')) {
        log('error', line);
      } else {
        log('info', line);
      }
    }
  });

  child.on('error', (err) => {
    log('error', 'tun2socks error: ' + err.message);
  });

  log('success', 'SOCKS5 proxy listening on ' + listen);
  return child;
}

module.exports = {
  startTun2socks,
  DEFAULT_HOST,
  DEFAULT_PORT,
};
