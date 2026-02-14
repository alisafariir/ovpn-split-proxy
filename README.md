# OSP — OpenVPN Split Proxy

A Windows desktop app that connects via OpenVPN using `.ovpn` config files and either exposes a local SOCKS5 proxy for apps, or routes all system traffic through the VPN.

---

## What is OSP?

OSP is a graphical interface for OpenVPN that lets you:

- Manage `.ovpn` configs (import, save, switch between them).
- Connect to VPN with one click and optionally save username and password per config.
- Choose between two modes:
  - **Proxy:** Only apps that use the SOCKS5 proxy at `127.0.0.1:1080` go through the VPN.
  - **System:** All system traffic goes through the VPN.
- Minimize to the system tray when you close the window; use **Exit** from the tray menu to disconnect VPN and quit the app.

---

## Why does it exist?

- **Simpler OpenVPN usage:** No command line or separate OpenVPN GUI; pick a config, set user/pass if needed, and connect in one window.
- **Proxy vs System choice:** In Proxy mode only selected apps (e.g. browser, Telegram) use the VPN; the rest stays on your normal connection.
- **Local SOCKS5 proxy:** Any app that supports a proxy can use `127.0.0.1:1080` and have its traffic routed through the VPN.

---

## How does it work?

1. You import or select an `.ovpn` file (and optionally username/password) in OSP.
2. When you press **Start**, OSP runs **OpenVPN** on Windows and connects to the VPN server.
3. After the connection is up, it starts a **SOCKS5 server** on `127.0.0.1:1080`.
4. In **Proxy** mode, only connections that go through this proxy use the VPN.
5. In **System** mode, OpenVPN changes the system default route so all traffic uses the VPN (the proxy is still available).
6. **Stop** or **Exit** from the tray menu disconnects the VPN and quits OSP.

---

## OpenVPN is required

**OpenVPN must be available on your Windows system.** OSP only launches and controls OpenVPN; it does not implement the VPN protocol.

- If you **don’t have OpenVPN installed**, download and install it from the official site:  
  **[https://openvpn.net/community-downloads/](https://openvpn.net/community-downloads/)**
- Or place **openvpn.exe** in the project **`bin/`** folder; OSP will use it from there if present.

Setup, run, and build details: **DEVELOP.md**.  

**Documentation in other languages:**  
- **فارسی (Persian):** [docs/README.fa.md](docs/README.fa.md) — you can reuse this content in the repo’s GitHub Wiki (e.g. create a “مستندات فارسی” page).

---

## Features

- Multiple configs with name, username, and password per config; rename, save as new, delete.
- Proxy and System modes.
- SOCKS5 proxy at `127.0.0.1:1080`.
- Minimize to system tray on window close; full exit and VPN disconnect via tray **Exit**.
- Start at Windows login option; warning if not run as Administrator.

---

## License

MIT
