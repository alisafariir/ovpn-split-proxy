#!/usr/bin/env node
'use strict';

/**
 * Download ForceBindIP and GOST to bin/ for Proxy mode split tunneling on Windows.
 * Run: npm run install-split-tools
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const extract = require('extract-zip');

const binDir = path.join(__dirname, '..', 'bin');
const tmpDir = path.join(os.tmpdir(), 'osp-split-tools-' + Date.now());

const FORCEBINDIP_URL = 'https://r1ch.net/assets/forcebindip/ForceBindIP-1.32.zip';
const GOST_URL = 'https://github.com/go-gost/gost/releases/download/v3.2.6/gost_3.2.6_windows_amd64.zip';

function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const doReq = (targetUrl) => {
      const file = fs.createWriteStream(destPath);
      https.get(targetUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) OSP/1.0' } }, (res) => {
        if (res.statusCode === 302 || res.statusCode === 301) {
          const loc = res.headers.location;
          if (loc) {
            file.close();
            try { fs.unlinkSync(destPath); } catch (_) {}
            return doReq(loc);
          }
        }
        if (res.statusCode !== 200) {
          file.close();
          try { fs.unlinkSync(destPath); } catch (_) {}
          return reject(new Error('HTTP ' + res.statusCode));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve(destPath);
        });
      }).on('error', (err) => {
        file.close();
        try { fs.unlinkSync(destPath); } catch (_) {}
        reject(err);
      });
    };
    doReq(url);
  });
}

function unzip(zipPath, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  return extract(zipPath, { dir: path.resolve(outDir) });
}

function findFile(dir, pred) {
  if (!fs.existsSync(dir)) return null;
  const names = fs.readdirSync(dir);
  for (const n of names) {
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) {
      const found = findFile(p, pred);
      if (found) return found;
    } else if (pred(n)) {
      return p;
    }
  }
  return null;
}

async function run() {
  if (process.platform !== 'win32') {
    console.log('Split tunnel tools are for Windows only. Skipping.');
    return;
  }

  console.log('Installing ForceBindIP and GOST for Proxy mode split tunneling...\n');
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(tmpDir, { recursive: true });

  try {
    console.log('1. Downloading ForceBindIP...');
    const fbZip = path.join(tmpDir, 'ForceBindIP.zip');
    await downloadToFile(FORCEBINDIP_URL, fbZip);
    console.log('   Extracting...');
    await unzip(fbZip, path.join(tmpDir, 'fb'));
    const fbExe = findFile(path.join(tmpDir, 'fb'), (n) => n === 'ForceBindIP64.exe');
    const fbDll64 = findFile(path.join(tmpDir, 'fb'), (n) => n === 'BindIP64.dll');
    const fbDll = findFile(path.join(tmpDir, 'fb'), (n) => n === 'BindIP.dll');
    if (fbExe) fs.copyFileSync(fbExe, path.join(binDir, 'ForceBindIP64.exe'));
    if (fbDll64) fs.copyFileSync(fbDll64, path.join(binDir, 'BindIP64.dll'));
    else if (fbDll) fs.copyFileSync(fbDll, path.join(binDir, 'BindIP.dll'));
    console.log('   ForceBindIP installed.\n');

    console.log('2. Downloading GOST...');
    const gostZip = path.join(tmpDir, 'gost.zip');
    await downloadToFile(GOST_URL, gostZip);
    console.log('   Extracting...');
    await unzip(gostZip, path.join(tmpDir, 'gost'));
    const gostExe = findFile(path.join(tmpDir, 'gost'), (n) => n.endsWith('.exe'));
    if (gostExe) fs.copyFileSync(gostExe, path.join(binDir, 'gost.exe'));
    console.log('   GOST installed.\n');

    console.log('Done! bin/ now has ForceBindIP64.exe, BindIP64.dll, gost.exe');
    console.log('Proxy mode will use split tunneling (only proxy via VPN).');
  } catch (err) {
    console.error('Error:', err.message);
    if (err.message.includes('gost') || err.message.includes('virus') || err.message.includes('UNKNOWN')) {
      console.log('\nTip: Windows Defender may block GOST. Try:');
      console.log('  1. Add exclusion: Settings > Virus protection > Add exclusion > folder: ' + path.resolve(binDir));
      console.log('  2. Or manually: Download gost from GitHub releases, extract gost.exe to bin/');
    }
    process.exit(1);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch (_) {}
  }
}

run();
