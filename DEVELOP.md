# OSP — Developer & User Guide (English)

Technical setup, run, and build instructions.

---

## Requirements

- **Windows** only
- **Node.js** 14+ (for development)
- **OpenVPN** must be available on the system (see below)

---

## OpenVPN requirement

**OpenVPN must be installed on your system.** OSP only launches and controls OpenVPN; it does not implement the VPN protocol itself.

- **Option 1 — Install from official site:**  
  Download and install from [https://openvpn.net/community-downloads/](https://openvpn.net/community-downloads/)  
  (e.g. OpenVPN 2.7 64-bit .msi). OSP will use the installed `openvpn.exe` from Program Files.

- **Option 2 — Use `bin/` folder:**  
  Place **openvpn.exe** inside the project’s **`bin/`** folder. OSP will use it from there if present.

If OpenVPN is missing, OSP will show an error when you press Start.

---

## Project layout

```
ovpn-split-proxy/
  main.js
  package.json
  src/
    index.html, preload.js, renderer.js
    vpn.js, socks-server.js, socks.js, utils.js
  assets/icons/   # optional: icon.png
  bin/            # optional: openvpn.exe
  DEVELOP.md
  DEVELOP.fa.md
  README.md
```

---

## Run (development)

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Run as Administrator** (required for OpenVPN to configure the network):

   - Double-click **`run-as-admin.cmd`** in the project folder, or  
   - Open Command Prompt / PowerShell as Administrator, then:
     ```bash
     cd path\to\ovpn-split-proxy
     npm start
     ```

3. In the app: import or select an `.ovpn` config, set username/password if needed, choose **Proxy** or **System** mode, then click **Start**.

---

## Build (Windows exe)

```bash
npm install
npm run build          # NSIS installer + portable exe
npm run build:portable # single portable .exe only
npm run build:dir      # unpacked app in dist/win-unpacked
```

Output is in **`dist/`**. The exe is built with `requestedExecutionLevel: requireAdministrator`.

**GitHub Actions:** On push to `main`, `.github/workflows/release.yml` builds the app and creates a Release with the portable exe. Ensure the repo has Actions enabled.

**Code signing (optional):** To reduce Windows SmartScreen / “unknown publisher” warnings, sign the exe. In CI, set secrets `CSC_LINK` (base64 .pfx) and `CSC_KEY_PASSWORD`, and add `"signAndEditExecutable": true` under `win` in `package.json` → `build`.

---

## Features (technical)

- Config list: import `.ovpn`, save display name, username, password per config; rename / save as new; delete.
- Modes: **Proxy** (only SOCKS5 traffic via VPN) vs **System** (full system routing via VPN).
- Built-in SOCKS5 server on `127.0.0.1:1080`; in Proxy mode outbound connections are bound to the VPN interface.
- System tray: closing the window hides to tray; Exit from tray menu stops VPN and quits the app.
- Launch at login option; no application menu; admin check on startup with dialog and auto-quit on OK.

---

## Error handling

- Missing **openvpn.exe** (in `bin/` or Program Files): error when pressing Start.
- Config file not found: error when starting.
- Connection failure or timeout: message in logs and status bar.
- If the log shows NETSH “command failed”: run the app as Administrator.

---

## License

MIT
