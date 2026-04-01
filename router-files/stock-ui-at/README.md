# Stock UI AT Package

Local stock UI integration package for the Casa Turbo web interface on the Casa Systems CFW-3212.

## Current Truth

This is the current proven model on the tested CFW-3212. Do not casually redesign it.

- Keep the standalone `:8088` AT terminal separate.
- Keep the stock UI payload under `/usrdata/at-stock-ui`.
- Build the live trees under `/usrdata/at-stock-ui/live`.
- Bind-mount:
  - `/usrdata/at-stock-ui/live/www` -> `/www`
  - `/usrdata/at-stock-ui/live/usr/share/lua/5.1/webif` -> `/usr/share/lua/5.1/webif`
- Restart `turbontc.service` after the bind mounts are in place.
- Reapply the overlay late after boot with:
  - `/etc/systemd/system/jtools-stock-ui.service`
  - `/etc/systemd/system/jtools-stock-ui.timer`

## Design Guardrails

- Do not replace the late timer with an early boot service unless a better model is actually proven.
- Do not move away from the live-tree plus bind-mount model unless a better model is actually proven.
- Do not remove the shared AT lock path at `/tmp/at-http.lock`.
- Do not over-normalize connection state around one source.
- Do not try to fix browser/cache quirks by patching deep Casa core files unless lighter options fail.

## What This Package Adds

- A top-level authenticated `Jtools` tab in the stock UI.
- Pages under that tab:
  - `Quick Overview`
  - `General info`
  - `AT terminal`
  - `SMS`
  - `Band / cell locking`
  - `Ookla Speedtest`
  - `TTL helper`
  - `Tailscale` (when packaged)
- Shared stock patches for:
  - `generatedMenuEntries.js`
  - `top_menu_entries.lua`
  - `userGroupAuth.lua`
  - `handler_0011.lua`
- Jtools-owned shared styling, including an optional Jtools-page dark-mode override:
  - `www/css/at_terminal.css`
  - `www/css/jtools_dark_mode.css`
  - `www/css/ookla_speedtest.css`

## Important Platform Notes

- On the tested firmware, direct writes to `/www` and `/usr/share/lua/5.1/webif` are not a reliable persistence method.
- `/usrdata` is writable and persistent.
- Plain `mount` output is misleading for this setup. Use `/proc/self/mountinfo` when verifying active bind mounts.
- The standalone AT service binds to the router LAN IP at `:8088`, not `127.0.0.1:8088`.

## Current Auth Model

- Jtools pages require login.
- Jtools backend routes require login.
- Allowed groups are `root` and `admin`.
- `status.html` remains publicly viewable pre-login per stock behavior.

## Known Verification Traps

- Protected Jtools pages can show pre-auth or login-wrapper behavior when fetched without a valid session.
- `status.html` still references the stock menu token:
  - `/js/generatedMenuEntries.js?1.1.79.0`
- Jtools pages use Jtools-specific cache tokens instead:
  - `jtools-menu-v20260320`
  - `jtools-ui-v20260320`
  - `jtools-general-core-v20260320`
  - `jtools-general-v20260320`
  - `jtools-at-v20260320`
  - `jtools-bandlock-core-v20260320`
  - `jtools-bandlock-v20260320`

## Operational Trap To Document

Cellular health and user experience can diverge because of stock LAN behavior.

- Stock IP passthrough / DHCP behavior can hand out `192.0.0.2`.
- That can look like a bad modem or bad cellular session from the user side.
- In practice, the WAN/modem side may be fine while LAN/DHCP behavior is the real problem.

## Useful Package Files

- `/usrdata/at-stock-ui/apply_stock_ui_overlay.sh`
- `/usrdata/at-stock-ui/remove_stock_ui_overlay.sh`
- `/usrdata/at-stock-ui/verify_stock_ui_overlay.sh`
- `/usrdata/at-stock-ui/capture_overlay_recovery_snapshot.sh`
- `/usrdata/at-stock-ui/restore_overlay_recovery_snapshot.sh`
- `/usrdata/at-stock-ui/JTOOLS_RELEASE.txt`
- `/etc/systemd/system/jtools-stock-ui.service`
- `/etc/systemd/system/jtools-stock-ui.timer`
- `package/install_stock_ui_release.sh`
- `package/uninstall_stock_ui_release.sh`
- `RELEASE_INSTALL.md`

## Windows ZIP Installer

The current Windows-facing installer flow is designed to work from a normal Windows PC over SSH with a password prompt.

Important expectations:

- the router must already be rooted
- SSH must already be enabled and reachable
- SSH keys are optional, not required
- the user provides:
  - router IP / hostname
  - SSH username
  - SSH password when prompted by `ssh`

User-facing Windows scripts:

- `scripts\install_stock_ui_at.ps1`
- `scripts\uninstall_stock_ui_at.ps1`
- `scripts\stock_ui_at_release_common.ps1`
- `scripts\build_stock_ui_at_release.ps1`

Release ZIP notes:

- build a versioned ZIP with `scripts\build_stock_ui_at_release.ps1`
- the release ZIP includes the stock UI package plus the Windows install/uninstall wrappers
- the release ZIP intentionally excludes `stock-snapshots`; install-time rollback now comes from the one-time router baseline instead
- on first install, that baseline is captured from the router's live `/www` and `/usr/share/lua/5.1/webif` trees before any Qtooley live overlay mounts are active
- a non-default last-resort install mode can force a one-time baseline recapture when the saved uninstall baseline is missing or known-bad
- that recapture mode should only be used on a router that is currently presenting the stock UI state you want uninstall to restore later
- uninstall currently assumes protected stock files were not modified in place and verifies the install-time baseline after the overlay is unmounted
- the shared stock verification set currently covers:
  - `/www/js/generatedMenuEntries.js`
  - `/www/theme/js/genHeader.js`
  - `/usr/share/lua/5.1/webif/top_menu_entries.lua`
  - `/usr/share/lua/5.1/webif/userGroupAuth.lua`
- the offline Ookla archive should be placed at:
  - `usrdata\at-stock-ui\bundles\ookla\ookla-speedtest-1.2.0-linux-armhf.tgz`
- if that archive is present in the ZIP, the install path can place Ookla without the router downloading it

## Safe Recovery Workflow

Before any shared-stock change, capture a router-side overlay snapshot first:

```sh
/bin/sh /usrdata/at-stock-ui/capture_overlay_recovery_snapshot.sh before_shared_edit
```

If a deploy breaks the stock shell or Jtools pages, restore from a router-side snapshot instead of copying files back one by one from Windows:

```sh
/bin/sh /usrdata/at-stock-ui/restore_overlay_recovery_snapshot.sh \
  /usrdata/at-stock-ui/recovery-snapshots/<snapshot_dir>
```

Why this exists:

- router-side snapshots preserve the exact file layout and line endings that the live shell already accepted
- ad hoc Windows copy paths can silently mangle shared files such as `handler_0011.lua` or `genHeader.js`
- the recovery script also re-runs `apply_stock_ui_overlay.sh` and restarts the web services so live and payload trees stay aligned

## Windows Snapshot Workflow

For trusted checkpoints, keep rolling Windows copies of the stock UI package in two places:

- inside the repo:
  - `C:\at_terminal\repo-public\recovery-snapshots\stock-ui-last-good`
- outside the repo on the Desktop:
  - `C:\Users\jbake\Desktop\qtooley-recovery-snapshots`

Keep only the last 3 snapshots in each location.

Scripts:

- `scripts\import_router_recovery_snapshot.ps1`
- `scripts\update_last_good_stock_ui_snapshot.ps1`
- `scripts\restore_last_good_stock_ui_snapshot.ps1`

Recommended flow:

1. capture the router-side snapshot after deploy/verification
2. import that exact router snapshot to both Windows snapshot roots
3. after a trusted commit, refresh the rolling Windows snapshots from the repo tree if needed
