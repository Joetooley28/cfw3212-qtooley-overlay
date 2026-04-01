Qtooley stock UI ZIP install for Windows

What this ZIP is for
- install or update the Qtooley stock UI overlay on a rooted Casa Systems / DZS `CFW-3212`
- uninstall the overlay later, either overlay-only or full uninstall
- work from a normal Windows PC over SSH with a password prompt

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

Normal uninstall
1. Open PowerShell in the extracted folder.
2. Run:
   - `powershell -ExecutionPolicy Bypass -File .\uninstall_stock_ui_at.ps1`
3. Choose `2` for `SSH`.
4. Choose uninstall mode:
   - `1` overlay only
   - `2` full uninstall including optional runtimes such as Ookla and Tailscale

Notes
- on first install, the installer captures a compact baseline from the router's live stock trees for `/www` and `/usr/share/lua/5.1/webif`
- that baseline is captured only once, before Qtooley live overlay mounts are active, and then reused across updates so uninstall can verify the box is back on its install-time stock files after the overlay is unmounted
- there is also a non-default last-resort installer mode, `FORCE_RECAPTURE_BASELINE=1`, for cases where the saved uninstall baseline is missing or known-bad
- that recapture mode should only be used on a router that is currently showing the stock UI state you want uninstall to restore later
- the install flow refreshes `/usrdata/at-stock-ui`, refreshes the late-start units, and runs the overlay apply immediately
- on this Casa rootfs, the stock web trees are expected to remain unmodified in place, so uninstall returns to stock by unmounting the live overlay trees, then verifies the key shared stock files against the saved install-time baseline, restarts `turbontc`, and removes the payload
- the current baseline verification set includes:
  - `/www/js/generatedMenuEntries.js`
  - `/www/theme/js/genHeader.js`
  - `/usr/share/lua/5.1/webif/top_menu_entries.lua`
  - `/usr/share/lua/5.1/webif/userGroupAuth.lua`
- full uninstall also removes optional runtimes when selected

Offline Ookla bundle
- if this ZIP includes:
  - `router-files\stock-ui-at\usrdata\at-stock-ui\bundles\ookla\ookla-speedtest-1.2.0-linux-armhf.tgz`
  the installer can place Ookla without the router downloading it
- if that archive is missing, the installer leaves Ookla unchanged and you can install it later from the UI or by running the helper on the router

Release ZIP trimming
- the GitHub ZIP intentionally does not include the old `stock-snapshots` reference folder
- first install now captures the smaller install-time stock baseline directly from the router's live stock trees instead

Safety
- if something goes wrong, use the router-side recovery snapshots under `/usrdata/at-stock-ui/recovery-snapshots`
- Device 01 is the development box
- Device 02 is the cleaner compatibility-validation box
- Device 03 should stay protected unless you have a specific reason to touch it
