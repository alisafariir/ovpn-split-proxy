'use strict';

const { app, BrowserWindow, ipcMain, dialog, Notification, Menu, Tray, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

/** On Windows, true if process has Administrator rights. */
function isWindowsAdmin() {
  if (process.platform !== 'win32') return true;
  try {
    execSync('net session', { stdio: 'ignore', windowsHide: true });
    return true;
  } catch (_) {
    return false;
  }
}

/** On Windows, get 8.3 short path so paths with spaces work with OpenVPN. */
function getShortPathIfWindows(filePath) {
  if (process.platform !== 'win32' || !filePath || !filePath.includes(' ')) {
    return filePath;
  }
  try {
    const quoted = '"' + filePath.replace(/"/g, '""') + '"';
    const out = execSync('cmd /c for %I in (' + quoted + ') do @echo %~sI', {
      encoding: 'utf8',
      windowsHide: true,
    });
    const shortPath = out.trim();
    return shortPath && shortPath !== filePath ? shortPath : filePath;
  } catch (_) {
    return filePath;
  }
}

const { startVpn } = require('./src/vpn');
const { createSocks5Server } = require('./src/socks-server');
const {
  ensureOpenvpnExists,
  ensureConfigExists,
} = require('./src/utils');

let mainWindow = null;
let tray = null;
let vpnChild = null;
let socksServer = null;
let authFilePath = null;

const PREFS_PATH = path.join(app.getPath('userData'), 'prefs.json');
const CONFIGS_DIR = path.join(app.getPath('userData'), 'configs');
const CONFIGS_JSON = path.join(app.getPath('userData'), 'configs.json');

function ensureConfigsDir() {
  if (!fs.existsSync(CONFIGS_DIR)) fs.mkdirSync(CONFIGS_DIR, { recursive: true });
}

function getConfigsData() {
  try {
    const raw = fs.readFileSync(CONFIGS_JSON, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { configs: [] };
  }
}

function saveConfigsData(data) {
  ensureConfigsDir();
  fs.writeFileSync(CONFIGS_JSON, JSON.stringify(data, null, 2), 'utf8');
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function getPrefs() {
  try {
    const raw = fs.readFileSync(PREFS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { lastSelectedConfigId: '', mode: 'proxy' };
  }
}

function savePrefs(updates) {
  try {
    const current = getPrefs();
    const prefs = { ...current, ...updates };
    fs.writeFileSync(PREFS_PATH, JSON.stringify(prefs, null, 0), 'utf8');
  } catch (_) {}
}

function sendLog(level, text) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('log', { level, text });
  }
}

function killChildren() {
  if (socksServer) {
    try {
      socksServer.close();
    } catch (_) {}
    socksServer = null;
  }
  if (vpnChild && vpnChild.pid) {
    try {
      vpnChild.kill('SIGTERM');
    } catch (_) {}
    vpnChild = null;
  }
  if (authFilePath && fs.existsSync(authFilePath)) {
    try {
      fs.unlinkSync(authFilePath);
    } catch (_) {}
    authFilePath = null;
  }
}

function getAppIconPath() {
  const iconsDir = path.join(__dirname, 'assets', 'icons');
  const ico = path.join(iconsDir, 'icon.ico');
  const png = path.join(iconsDir, 'icon.png');
  if (process.platform === 'win32' && fs.existsSync(ico)) return ico;
  if (fs.existsSync(png)) return png;
  return undefined;
}

function createWindow() {
  const iconPath = getAppIconPath();
  mainWindow = new BrowserWindow({
    width: 700,
    height: 580,
    minWidth: 500,
    minHeight: 400,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'src', 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    if (!isWindowsAdmin()) {
      dialog.showMessageBox(mainWindow, {
        type: 'warning',
        title: 'OSP',
        message: 'Run as Administrator',
        detail: 'OSP needs Administrator rights to configure the VPN. Please close the app and run it as Administrator (right-click → Run as administrator).',
      }).then(() => {
        app.quit();
      });
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    } else {
      killChildren();
    }
  });
}

function createTray() {
  const iconPath = getAppIconPath();
  let icon = null;
  if (iconPath) {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = null;
  }
  if (!icon) {
    const size = 16;
    const buf = Buffer.alloc(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      buf[i * 4] = 99;
      buf[i * 4 + 1] = 102;
      buf[i * 4 + 2] = 241;
      buf[i * 4 + 3] = 255;
    }
    icon = nativeImage.createFromBuffer(buf, { width: size, height: size });
  }
  icon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('OSP');
  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });
  updateTrayMenu();
}

function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show(); } },
    { type: 'separator' },
    { label: 'Exit', click: () => { app.isQuitting = true; killChildren(); tray.destroy(); tray = null; app.quit(); } },
  ]);
  if (tray && !tray.isDestroyed()) tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  app.setName('OSP');
  Menu.setApplicationMenu(null);
  createWindow();
  createTray();

  app.on('window-all-closed', () => {
    if (!tray || tray.isDestroyed()) {
      killChildren();
      app.quit();
    }
  });
});

ipcMain.handle('get-prefs', () => getPrefs());
ipcMain.handle('save-prefs', (_, prefs) => savePrefs(prefs));

ipcMain.handle('get-launch-at-login', () => {
  return app.getLoginItemSettings().openAtLogin;
});
ipcMain.handle('set-launch-at-login', (_, enabled) => {
  app.setLoginItemSettings({ openAtLogin: !!enabled });
});

ipcMain.handle('open-file-dialog', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const result = await dialog.showOpenDialog(win || null, {
    properties: ['openFile'],
    filters: [{ name: 'OpenVPN Config', extensions: ['ovpn'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('configs-list', () => {
  const data = getConfigsData();
  return data.configs.map((c) => ({ id: c.id, displayName: c.displayName, username: c.username || '' }));
});

ipcMain.handle('config-get', (_, id) => {
  const data = getConfigsData();
  const c = data.configs.find((x) => x.id === id);
  if (!c || !c.filePath || !fs.existsSync(c.filePath)) return null;
  return {
    id: c.id,
    displayName: c.displayName,
    username: c.username || '',
    password: c.password || '',
    filePath: c.filePath,
  };
});

ipcMain.handle('config-import', async (_, sourcePath) => {
  if (!fs.existsSync(sourcePath)) return { ok: false, error: 'File not found' };
  const id = genId();
  const displayName = path.basename(sourcePath, '.ovpn').replace(/\.ovpn$/i, '') || 'Config';
  const data = getConfigsData();
  data.configs.push({ id, displayName, filePath: sourcePath, username: '', password: '' });
  saveConfigsData(data);
  return { ok: true, config: { id, displayName, username: '' } };
});

ipcMain.handle('config-update', (_, id, updates) => {
  const data = getConfigsData();
  const c = data.configs.find((x) => x.id === id);
  if (!c) return { ok: false };
  if (updates.displayName !== undefined) c.displayName = String(updates.displayName).trim() || c.displayName;
  if (updates.username !== undefined) c.username = updates.username;
  if (updates.password !== undefined) c.password = updates.password;
  saveConfigsData(data);
  return { ok: true };
});

ipcMain.handle('config-save-as', (_, id, newDisplayName) => {
  const data = getConfigsData();
  const c = data.configs.find((x) => x.id === id);
  if (!c || !c.filePath || !fs.existsSync(c.filePath)) return { ok: false, error: 'Config not found' };
  ensureConfigsDir();
  const newId = genId();
  const destPath = path.join(CONFIGS_DIR, newId + '.ovpn');
  fs.copyFileSync(c.filePath, destPath);
  const name = String(newDisplayName).trim() || (c.displayName + ' (copy)');
  data.configs.push({ id: newId, displayName: name, filePath: destPath, username: c.username || '', password: c.password || '' });
  saveConfigsData(data);
  return { ok: true, config: { id: newId, displayName: name, username: c.username || '' } };
});

ipcMain.handle('config-delete', (_, id) => {
  const data = getConfigsData();
  const c = data.configs.find((x) => x.id === id);
  const idx = data.configs.findIndex((x) => x.id === id);
  if (idx === -1) return { ok: false };
  if (c && c.filePath && c.filePath.startsWith(CONFIGS_DIR) && fs.existsSync(c.filePath)) {
    fs.unlinkSync(c.filePath);
  }
  data.configs.splice(idx, 1);
  saveConfigsData(data);
  return { ok: true };
});

ipcMain.handle('vpn-start', async (_, { configPath, username, password, mode }) => {
  if (vpnChild) {
    return { ok: false, error: 'VPN is already running.' };
  }

  let openvpnExe, resolvedConfig;
  try {
    openvpnExe = ensureOpenvpnExists();
    resolvedConfig = ensureConfigExists(configPath);
  } catch (err) {
    return { ok: false, error: err.message };
  }

  if (authFilePath && fs.existsSync(authFilePath)) {
    try {
      fs.unlinkSync(authFilePath);
    } catch (_) {}
  }

  const configForOpenVpn = getShortPathIfWindows(resolvedConfig);
  const configDir = path.dirname(configForOpenVpn);
  const args = ['--config', configForOpenVpn];
  const vpnMode = mode === 'proxy' ? 'proxy' : 'system';
  if (vpnMode === 'proxy') {
    args.push('--pull-filter', 'ignore', 'redirect-gateway');
  }
  if (username !== undefined && String(username).trim() !== '' && password !== undefined) {
    authFilePath = path.join(os.tmpdir(), 'ovpn-split-auth-' + Date.now() + '.txt');
    fs.writeFileSync(authFilePath, String(username).trim() + '\n' + password, 'utf8');
    args.push('--auth-user-pass', authFilePath);
  }

  sendLog('info', 'Starting OpenVPN...');

  const onLog = (level, text) => sendLog(level, text);

  try {
    const result = startVpn(openvpnExe, args, onLog, { cwd: configDir });
    vpnChild = result.child;

    result.child.on('exit', () => {
      vpnChild = null;
    });

    await result.connected;
    sendLog('success', 'VPN connected.');
    const socksOpts = { host: '127.0.0.1', port: 1080 };
    if (vpnMode === 'proxy') {
      const vpnIp = result.getAssignedIp && result.getAssignedIp();
      if (vpnIp) socksOpts.localAddress = vpnIp;
    }
    socksServer = createSocks5Server(socksOpts, onLog);
    sendLog('success', vpnMode === 'proxy' ? 'SOCKS5: 127.0.0.1:1080 (proxy only)' : 'SOCKS5: 127.0.0.1:1080 (system)');
    if (Notification.isSupported()) {
      new Notification({ title: 'OSP', body: 'VPN connected. SOCKS5: 127.0.0.1:1080' }).show();
    }
    return { ok: true };
  } catch (err) {
    killChildren();
    if (err.message && err.message.includes('exited with code 1')) {
      sendLog('info', 'Tip: If the log shows NETSH then "command failed", run this app as Administrator (right-click → Run as administrator).');
    }
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('vpn-stop', () => {
  killChildren();
  sendLog('info', 'VPN and SOCKS5 proxy stopped.');
  if (Notification.isSupported()) {
    new Notification({ title: 'OSP', body: 'VPN disconnected.' }).show();
  }
  return { ok: true };
});
