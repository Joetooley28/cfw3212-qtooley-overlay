Qtooley stock UI ZIP install for Windows

Important recovery note
- run the normal Qtooley uninstall first
- on first install, the installer captures a compact baseline snapshot from that router's live stock `/www` and `/usr/share/lua/5.1/webif` trees before any Qtooley live overlay mounts are active
- that router-specific baseline is the preferred uninstall and recovery path
- if the saved baseline is missing or known-bad, a separate fallback stock web package is available for emergency recovery
- use the fallback package only if uninstall/manual overlay removal does not leave you with a working stock-style Casa web UI
- the current public fallback stock web package is from a clean post-reset `CFW-3212` stock candidate on firmware `USC_1.1.99.0`
- fallback recovery guide: `..\..\docs\fallback-stock-recovery.md`

What this ZIP is for
- install or update the Qtooley stock UI overlay on a rooted Casa Systems `CFW-3212`
- uninstall the overlay later, either overlay-only or full uninstall
- work from a normal Windows PC over SSH with a password prompt

Which path should you use?
- use the Windows ZIP if the router does not already have a working internet connection, or if you want the proven Windows-assisted install/update/uninstall path from your PC over SSH
- use the direct GitHub command only if the router already has a working internet connection and you want to install, update, or uninstall directly from the router over SSH

Direct GitHub install / update from the router
- for routers that already have working internet access, SSH in and run:
  - `sh -c "$(wget -qO- https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/update_from_github_release.sh)"`
- if the router has `curl` instead of `wget`, use:
  - `sh -c "$(curl -fsSL https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/update_from_github_release.sh)"`
- that GitHub path downloads the latest router release package, verifies the SHA256 when possible, stages it under `/tmp`, and then runs the same packaged router-side install/update core used by the Windows ZIP flow
- after Qtooley is already installed, the same updater remains available on the router at:
  - `/usrdata/at-stock-ui/update_from_github_release.sh`

Direct GitHub uninstall from the router
- if the router already has working internet access, SSH in and run:
  - `sh -c "$(wget -qO- https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/uninstall_from_github_release.sh)"`
- if the router has `curl` instead of `wget`, use:
  - `sh -c "$(curl -fsSL https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/uninstall_from_github_release.sh)"`
- the direct GitHub uninstaller now prompts for the same choice in shell form:
  - default: remove Qtooley and bundled Ookla, keep Tailscale
  - optional: also remove Tailscale
- if you want to skip the prompt and force the choice explicitly, use:
  - keep Tailscale:
    `REMOVE_TAILSCALE=0 /bin/sh /usrdata/at-stock-ui/uninstall_from_github_release.sh`
  - remove Tailscale too:
    `REMOVE_TAILSCALE=1 /bin/sh /usrdata/at-stock-ui/uninstall_from_github_release.sh`
- after Qtooley is already installed, the same uninstaller remains available on the router at:
  - `/usrdata/at-stock-ui/uninstall_from_github_release.sh`

What this ZIP is not for
- it does not root the router
- it does not enable SSH for you
- it does not require SSH keys

Prerequisites
- the router is already rooted
- SSH is already reachable from the Windows PC
- you know the router IP, SSH username, and SSH password
- Windows has the built-in `ssh` client available

Normal install
1. Extract the ZIP.
2. Open PowerShell in the extracted folder.
3. Run:
   - `powershell -ExecutionPolicy Bypass -File .\install_stock_ui_at.ps1`
4. Choose `2` for `SSH`.
5. Enter the router IP, username, and then the password when `ssh` prompts.
6. Answer the simple `y/n` prompts.

Bundled Ookla behavior
- the normal install path now installs the bundled Ookla CLI automatically when the archive is present in the package
- if that archive is missing, the installer leaves Ookla unchanged and reports that state

Normal uninstall
1. Open PowerShell in the extracted folder.
2. Run:
   - `powershell -ExecutionPolicy Bypass -File .\uninstall_stock_ui_at.ps1`
3. Choose `2` for `SSH`.
4. Choose uninstall mode:
   - `1` remove Qtooley and bundled Ookla
   - `2` remove Qtooley, bundled Ookla, and Tailscale

Installed-router direct uninstall commands
- from an SSH shell on the router, install/update:
  - `sh -c "$(wget -qO- https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/update_from_github_release.sh)"`
- curl fallback:
  - `sh -c "$(curl -fsSL https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/update_from_github_release.sh)"`
- from an SSH shell on the router, uninstall with prompt:
  - `sh -c "$(wget -qO- https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/uninstall_from_github_release.sh)"`
- curl fallback:
  - `sh -c "$(curl -fsSL https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/uninstall_from_github_release.sh)"`
- if Qtooley is already installed and you want non-interactive uninstall from the router:
  - keep Tailscale:
    `REMOVE_TAILSCALE=0 /bin/sh /usrdata/at-stock-ui/uninstall_from_github_release.sh`
  - remove Tailscale too:
    `REMOVE_TAILSCALE=1 /bin/sh /usrdata/at-stock-ui/uninstall_from_github_release.sh`

Notes
- on first install, the installer captures a compact baseline from the router's live stock trees for `/www` and `/usr/share/lua/5.1/webif`
- that baseline is captured only once, before Qtooley live overlay mounts are active, and then reused across updates so uninstall can verify the box is back on its install-time stock files after the overlay is unmounted
- the router-native GitHub install/update path uses the same install core and the same first-install baseline rules as the Windows ZIP flow
- the router-native GitHub uninstall path downloads the current router package and runs the same packaged uninstall core used by the Windows ZIP flow
- there is also a non-default last-resort installer mode, `FORCE_RECAPTURE_BASELINE=1`, for cases where the saved uninstall baseline is missing or known-bad
- that recapture mode should only be used on a router that is currently showing the stock UI state you want uninstall to restore later
- the install flow refreshes `/usrdata/at-stock-ui`, refreshes the late-start units, and runs the overlay apply immediately
- on this Casa rootfs, the stock web trees are expected to remain unmodified in place, so uninstall returns to stock by unmounting the live overlay trees, then verifies the key shared stock files against the saved install-time baseline, restarts `turbontc`, and removes the payload
- the current baseline verification set includes:
  - `/www/js/generatedMenuEntries.js`
  - `/www/theme/js/genHeader.js`
  - `/usr/share/lua/5.1/webif/top_menu_entries.lua`
  - `/usr/share/lua/5.1/webif/userGroupAuth.lua`
- bundled Ookla is treated as part of the base Qtooley install/uninstall flow
- Tailscale remains the optional extra
- if Tailscale is kept during uninstall, it remains usable only from the CLI after the Qtooley UI is removed

Offline Ookla bundle
- if this ZIP includes:
  - `router-files\stock-ui-at\usrdata\at-stock-ui\bundles\ookla\ookla-speedtest-1.2.0-linux-armhf.tgz`
  the installer can place Ookla without the router downloading it
- if that archive is missing, the installer leaves Ookla unchanged and you can install it later by using the router-side helper if needed

Release ZIP trimming
- the GitHub ZIP intentionally does not include the old `stock-snapshots` reference folder
- first install now captures the smaller install-time stock baseline directly from the router's live stock trees instead

Safety
- if something goes wrong, use the router-side recovery snapshots under `/usrdata/at-stock-ui/recovery-snapshots`
