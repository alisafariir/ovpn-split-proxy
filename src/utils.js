'use strict';

const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

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
};
