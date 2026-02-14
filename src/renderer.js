'use strict';

const configList = document.getElementById('configList');
const btnImport = document.getElementById('btnImport');
const displayName = document.getElementById('displayName');
const username = document.getElementById('username');
const password = document.getElementById('password');
const btnSaveAs = document.getElementById('btnSaveAs');
const btnStart = document.getElementById('btnStart');
const btnStop = document.getElementById('btnStop');
const statusText = document.getElementById('statusText');
const socksAddr = document.getElementById('socksAddr');
const logContainer = document.getElementById('logContainer');
const launchAtLoginCheck = document.getElementById('launchAtLogin');

let configs = [];
let selectedId = null;
let isRunning = false;

function appendLog(level, text) {
  const line = document.createElement('div');
  line.className = 'log-line ' + level;
  line.textContent = text;
  logContainer.appendChild(line);
  logContainer.scrollTop = logContainer.scrollHeight;
}

function setStatus(msg, type) {
  statusText.textContent = msg;
  statusText.style.color = type === 'error' ? '#fca5a5' : type === 'success' ? '#86efac' : 'var(--text)';
}

function setRunning(running) {
  isRunning = running;
  btnStart.disabled = running;
  btnStop.disabled = !running;
  if (running) {
    setStatus('Connected', 'success');
    socksAddr.style.color = 'var(--success)';
  } else {
    setStatus('Ready', '');
    socksAddr.style.color = 'var(--text-muted)';
  }
}

function renderConfigList() {
  configList.innerHTML = '';
  if (configs.length === 0) {
    configList.innerHTML = '<div class="empty-state"><p>No configs yet.</p><p>Click Import to add an .ovpn file.</p></div>';
    return;
  }
  configs.forEach((c) => {
    const el = document.createElement('div');
    el.className = 'config-item' + (c.id === selectedId ? ' active' : '');
    el.dataset.id = c.id;
    const name = document.createElement('span');
    name.textContent = c.displayName || c.id;
    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'config-item-delete';
    btnDel.title = 'Delete config';
    btnDel.textContent = '×';
    btnDel.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteConfig(c.id);
    });
    el.appendChild(name);
    el.appendChild(btnDel);
    el.addEventListener('click', () => selectConfig(c.id));
    configList.appendChild(el);
  });
}

async function loadConfigs() {
  configs = await window.ovpn.configsList();
  renderConfigList();
  const prefs = await window.ovpn.getPrefs();
  if (prefs.lastSelectedConfigId && configs.some((c) => c.id === prefs.lastSelectedConfigId)) {
    selectConfig(prefs.lastSelectedConfigId);
  } else if (configs.length > 0 && !selectedId) {
    selectConfig(configs[0].id);
  } else if (!selectedId) {
    displayName.value = '';
    username.value = '';
    password.value = '';
  }
}

async function selectConfig(id) {
  selectedId = id;
  renderConfigList();
  window.ovpn.savePrefs({ lastSelectedConfigId: id });
  const c = await window.ovpn.configGet(id);
  if (!c) return;
  displayName.value = c.displayName || '';
  username.value = c.username || '';
  password.value = c.password || '';
}

async function deleteConfig(id) {
  const result = await window.ovpn.configDelete(id);
  if (!result.ok) return;
  if (selectedId === id) {
    selectedId = null;
    displayName.value = '';
    username.value = '';
    password.value = '';
  }
  await loadConfigs();
}

function persistCurrentCreds() {
  if (!selectedId) return;
  window.ovpn.configUpdate(selectedId, {
    displayName: displayName.value.trim(),
    username: username.value,
    password: password.value,
  });
}

btnImport.addEventListener('click', async () => {
  const path = await window.ovpn.openFileDialog();
  if (!path) return;
  const result = await window.ovpn.configImport(path);
  if (!result.ok) {
    setStatus('Import failed: ' + result.error, 'error');
    return;
  }
  await loadConfigs();
  selectConfig(result.config.id);
});

displayName.addEventListener('blur', persistCurrentCreds);
username.addEventListener('blur', persistCurrentCreds);
password.addEventListener('blur', persistCurrentCreds);

btnSaveAs.addEventListener('click', async () => {
  if (!selectedId) return;
  const name = displayName.value.trim() || 'Copy';
  const result = await window.ovpn.configSaveAs(selectedId, name);
  if (!result.ok) {
    setStatus('Save failed: ' + result.error, 'error');
    return;
  }
  await loadConfigs();
  selectConfig(result.config.id);
});

btnStart.addEventListener('click', async () => {
  if (!selectedId) {
    setStatus('Select or import a config first', 'error');
    return;
  }
  const c = await window.ovpn.configGet(selectedId);
  if (!c || !c.filePath) {
    setStatus('Config not found', 'error');
    return;
  }
  persistCurrentCreds();
  setStatus('Connecting...', '');
  const modeEl = document.querySelector('input[name="mode"]:checked');
  const result = await window.ovpn.vpnStart({
    configPath: c.filePath,
    username: username.value.trim(),
    password: password.value,
    mode: modeEl ? modeEl.value : 'proxy',
  });
  if (result.ok) {
    setRunning(true);
  } else {
    setStatus(result.error, 'error');
    appendLog('error', result.error);
  }
});

btnStop.addEventListener('click', async () => {
  await window.ovpn.vpnStop();
  setRunning(false);
});

window.ovpn.onLog((data) => appendLog(data.level, data.text));

launchAtLoginCheck.addEventListener('change', () => {
  window.ovpn.setLaunchAtLogin(launchAtLoginCheck.checked);
});

document.querySelectorAll('input[name="mode"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    window.ovpn.savePrefs({ mode: radio.value });
  });
});

loadConfigs();

(async () => {
  launchAtLoginCheck.checked = await window.ovpn.getLaunchAtLogin();
  const prefs = await window.ovpn.getPrefs();
  if (prefs.mode === 'system') {
    document.getElementById('modeSystem').checked = true;
  } else {
    document.getElementById('modeProxy').checked = true;
  }
})();
