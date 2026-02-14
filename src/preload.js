'use strict';

const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('ovpn', {
  getPrefs: () => ipcRenderer.invoke('get-prefs'),
  savePrefs: (prefs) => ipcRenderer.invoke('save-prefs', prefs),
  getLaunchAtLogin: () => ipcRenderer.invoke('get-launch-at-login'),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('set-launch-at-login', enabled),
  vpnStart: (opts) => ipcRenderer.invoke('vpn-start', opts),
  vpnStop: () => ipcRenderer.invoke('vpn-stop'),
  getPathForFile: (file) => (file ? webUtils.getPathForFile(file) : ''),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  configsList: () => ipcRenderer.invoke('configs-list'),
  configGet: (id) => ipcRenderer.invoke('config-get', id),
  configImport: (sourcePath) => ipcRenderer.invoke('config-import', sourcePath),
  configUpdate: (id, updates) => ipcRenderer.invoke('config-update', id, updates),
  configSaveAs: (id, newDisplayName) => ipcRenderer.invoke('config-save-as', id, newDisplayName),
  configDelete: (id) => ipcRenderer.invoke('config-delete', id),
  onLog: (fn) => {
    const handler = (_, data) => fn(data);
    ipcRenderer.on('log', handler);
    return () => ipcRenderer.removeListener('log', handler);
  },
});
