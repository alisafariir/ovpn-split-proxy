#!/usr/bin/env node
'use strict';

const { Command } = require('commander');
const { info, success, error } = require('./utils');
const {
  ensureOpenvpnExists,
  ensureTun2socksExists,
  ensureConfigExists,
} = require('./utils');
const { startVpn } = require('./vpn');
const { startTun2socks } = require('./socks');

const program = new Command();

program
  .name('ovpn-split')
  .description('Run OpenVPN and expose TUN as local SOCKS5 proxy (Windows)')
  .version('1.0.0');

program
  .command('start <config.ovpn>')
  .description('Start VPN with config file and SOCKS5 proxy on 127.0.0.1:1080')
  .action(async (configPath) => {
    let vpnChild;
    let socksChild;

    function shutdown(signal) {
      info(`Shutting down (${signal})...`);
      if (socksChild && socksChild.pid) {
        socksChild.kill('SIGTERM');
        info('tun2socks stopped');
      }
      if (vpnChild && vpnChild.pid) {
        vpnChild.kill('SIGTERM');
        info('OpenVPN stopped');
      }
      process.exit(0);
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    try {
      const openvpnExe = ensureOpenvpnExists();
      const tun2socksExe = ensureTun2socksExists();
      const resolvedConfig = ensureConfigExists(configPath);

      info(`Starting OpenVPN with config: ${resolvedConfig}`);
      const { child, connected } = startVpn(openvpnExe, resolvedConfig);
      vpnChild = child;

      await connected;
      success('VPN connected.');

      info('Starting tun2socks...');
      socksChild = startTun2socks(tun2socksExe, { host: '127.0.0.1', port: 1080 });
      success('SOCKS5 proxy ready at 127.0.0.1:1080. Press Ctrl+C to stop.');
    } catch (err) {
      error(err.message);
      if (vpnChild && vpnChild.pid) vpnChild.kill('SIGTERM');
      if (socksChild && socksChild.pid) socksChild.kill('SIGTERM');
      process.exit(1);
    }
  });

program.parse();
