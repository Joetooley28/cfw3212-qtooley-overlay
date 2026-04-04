# Fallback Stock Recovery

## What This Is

This is the public emergency recovery path for cases where the normal install-time Qtooley baseline is missing or known-bad.

Preferred recovery order:

1. use the router's own first-install baseline under `/usrdata/at-stock-ui/installer-state/install-baseline`
2. use the fallback stock web package only if that baseline is unavailable or unusable

## Fallback Package

The current public fallback stock web package is from a clean post-reset `CFW-3212` stock candidate on:

- router firmware: `USC_1.1.99.0`
- module firmware observed in capture metadata: `RG520NNADAR03A03M4G`

Package path in this repo:

- [`recovery/stock-ui-fallback/USC_1.1.99.0/README.md`](/C:/at_terminal/repo-public/recovery/stock-ui-fallback/USC_1.1.99.0/README.md)
- [`recovery/stock-ui-fallback/USC_1.1.99.0/stock_www.tar`](/C:/at_terminal/repo-public/recovery/stock-ui-fallback/USC_1.1.99.0/stock_www.tar)
- [`recovery/stock-ui-fallback/USC_1.1.99.0/stock_webif.tar`](/C:/at_terminal/repo-public/recovery/stock-ui-fallback/USC_1.1.99.0/stock_webif.tar)
- [`recovery/stock-ui-fallback/USC_1.1.99.0/SHA256SUMS.txt`](/C:/at_terminal/repo-public/recovery/stock-ui-fallback/USC_1.1.99.0/SHA256SUMS.txt)

## Important Limits

- this is a fallback stock web UI reference package, not a guarantee of exact per-device factory restoration
- this restores stock-style web content for `/www` and `/usr/share/lua/5.1/webif`
- this does not restore every device-specific writable-state area
- use it only on the same hardware family and only if you understand it is a last-resort recovery path

## Recovery Steps

1. Download or open these two files from the repo:
   - `recovery/stock-ui-fallback/USC_1.1.99.0/stock_www.tar`
   - `recovery/stock-ui-fallback/USC_1.1.99.0/stock_webif.tar`
2. Copy both files to the router, for example into `/tmp`.

Windows PowerShell with `scp`:

```powershell
scp .\stock_www.tar root@192.168.1.1:/tmp/stock_www.tar
scp .\stock_webif.tar root@192.168.1.1:/tmp/stock_webif.tar
```

WinSCP:

- connect to the router with `SCP` or `SFTP`
- log in as `root`
- upload both tar files into `/tmp`

3. SSH into the router as `root`.
4. Remove the active Qtooley live overlay if it is still present:

```sh
/bin/sh /usrdata/at-stock-ui/remove_stock_ui_overlay.sh || true
```

5. Stage a stock-style live tree from the fallback package:

```sh
RECOVERY_ROOT=/usrdata/stock-ui-fallback/live
rm -rf "$RECOVERY_ROOT"
mkdir -p "$RECOVERY_ROOT"
tar -xf /tmp/stock_www.tar -C "$RECOVERY_ROOT"
tar -xf /tmp/stock_webif.tar -C "$RECOVERY_ROOT"
```

6. Bind the fallback stock web trees onto the live web paths:

```sh
mount --bind "$RECOVERY_ROOT/www" /www
mount --bind "$RECOVERY_ROOT/usr/share/lua/5.1/webif" /usr/share/lua/5.1/webif
systemctl restart turbontc.service
```

7. Reload the router UI in the browser.

Optional verification:

```sh
grep -E ' /www | /usr/share/lua/5.1/webif ' /proc/self/mountinfo
```

## Removing The Fallback Overlay

If you only need the fallback package temporarily, remove the bind mounts with:

```sh
umount /usr/share/lua/5.1/webif 2>/dev/null || umount -l /usr/share/lua/5.1/webif 2>/dev/null || true
umount /www 2>/dev/null || umount -l /www 2>/dev/null || true
systemctl restart turbontc.service
```

## When To Use This

- the normal uninstall baseline under `/usrdata/at-stock-ui/installer-state/install-baseline` is missing
- the baseline files are damaged
- you need a quick way to get the stock-style Casa web shell back for troubleshooting
