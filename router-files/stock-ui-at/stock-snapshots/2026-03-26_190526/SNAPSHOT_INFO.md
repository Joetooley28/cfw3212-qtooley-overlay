# Stock Snapshot 2026-03-26_190526

- Captured from router: `usc_cfw3212`
- Capture time: `2026-03-26T19:07:56-0400`
- Kernel: `Linux usc_cfw3212 5.4.210-perf #1 PREEMPT Thu Jul 20 05:09:06 UTC 2023 armv7l GNU/Linux`

Source paths:

- `/overlay/pivot/www`
- `/overlay/pivot/usr/share/lua/5.1/webif`

Artifacts:

- `stock_www.tar`
  - SHA256: `520CFE23B24A86C7C110C5F5A32C5C47AE7E87D3A222CB393E6178E839608D77`
  - Approx size: `4022784` bytes
- `stock_webif.tar`
  - SHA256: `978577C0D483821C9163D636CD042274662936C4E9878A3DDD820EDBA87B3E43`
  - Approx size: `136192` bytes

Quick counts on the stock source:

- `www` entries below root: `205`
- `webif` entries below root: `26`

Known stock symlinks seen at capture time:

- `/overlay/pivot/www/config -> /tmp/config`
- `/overlay/pivot/www/ssh_keys -> /tmp/ssh_keys`

Notes:

- On Windows, the tar archives are the authoritative backup format for this snapshot.
- Direct Windows extraction of the `www` tree may not recreate the stock symlinks cleanly.
- SSH worked for this capture. ADB is also acceptable if SSH is unavailable, but the snapshot should still be taken from the stock pivot paths above.

