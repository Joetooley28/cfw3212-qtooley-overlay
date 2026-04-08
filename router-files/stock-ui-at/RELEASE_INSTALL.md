Qtooley install and uninstall guide

Feature status
- cell locking is still under development and is not working yet

Use this page as the full install, update, and uninstall reference.

For the short version first:
- quick summary page: [`../../docs/quick-must-read.md`](../../docs/quick-must-read.md)

Prerequisites
- the router must already be rooted
- full credit to [@Luke](https://github.com/lukejenkins/cellular/tree/main/casasystems/cfw3212) for the root script and the broader `CFW-3212` platform research
- if you need the root script itself, start in Luke's [`casasystems/cfw3212/tools`](https://github.com/lukejenkins/cellular/tree/main/casasystems/cfw3212/tools) folder
- if you are starting from a stock carrier-managed box, also read Luke's [`guide_block_carrier_remote_mgmt`](https://github.com/lukejenkins/cellular/blob/main/casasystems/cfw3212/guide_block_carrier_remote_mgmt.md) to block the carrier remote-management path
- SSH must already be reachable
- you need the router IP, SSH username, and SSH password
- Windows needs the built-in `ssh` client available
- the public Windows installer flow is SSH-only

Choose your install path
- if the router does not already have working internet, use the Windows ZIP path from your PC over SSH
- if the router already has working internet, you can either keep using the Windows ZIP path or run the direct GitHub commands from an SSH shell on the router

Install behavior
- on first install, the installer captures a compact router-specific stock baseline from the live stock `/www` and `/usr/share/lua/5.1/webif` trees before any Qtooley overlay mounts are active
- that first-install baseline is then reused across normal updates so uninstall can verify the router is back on its install-time stock web files after the overlay is removed
- install treats the router as already baselined only when these saved files exist under `/usrdata/at-stock-ui/installer-state/install-baseline`:
  - `install_www.tar`
  - `install_webif.tar`
- baseline metadata is also recorded in `/usrdata/at-stock-ui/installer-state/installer-baseline-info.txt`
- do not use `FORCE_RECAPTURE_BASELINE=1` unless the saved baseline is missing or known-bad and the router is already showing the stock state you want uninstall to restore later

Space note
- first install stores a router-specific stock baseline under `/usrdata` in addition to the base Qtooley payload
- real Box 2 measurement for Qtooley with bundled Ookla installed was about `13.7 MB` under `/usrdata/at-stock-ui`
- the bundled Ookla `speedtest` binary itself was about `2.2 MB`
- Tailscale is a separate optional runtime under `/usrdata/tailscale` and should be treated as about `60 MB` of additional space
- practical recommendation: try to have at least `20 MB` free for the base install and more if you plan to add optional runtimes later
- if space is tight, clean up old files first instead of trying to install with only a few MB left

Important cleanup note
- on one of my units, most of the missing space turned out to be a staged firmware file named `upgrade.star` under `/cache/upgrade.star` and `/usrdata/cache/upgrade.star`
- in that logged case, `upgrade.star` was about `104 MB`
- if you find one, pull and save an off-box copy before deleting it
- before deleting a file like that, save an off-box copy first and record its SHA-256 hash if you can, because it may be a useful stock firmware artifact later

**Normal Windows install (No internet on modem yet)**
1. Open the latest GitHub [release page](https://github.com/Joetooley28/cfw3212-qtooley-overlay/releases/latest).
2. Download the top file in the `Assets` section at the bottom of this release page.
3. Do not use GitHub's auto-generated `Source code` download.
4. Extract the ZIP.
5. Open PowerShell in the extracted folder.
6. Run exactly:
```powershell
powershell -ExecutionPolicy Bypass -File .\install_stock_ui_at.ps1
```
7. Enter the router IP and SSH username.
8. Enter the SSH password when prompted. The Windows ZIP flow now uses one SSH session for the package transfer and install/update run, so you should normally only need the password once unless your SSH setup itself asks again.
9. Answer the simple `y/n` prompts.

**Normal Windows uninstall (No internet on modem yet)**
1. Open PowerShell in the extracted folder from the same release ZIP.
2. Run exactly:
```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall_stock_ui_at.ps1
```
3. Choose uninstall mode:
   - `1` remove Qtooley and bundled Ookla
   - `2` remove Qtooley, bundled Ookla, and Tailscale

**Direct GitHub install or update from the router (Internet already working on modem)**
```sh
sh -c "$(wget -qO- https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/update_from_github_release.sh)"
```
If the router has `curl` instead of `wget`, use:
```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/update_from_github_release.sh)"
```

**Direct GitHub uninstall from the router (Internet already working on modem)**
```sh
sh -c "$(wget -qO- https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/uninstall_from_github_release.sh)"
```
`curl` fallback:
```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/uninstall_from_github_release.sh)"
```
If Qtooley is already installed and you want non-interactive uninstall:
- keep Tailscale:
```sh
REMOVE_TAILSCALE=0 /bin/sh /usrdata/at-stock-ui/uninstall_from_github_release.sh
```
- remove Tailscale too:
```sh
REMOVE_TAILSCALE=1 /bin/sh /usrdata/at-stock-ui/uninstall_from_github_release.sh
```

Uninstall behavior
- uninstall removes the live overlay mounts and verifies key shared stock files against the saved first-install baseline when that baseline is available
- the current verification set includes:
  - `/www/js/generatedMenuEntries.js`
  - `/www/theme/js/genHeader.js`
  - `/usr/share/lua/5.1/webif/top_menu_entries.lua`
  - `/usr/share/lua/5.1/webif/userGroupAuth.lua`
- bundled Ookla is treated as part of the base Qtooley install and uninstall flow
- Tailscale remains optional
- if Tailscale is kept during uninstall, it remains usable only from the CLI after the Qtooley UI is removed

Bundled Ookla behavior
- the normal install path installs the bundled Ookla CLI automatically from the release package when the archive is present
- if the archive is missing, the installer leaves Ookla unchanged and reports that state
- expected bundle path inside the ZIP:
  - `router-files\stock-ui-at\usrdata\at-stock-ui\bundles\ookla\ookla-speedtest-1.2.0-linux-armhf.tgz`

Additional notes
- first-time SSH connections to a new router IP are accepted automatically, so you should not need to type a blind `yes` for the host-key prompt
- the router-native GitHub install/update and uninstall paths download the latest release ZIP and run the same packaged router-side install or uninstall core used by the Windows ZIP flow
- the install flow refreshes `/usrdata/at-stock-ui`, refreshes the late-start units, and runs the overlay apply immediately
- the GitHub ZIP intentionally does not include the old `stock-snapshots` reference folder
- first install now captures the smaller install-time stock baseline directly from the router's live stock trees instead
- if something goes wrong, use the router-side recovery snapshots under `/usrdata/at-stock-ui/recovery-snapshots`
