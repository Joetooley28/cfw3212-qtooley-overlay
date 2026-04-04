# Emergency Stock Web Recovery

## Start Here

Run the normal Qtooley uninstall first.

Use this emergency recovery method only if uninstall finishes and the stock-style Casa web shell still does not come back correctly.

## What This Is

This is the public emergency recovery path for cases where the normal install-time Qtooley baseline is missing or known-bad.

Use this only if normal uninstall or manual overlay removal does not leave you with a working stock-style Casa web UI.

This package contains only the stock Casa web shell files for:

- `/www`
- `/usr/share/lua/5.1/webif`

These are the web tree areas that Qtooley overlays onto during normal operation.

It is not a full stock firmware image, not a full device backup, and not a complete factory restore package.

Preferred recovery order:

1. use the router's own first-install baseline under `/usrdata/at-stock-ui/installer-state/install-baseline`
2. use the fallback stock web package only if that baseline is unavailable or unusable

## How You Know You Need This

Typical signs:

- uninstall reports that the install baseline is not present
- uninstall finishes, but the stock-style Casa web shell does not come back correctly
- the Qtooley overlay has been removed or partially removed and the router web UI is still broken
- you need a quick stock-style Casa web shell for troubleshooting before doing anything else

Important note about the Qtooley tab:

- if you still clearly see the Qtooley tab, the Qtooley overlay may still be active or your browser may still be showing cached UI
- do not treat this fallback package as the normal way to remove Qtooley
- try normal uninstall first, then hard-refresh the browser before deciding you need this method

Important behavior:

- the current uninstall script does not hard-fail just because the baseline is missing
- if the baseline is missing, uninstall logs that condition and falls back to relying on the live stock trees after the overlay is unmounted
- that means you may only realize you need this method after uninstall completes and the web UI is still not where you want it

## Fallback Package

The current public fallback stock web package is from a clean post-reset `CFW-3212` stock candidate on:

- router firmware: `USC_1.1.99.0`
- module firmware observed in capture metadata: `RG520NNADAR03A03M4G`

Package path in this repo:

- [`recovery/stock-ui-fallback/USC_1.1.99.0/stock-ui-fallback-USC_1.1.99.0.zip`](/C:/at_terminal/repo-public/recovery/stock-ui-fallback/USC_1.1.99.0/stock-ui-fallback-USC_1.1.99.0.zip)
- folder contents: `README.md`, `stock_www.tar`, `stock_webif.tar`, `SHA256SUMS.txt`

## Important Limits

- this is a fallback stock web UI reference package, not a guarantee of exact per-device factory restoration
- this restores only the stock-style Casa web shell content for `/www` and `/usr/share/lua/5.1/webif`
- this is only the web tree content that Qtooley overlays onto, not a full stock image or full-firmware restore
- this does not restore every device-specific writable-state area
- use it only on the same hardware family and only if you understand it is a last-resort recovery path

## Recovery Steps

1. Download the fallback ZIP from the repo:
   - `recovery/stock-ui-fallback/USC_1.1.99.0/stock-ui-fallback-USC_1.1.99.0.zip`
2. Extract it on your Windows PC.
3. From the extracted folder, locate these two files:
   - `recovery/stock-ui-fallback/USC_1.1.99.0/stock_www.tar`
   - `recovery/stock-ui-fallback/USC_1.1.99.0/stock_webif.tar`
4. Copy both files to the router, for example into `/tmp`.

Windows PowerShell with `scp -O`:

```powershell
scp -O .\stock_www.tar root@192.168.1.1:/tmp/stock_www.tar
scp -O .\stock_webif.tar root@192.168.1.1:/tmp/stock_webif.tar
```

Important transfer note:

- modern `scp` prefers an SFTP-based path that this router does not support
- use `scp -O` with a capital `O` to force the legacy SCP protocol
- for larger package-style transfers, tar-over-SSH streaming also works well on this platform

WinSCP:

- connect to the router with `SCP` or `SFTP`
- log in as `root`
- upload both tar files into `/tmp`

5. SSH into the router as `root`.
6. Run the router-side recovery commands line by line inside that SSH shell.
7. Remove the active Qtooley live overlay if it is still present:

```sh
/bin/sh /usrdata/at-stock-ui/remove_stock_ui_overlay.sh || true
```

8. Stage a stock-style live tree from the fallback package:

```sh
RECOVERY_ROOT=/usrdata/stock-ui-fallback/live
rm -rf "$RECOVERY_ROOT"
mkdir -p "$RECOVERY_ROOT"
tar -xf /tmp/stock_www.tar -C "$RECOVERY_ROOT"
tar -xf /tmp/stock_webif.tar -C "$RECOVERY_ROOT"
```

9. Bind the fallback stock web trees onto the live web paths:

```sh
mount --bind "$RECOVERY_ROOT/www" /www
mount --bind "$RECOVERY_ROOT/usr/share/lua/5.1/webif" /usr/share/lua/5.1/webif
systemctl restart turbontc.service
```

10. Reload the router UI in the browser.

Optional verification:

```sh
grep -E ' /www | /usr/share/lua/5.1/webif ' /proc/self/mountinfo
```

## When To Use This

- the normal uninstall baseline under `/usrdata/at-stock-ui/installer-state/install-baseline` is missing
- the baseline files are damaged
- you need a quick way to get the stock-style Casa web shell back for troubleshooting

## Important Final Note

This fallback method restores the stock-style Casa web shell only.

It does not by itself perform a full Qtooley uninstall and does not by itself guarantee removal of:

- the saved Qtooley payload under `/usrdata/at-stock-ui`
- bundled Ookla
- Tailscale

In the normal recovery flow, run uninstall first and use this fallback method only if the stock-style Casa web shell does not come back correctly afterward.
