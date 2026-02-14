# OSP — OpenVPN Split Proxy

A Windows desktop app that connects via OpenVPN using `.ovpn` config files and either exposes a local SOCKS5 proxy for apps, or routes all system traffic through the VPN.

---

## What is OSP?

OSP is a graphical interface for OpenVPN that lets you:

- Manage `.ovpn` configs (import, save, switch between them).
- Connect to VPN with one click and optionally save username and password per config.
- Choose between two modes:
  - **Proxy Mode:** A built-in **SOCKS5 server** listens on `127.0.0.1:1080`. Apps that use this proxy have their traffic routed through the VPN.
  - **System Mode:** OpenVPN runs normally (full tunnel). Entire system traffic goes through the VPN.
- Minimize to the system tray when you close the window; use **Exit** from the tray menu to disconnect VPN and quit the app.

---

## Why does it exist?

- **Simpler OpenVPN usage:** No command line or separate OpenVPN GUI; pick a config, set user/pass if needed, and connect in one window.
- **Proxy vs System choice:** Apps that use the proxy (127.0.0.1:1080) go through the VPN; others use system-wide routing.
- **Local SOCKS5 proxy:** Any app that supports a proxy can use `127.0.0.1:1080` and have its traffic routed through the VPN.

---

## How does it work?

1. You import or select an `.ovpn` file (and optionally username/password) in OSP.
2. When you press **Start**, OSP runs **OpenVPN** on Windows and connects to the VPN server.
3. **Proxy Mode & System Mode:** Both route all traffic through the VPN. SOCKS5 listens on 127.0.0.1:1080.
4. **System Mode:** OpenVPN runs normally (no `--route-nopull`). Full tunnel — entire system traffic goes through the VPN.
5. **Stop** or **Exit** from the tray menu disconnects the VPN and quits OSP.

---

## OpenVPN is required

**OpenVPN must be available on your Windows system.** OSP only launches and controls OpenVPN; it does not implement the VPN protocol.

- **Option 1:** Download and install OpenVPN from the official site:  
  **[https://openvpn.net/community-downloads/](https://openvpn.net/community-downloads/)**
- **Option 2:** Download and install from this repo: get **`bin/OpenVPN.msi`** (or **`bin/openVPN.msi`**) from the repository and run the installer. OSP will use OpenVPN from your system, or from the **`bin/`** folder if **openvpn.exe** is placed there.

## Windows Defender

If Defender blocks or quarantines files, either:

1. **Add exclusion:** Settings → Windows Security → Virus & threat protection → Manage settings → Exclusions → Add folder → select the project's `bin` folder.
2. **Or remove unused tools:** Delete `gost.exe`, `ForceBindIP64.exe`, `BindIP64.dll` from `bin/` (split tunnel is disabled; these are not used).

Setup, run, and build details: **DEVELOP.md**.  

**Documentation in other languages:**  
- **فارسی (Persian):** [docs/README.fa.md](docs/README.fa.md) — you can reuse this content in the repo’s GitHub Wiki (e.g. create a “مستندات فارسی” page).

---

## Features

- Multiple configs with name, username, and password per config; rename, save as new, delete.
- Proxy and System modes.
- SOCKS5 proxy at `127.0.0.1:1080` (built-in).
- Minimize to system tray on window close; full exit and VPN disconnect via tray **Exit**.
- Start at Windows login option; warning if not run as Administrator.

---

## License

MIT
