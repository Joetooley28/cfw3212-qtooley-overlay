Qtooley stock UI ZIP install for Windows

What this ZIP is for
- install or update the Qtooley stock UI overlay on a rooted Casa Systems `CFW-3212`
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

Validation checkpoint
- On 2026-04-02, the current end-to-end flow was verified on a documented synthetic stock-like baseline:
  - install from a documented synthetic stock-like baseline
  - bundled Ookla included with the base install
  - optional Tailscale install afterward
  - full uninstall removing Qtooley, bundled Ookla, and Tailscale
- After full uninstall, the router was verified back on the synthetic stock-like baseline with:
  - no `/usrdata/at-stock-ui`
  - no active overlay binds
  - no leftover bundled Ookla binary
  - no leftover Tailscale paths
  - no Qtooley dark-mode/shared-stock refs in the live stock shell
- Stock UI backup/restore was also spot-checked after uninstall by successfully downloading a stock backup archive from the stock UI.
- User-facing meaning:
  - uninstall returns the router to the install-time pre-Qtooley state captured from that router
  - this is stronger than “remove the overlay” and more accurate than claiming universal factory-stock restoration
