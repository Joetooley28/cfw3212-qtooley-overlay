## Stock Snapshot Policy

This folder stores router-side stock snapshots captured from the underlying stock paths, not from the live bind-mounted Qtooley trees.

Preferred stock capture sources on the router:

- `/overlay/pivot/www`
- `/overlay/pivot/usr/share/lua/5.1/webif`

Rules:

- Keep snapshot archives in dated subfolders.
- Treat the tar archives as authoritative on Windows because stock trees may contain symlinks that do not round-trip cleanly through normal extraction.
- Add a `SNAPSHOT_INFO.md` file for each capture with:
  - capture date/time
  - router identity / kernel
  - source paths
  - archive hashes
  - notable symlinks or extraction caveats
- When a new stock snapshot is captured or refreshed, update `docs/MASTER_TRUTH.md` if the workflow or current baseline changes.

