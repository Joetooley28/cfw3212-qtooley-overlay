Qtooley install and uninstall guide

Feature status
- cell locking is still under development and is not working yet

What this package is for
- install or update the Qtooley stock UI overlay on a rooted Casa Systems `CFW-3212`
- uninstall Qtooley later from a normal Windows PC over SSH
- preserve a router-specific uninstall baseline on first install
- install bundled Ookla as part of the base Qtooley release when that archive is present
- leave Tailscale as an optional extra after base install

What this package is not for
- it does not root the router
- for rooting, full credit to [@Luke](https://github.com/lukejenkins/cellular/tree/main/casasystems/cfw3212) for the root script and the broader `CFW-3212` platform research
- if you are starting from a stock carrier-managed box, also read Luke's [`guide_block_carrier_remote_mgmt`](https://github.com/lukejenkins/cellular/blob/main/casasystems/cfw3212/guide_block_carrier_remote_mgmt.md) to block the carrier remote-management path
- it does not enable SSH for you
- it does not turn cell locking into a working feature yet

Choose your install path first
- if the router does not already have working internet, use the Windows ZIP path from your PC over SSH
- if the router already has working internet, you can either keep using the Windows ZIP path or run the direct GitHub commands from an SSH shell on the router

Before you start
- the router must already be rooted
- full credit to [@Luke](https://github.com/lukejenkins/cellular/tree/main/casasystems/cfw3212) for the root script and the broader `CFW-3212` platform research
- if you are starting from a stock carrier-managed box, also read Luke's [`guide_block_carrier_remote_mgmt`](https://github.com/lukejenkins/cellular/blob/main/casasystems/cfw3212/guide_block_carrier_remote_mgmt.md) to block the carrier remote-management path
- SSH must already be reachable
- you need the router IP, SSH username, and SSH password
- Windows needs the built-in `ssh` client available
- the public Windows installer flow is SSH-only


Important install behavior
- on first install, the installer captures a compact router-specific stock baseline from the live stock `/www` and `/usr/share/lua/5.1/webif` trees before any Qtooley overlay mounts are active
- that first-install baseline is then reused across normal updates so uninstall can verify the router is back on its install-time stock web files after the overlay is removed
- install treats the router as already baselined only when these saved files exist under `/usrdata/at-stock-ui/installer-state/install-baseline`:
  - `install_www.tar`
  - `install_webif.tar`
- baseline metadata is also recorded in `/usrdata/at-stock-ui/installer-state/installer-baseline-info.txt`
- do not use `FORCE_RECAPTURE_BASELINE=1` unless the saved baseline is missing or known-bad and the router is already showing the stock state you want uninstall to restore later

Space note
- first install stores a router-specific stock baseline under `/usrdata` in addition to the base Qtooley payload
- bundled Ookla adds a few more MB
- Tailscale is a separate optional runtime under `/usrdata/tailscale` and uses noticeably more space than the core Qtooley files alone
- practical recommendation: try to have at least `15 MB` to `20 MB` free on `/usrdata` before first install, and leave more headroom if you plan to add optional runtimes later
- if space is tight, clean up old files first instead of trying to install with only a few MB left

Important cleanup note
- on one used unit, most of the missing space turned out to be a staged firmware file named `upgrade.star` under `/cache/upgrade.star` and `/usrdata/cache/upgrade.star`
- in that logged case, `upgrade.star` was about `108.8 MB`
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
8. Enter the SSH password when `scp` or `ssh` prompts, unless you already have a working SSH key setup.
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

Important uninstall behavior
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

Recovery note
- run the normal Qtooley uninstall first
- the router-specific first-install baseline is the preferred uninstall and recovery path
- if that saved baseline is missing or known-bad, use the fallback stock web package only if uninstall or manual overlay removal does not leave you with a working stock-style Casa web UI
- fallback recovery guide:
  - `..\..\docs\fallback-stock-recovery.md`

Additional notes
- the router-native GitHub install/update and uninstall paths download the latest release ZIP and run the same packaged router-side install or uninstall core used by the Windows ZIP flow
- the install flow refreshes `/usrdata/at-stock-ui`, refreshes the late-start units, and runs the overlay apply immediately
- the GitHub ZIP intentionally does not include the old `stock-snapshots` reference folder
- first install now captures the smaller install-time stock baseline directly from the router's live stock trees instead
- if something goes wrong, use the router-side recovery snapshots under `/usrdata/at-stock-ui/recovery-snapshots`
