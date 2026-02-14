'use strict';

const execa = require('execa');

const CONNECTED_MARKER = 'Initialization Sequence Completed';

/**
 * Spawn openvpn.exe with given args; resolve when connection is established.
 * onLog(level, text) with level in ['info','success','error'].
 * options.cwd = working directory (e.g. dir of .ovpn file) so relative paths in config work.
 * Returns { child, connected }.
 */
function startVpn(openvpnPath, args, onLog, options) {
  const log = (level, msg) => {
    if (typeof onLog === 'function') onLog(level, msg);
  };

  const spawnOpts = {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  };
  if (options && options.cwd) {
    spawnOpts.cwd = options.cwd;
  }

  const child = execa(openvpnPath, args, spawnOpts);

  let assignedIp = null;
  const ifconfigRe = /ifconfig[,\s]+(\d+\.\d+\.\d+\.\d+)/;

  let resolveConnected;
  let didResolve = false;
  const connected = new Promise((resolve, reject) => {
    resolveConnected = () => {
      if (didResolve) return;
      didResolve = true;
      resolve();
    };
    const timeout = setTimeout(() => {
      if (didResolve) return;
      didResolve = true;
      reject(new Error('VPN connection timeout (no "Initialization Sequence Completed" within 120s)'));
    }, 120000);

    const shouldLog = (line) =>
      line.includes('ERROR') || line.includes('WARNING') ||
      line.includes('Initialization') || line.includes('Peer Connection') ||
      line.includes('PUSH_REPLY') || line.includes('TLS:') || line.includes('VERIFY ');
    function handleLine(line) {
      const m = line.match(ifconfigRe);
      if (m) assignedIp = m[1];
      if (line.includes(CONNECTED_MARKER)) {
        clearTimeout(timeout);
        resolveConnected();
      }
      if (shouldLog(line)) log('info', line);
    }
    child.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
      lines.forEach(handleLine);
    });
    child.stderr.on('data', (chunk) => {
      const lines = chunk.toString().split(/\r?\n/).filter(Boolean);
      lines.forEach(handleLine);
    });

    child.on('error', (err) => {
      if (didResolve) return;
      didResolve = true;
      clearTimeout(timeout);
      reject(err);
    });
    child.on('exit', (code, signal) => {
      if (didResolve) return;
      clearTimeout(timeout);
      if (code !== 0 && code !== null) {
        didResolve = true;
        reject(new Error('OpenVPN exited with code ' + code));
      }
    });
  });

  return { child, connected, getAssignedIp: () => assignedIp };
}

module.exports = {
  startVpn,
  CONNECTED_MARKER,
};
