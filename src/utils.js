'use strict';

const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const { execSync, spawn } = require('child_process');

const binDir = path.join(__dirname, '..', 'bin');

function info(msg) {
  console.log(chalk.blue('[INFO]'), msg);
}

function success(msg) {
  console.log(chalk.green('[OK]'), msg);
}

function error(msg) {
  console.error(chalk.red('[ERROR]'), msg);
}

/** Paths to check for openvpn.exe (./bin first, then Windows install paths after .msi install). */
function openvpnSearchPaths() {
  const paths = [path.join(binDir, 'openvpn.exe')];
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  paths.push(path.join(programFiles, 'OpenVPN', 'bin', 'openvpn.exe'));
  paths.push(path.join(programFilesX86, 'OpenVPN', 'bin', 'openvpn.exe'));
  return paths;
}

function openvpnPath() {
  const found = openvpnSearchPaths().find((p) => fs.existsSync(p));
  return found || path.join(binDir, 'openvpn.exe');
}

function tun2socksPath() {
  return path.join(binDir, 'tun2socks.exe');
}

function ensureBinDirExists() {
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }
}

function ensureOpenvpnExists() {
  ensureBinDirExists();
  const exe = openvpnSearchPaths().find((p) => fs.existsSync(p));
  if (!exe) {
    throw new Error(
      'openvpn.exe not found. Either:\n' +
      '  1) Place openvpn.exe in: ' + path.resolve(binDir) + '\n' +
      '  2) Install OpenVPN from the .msi (https://openvpn.net/community-downloads/) and the app will use it from Program Files.'
    );
  }
  return exe;
}

function ensureTun2socksExists() {
  ensureBinDirExists();
  const exe = tun2socksPath();
  if (!fs.existsSync(exe)) {
    throw new Error(
      'tun2socks.exe not found. Place it in: ' + path.resolve(binDir)
    );
  }
  return exe;
}

function ensureConfigExists(configPath) {
  const resolved = path.isAbsolute(configPath) ? configPath : path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(resolved)) {
    throw new Error('Config file not found: ' + resolved);
  }
  return resolved;
}

/** On Windows, try to get the first IPv4 on a TAP/OpenVPN adapter (fallback when log parsing misses it). */
function getWindowsTapIp() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execSync('ipconfig', { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    const blocks = out.split(/\r?\n\r?\n/);
    for (const block of blocks) {
      const lower = block.toLowerCase();
      if (!lower.includes('tap') && !lower.includes('openvpn') && !lower.includes('tun')) continue;
      const m = block.match(/IPv4[^\d]*:\s*(\d+\.\d+\.\d+\.\d+)/i) || block.match(/(\d+\.\d+\.\d+\.\d+)\s*\(Preferred\)/);
      if (m) return m[1];
    }
  } catch (_) {}
  return null;
}

/** On Windows, get the adapter name of the first TAP/OpenVPN interface from ipconfig (e.g. "TAP-Windows Adapter OAS"). */
function getWindowsTapInterfaceName() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execSync('ipconfig', { encoding: 'utf8', windowsHide: true, timeout: 5000 });
    const blocks = out.split(/\r?\n\r?\n/);
    for (const block of blocks) {
      const lower = block.toLowerCase();
      if (!lower.includes('tap') && !lower.includes('openvpn') && !lower.includes('tun')) continue;
      const m = block.match(/adapter\s+([^:\r\n]+):/i);
      if (m) return m[1].trim();
    }
  } catch (_) {}
  return null;
}

/** On Windows, set the TAP adapter interface metric so it is not preferred for default route (Proxy mode). */
function setWindowsTapMetric(metric) {
  if (process.platform !== 'win32') return false;
  const name = getWindowsTapInterfaceName();
  if (!name) return false;
  try {
    execSync(
      `netsh interface ipv4 set interface "${name}" metric=${metric}`,
      { encoding: 'utf8', windowsHide: true, timeout: 5000 }
    );
    return true;
  } catch (_) {
    return false;
  }
}

/** Check if ForceBindIP and GOST are available for split-tunnel Proxy mode. */
function hasForceBindIpAndGost() {
  if (process.platform !== 'win32') return false;
  const forceBindIp = path.join(binDir, 'ForceBindIP64.exe');
  const bindIpDll = path.join(binDir, 'BindIP64.dll');
  const bindIpDllAlt = path.join(binDir, 'BindIP.dll');
  const gostExe = path.join(binDir, 'gost.exe');
  return fs.existsSync(forceBindIp) && (fs.existsSync(bindIpDll) || fs.existsSync(bindIpDllAlt)) && fs.existsSync(gostExe);
}

/**
 * Start GOST SOCKS5 server via ForceBindIP so its outbound connections use the VPN interface.
 * Returns { child } or null on failure. Requires Administrator.
 */
function startSocksWithForceBindIp(vpnIp, port, onLog) {
  if (process.platform !== 'win32') return null;
  const forceBindIp = path.join(binDir, 'ForceBindIP64.exe');
  const gostExe = path.join(binDir, 'gost.exe');
  if (!fs.existsSync(forceBindIp) || !fs.existsSync(gostExe)) return null;
  try {
    const child = spawn(forceBindIp, [vpnIp, gostExe, '-L', 'socks5://127.0.0.1:' + port], {
      cwd: binDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    child.stdout.on('data', (c) => {
      if (typeof onLog === 'function') onLog('info', c.toString().trim());
    });
    child.stderr.on('data', (c) => {
      if (typeof onLog === 'function') onLog('info', c.toString().trim());
    });
    return { child };
  } catch (err) {
    if (typeof onLog === 'function') onLog('error', 'ForceBindIP+GOST: ' + (err.message || err));
    return null;
  }
}

/**
 * On Windows, remove the two "redirect-gateway def1" routes (0.0.0.0/1 and 128.0.0.0/1)
 * that VPN adds. Requires Administrator. Suppresses errors (routes may not exist with route-nopull).
 */
function deleteWindowsVpnDefaultRoutes(vpnGateway) {
  if (process.platform !== 'win32') return false;
  const gw = vpnGateway || '10.8.0.1';
  const opts = { encoding: 'utf8', windowsHide: true, timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] };
  let ok = false;
  try {
    execSync(
      `powershell -NoProfile -Command "Remove-NetRoute -DestinationPrefix '0.0.0.0/1' -NextHop '${gw}' -ErrorAction SilentlyContinue; Remove-NetRoute -DestinationPrefix '128.0.0.0/1' -NextHop '${gw}' -ErrorAction SilentlyContinue"`,
      opts
    );
    ok = true;
  } catch (_) {}
  if (!ok) {
    try {
      execSync('route delete 0.0.0.0 mask 128.0.0.0 ' + gw, opts);
      ok = true;
    } catch (_) {}
    try {
      execSync('route delete 128.0.0.0 mask 128.0.0.0 ' + gw, opts);
      ok = true;
    } catch (_) {}
  }
  return ok;
}

module.exports = {
  info,
  success,
  error,
  binDir,
  openvpnPath,
  tun2socksPath,
  ensureOpenvpnExists,
  ensureTun2socksExists,
  ensureConfigExists,
  getWindowsTapIp,
  getWindowsTapInterfaceName,
  setWindowsTapMetric,
  deleteWindowsVpnDefaultRoutes,
  hasForceBindIpAndGost,
  startSocksWithForceBindIp,
};
