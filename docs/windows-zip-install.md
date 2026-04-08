# Windows ZIP Install Guide

Use this page for the normal Windows ZIP install, update, and uninstall flow.

## Before You Start

- the router must already be rooted
- SSH must already be enabled and reachable
- you need the router IP, SSH username (`root`), and SSH password
- Windows needs the built-in `ssh` client available
- use the top ZIP in the `Assets` section of the latest GitHub release page
- do not use the auto-generated `Source code` download
- extract the ZIP before running anything

## Normal Windows Install

1. Download the latest Windows ZIP from the release `Assets` section.
2. Extract the ZIP.
3. Open PowerShell in the extracted folder.
4. Run exactly:

```powershell
powershell -ExecutionPolicy Bypass -File .\install_stock_ui_at.ps1
```

5. Enter the router IP.
6. Enter the SSH username: `root`
7. Enter the SSH password when `scp` or `ssh` prompts, unless you already have a working SSH key setup.
8. Answer the simple `y/n` prompts.

## Normal Windows Update

Run the same command from a newer extracted release ZIP:

```powershell
powershell -ExecutionPolicy Bypass -File .\install_stock_ui_at.ps1
```

The normal update path reuses the saved first-install baseline unless you intentionally force a recapture.

## Normal Windows Uninstall

1. Open PowerShell in the extracted folder from the same release ZIP.
2. Run exactly:

```powershell
powershell -ExecutionPolicy Bypass -File .\uninstall_stock_ui_at.ps1
```

3. Choose uninstall mode:
   - `1` remove Qtooley and bundled Ookla
   - `2` remove Qtooley, bundled Ookla, and Tailscale

## Notes

- the packaged `README.txt` inside the release ZIP is this Windows ZIP guide
- for first-install snapshot behavior, space notes, and the `upgrade.star` warning, read [Quick Must Read](quick-must-read.md)
- for direct router `wget` install/update and uninstall commands, use [Release Install Guide](../router-files/stock-ui-at/RELEASE_INSTALL.md)
