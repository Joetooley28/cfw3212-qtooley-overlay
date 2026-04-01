# CFW-3212 Master Truth For New AI Sessions

This file is the fastest safe introduction to this project for a brand new AI chat.

Read this first before making suggestions or edits.

If you need deeper detail after this file, the `notes/` folder is full of the real project source docs and handoff notes. Do not ignore it.

## New Page Checklist

Before adding any new Jtools tab or page, verify all of these:

- read this file first
- read the stock UI integration note and the Speedtest page plan
- trace one existing working page end to end before editing anything
- confirm how the page is exposed in `generatedMenuEntries.js`
- confirm how the page is wired in `top_menu_entries.lua`
- confirm auth wiring in `userGroupAuth.lua`
- confirm route/API wiring in `handler_0011.lua`
- confirm where the page HTML, JS, CSS, and any helper Lua or shell files belong
- confirm the page joins the shared dark/light toggle path through `genHeader.js`
- confirm cache/version tokens are handled intentionally
- confirm the change stays install/uninstall friendly
- confirm the change is low-risk for LAN, stock login, and SSH access

If you have not traced a working page like Speedtest first, stop and do that before starting new page work.

## What This Project Is

This workspace is a rooted Casa Systems `CFW-3212` project built around a Quectel `RG520N-NA`.

There are two related but separate tool tracks in this repo:

- a standalone LAN AT terminal served on the router LAN IP at `:8088` (historically often `http://192.168.1.1:8088/`)
- a stock Casa Turbo web UI overlay that adds a top-level `Jtools` tab and custom pages inside the stock UI

This is not a normal host-PC plus USB modem project.

On this device, the modem and application processor are effectively the platform itself. The proven AT backend is the platform-native direct device path, not a generic USB serial abstraction.

## Non-Negotiable Device Truths

- Device: Casa Systems `CFW-3212`
- Modem: Quectel `RG520N-NA`
- Tested router firmware: `USC_1.1.79.0`
- Tested module firmware seen in notes: `RG520NNADAR03A03M4G`
- Proven standalone AT backend default: `/dev/smd7`
- Standalone AT backend mode name: `smd7_direct`
- Standalone AT terminal listens on the router LAN IP at `:8088`
- The standalone AT service binds to the router LAN IP, not `127.0.0.1`
- Shared AT lock path is `/tmp/at-http.lock`
- `/usrdata` is the writable persistent area on-box

Do not redesign this project around generic USB modem assumptions.

Do not “clean up” the direct modem path into something more abstract unless there is a proven reason and a tested replacement.

## Critical Safety Warning

Be extremely careful not to break:

- LAN access
- the stock web UI login page
- SSH reachability
- the stock Casa Turbo startup/rendering path

This already happened once during page wiring work: the login page turned white, LAN and SSH were lost, and recovery only worked because ADB was still available.

Treat changes to these areas as high risk:

- overlay mounts
- `genHeader.js`
- menu injection
- auth wiring
- stock page bootstrap flow
- shared stock JS/CSS includes
- `handler_0011.lua`
- anything under `/www` or `/usr/share/lua/5.1/webif` that affects common stock UI startup

Prefer the smallest safe change.

Specific `genHeader.js` warning:

- edits to `www/theme/js/genHeader.js` have unusually high blast radius because that file is shared across themed stock pages and Jtools pages
- a bad edit there can affect page bootstrap, shared asset injection, theme behavior, and visible stock UI rendering all at once
- if you touch `genHeader.js`, treat it as a shared-stock-file change and verify login, navigation, and another non-Jtools themed stock page before calling the change safe

## Recovery Access Matters

The safe working assumption is:

- SSH over LAN is the normal live-work path
- ADB over USB is the emergency recovery path

Important persistence notes already proven:

- SSH key persistence works when the right RDB values are marked persistent
- ADB persistence works when `service.adb.enable` is marked persistent

Useful documented keys/flags live in:

- [adb-and-ssh-persistence.md](/c:/at_terminal/repo-public/docs/adb-and-ssh-persistence.md)
- [CFW3212_proven_commands_cheatsheet.txt](/c:/at_terminal/notes/CFW3212_proven_commands_cheatsheet.txt)

## SSH Info

The project’s working LAN-side SSH target is the router root account on the current box LAN IP.

Current box IP map:

- Device 01: `192.168.10.1`
- Device 02: `192.168.20.1`
- Device 03: `192.168.30.1`

Examples:

- `root@192.168.10.1`
- `root@192.168.20.1`
- `root@192.168.30.1`

Do not hard-code `192.168.1.1` in new notes or scripts. The router LAN subnet can change.

If an AI needs live router work, it should assume plain SSH is available before assuming anything fancier.

Important transfer note from the project history:

- the router SSH setup does not support the newer SFTP-based transfer path that modern `scp` prefers by default
- `scp -O` works because it forces the legacy SCP protocol
- tar-over-SSH streaming also works and remains a good default for package-style syncs

Do not assume plain modern `scp` works without the `-O` flag.

## Recovery Snapshot Rule

Before any edit that touches shared stock shell files, create a router-side recovery snapshot first.

Use:

- `/bin/sh /usrdata/at-stock-ui/capture_overlay_recovery_snapshot.sh <label>`

If a deploy breaks Qtooley or the stock shell, restore from the router-side snapshot instead of trying to reconstruct the overlay from Windows copy operations:

- `/bin/sh /usrdata/at-stock-ui/restore_overlay_recovery_snapshot.sh /usrdata/at-stock-ui/recovery-snapshots/<snapshot_dir>`

Reason:

- router-side snapshots preserve exact file bytes and accepted line endings
- Windows-side ad hoc copy paths have already been proven to mangle shared files and leave the router in a mixed state
- restoring from a router-side snapshot is safer than piecemeal rollback when `genHeader.js`, `handler_0011.lua`, auth wiring, or menu wiring are involved

## Windows Rolling Snapshot Rule

On Windows, keep rolling last-known-good stock UI snapshots in two places:

- inside the repo
- outside the repo on the Desktop

Keep only the last 3 in each location.

Scripts:

- [update_last_good_stock_ui_snapshot.ps1](/c:/at_terminal/repo-public/scripts/update_last_good_stock_ui_snapshot.ps1)
- [restore_last_good_stock_ui_snapshot.ps1](/c:/at_terminal/repo-public/scripts/restore_last_good_stock_ui_snapshot.ps1)
- [import_router_recovery_snapshot.ps1](/c:/at_terminal/repo-public/scripts/import_router_recovery_snapshot.ps1)

Default snapshot roots:

- `C:\at_terminal\repo-public\recovery-snapshots\stock-ui-last-good`
- `C:\Users\jbake\Desktop\qtooley-recovery-snapshots`

Trusted checkpoint flow:

1. capture a router-side recovery snapshot
2. import that exact on-box snapshot to Windows:
   - `powershell -ExecutionPolicy Bypass -File C:\at_terminal\repo-public\scripts\import_router_recovery_snapshot.ps1 -RouterSnapshotPath <router_snapshot_path>`
3. after a trusted commit, refresh the rolling Windows snapshots from the repo working tree if needed:
   - `powershell -ExecutionPolicy Bypass -File C:\at_terminal\repo-public\scripts\update_last_good_stock_ui_snapshot.ps1 -Commit <hash> -Label <label>`

Keep using router-side recovery snapshots as well. The router snapshot is the exact on-box fallback. The two Windows snapshot roots are for fast local recovery and off-repo backup.

## Local Repo Layout

Top-level working repo:

- [repo-public](/c:/at_terminal/repo-public)

Current local branch for the stock UI overlay work:

- `qtooley-current`

Original pre-Qtooley baseline preserved locally:

- `cfw3212-stock-ui-jtools-overlay`
- `backup/original-pre-qtooley-20260323`

Standalone AT tool local files:

- [legacy-standalone-at/config.json](/c:/at_terminal/legacy-standalone-at/config.json)
- standalone Lua/HTML/CSS/JS files under [legacy-standalone-at](/c:/at_terminal/legacy-standalone-at)

Stock UI overlay package root:

- [router-files/stock-ui-at](/c:/at_terminal/repo-public/router-files/stock-ui-at)

Important stock overlay package areas:

- [www](/c:/at_terminal/repo-public/router-files/stock-ui-at/www)
- [usr/share/lua/5.1/webif](/c:/at_terminal/repo-public/router-files/stock-ui-at/usr/share/lua/5.1/webif)
- [usrdata/at-stock-ui](/c:/at_terminal/repo-public/router-files/stock-ui-at/usrdata/at-stock-ui)
- [etc/systemd/system](/c:/at_terminal/repo-public/router-files/stock-ui-at/etc/systemd/system)

## The Proven Stock UI Overlay Model

This is the current earned working model on this device. Do not casually replace it.

- Keep payload under `/usrdata/at-stock-ui`
- Build live trees under `/usrdata/at-stock-ui/live`
- Bind-mount `/usrdata/at-stock-ui/live/www` onto `/www`
- Bind-mount `/usrdata/at-stock-ui/live/usr/share/lua/5.1/webif` onto `/usr/share/lua/5.1/webif`
- Restart `turbontc.service` after bind mounts are in place
- Reapply late after boot using:
  - `/etc/systemd/system/jtools-stock-ui.service`
  - `/etc/systemd/system/jtools-stock-ui.timer`

Important verification trap:

- plain `mount` output is misleading on this box
- use `/proc/self/mountinfo` to verify active bind mounts

### Overlay reapply rebuild order (do not underestimate this)

`apply_stock_ui_overlay.sh` **removes** `/usrdata/at-stock-ui/live` and rebuilds it roughly as:

1. Copy stock pivot trees into `live` (`/overlay/pivot/www` and `.../webif`)
2. Merge `/usrdata/at-stock-ui/www` onto `live/www`
3. Merge `/usrdata/at-stock-ui/usr/share/lua/5.1/webif` onto `live/.../webif`
4. Apply Jtools menu/auth files: prefer `overlay/www/js/generatedMenuEntries.js` and `overlay/.../top_menu_entries.lua` and `overlay/.../userGroupAuth.lua` when those paths exist on the router; the package also keeps **fallback copies** under `www/js/` and `usr/share/lua/5.1/webif/` so reapply still works if `overlay/` is missing

If step 4 does **not** place complete Jtools **`top_menu_entries.lua`** and **`userGroupAuth.lua`** into the live `webif` tree, those slots stay **stock** from the pivot. Casa Turbo’s `MustacheHandler` builds **`AUTH_TABLE`** from `userGroupAuth.lua`. Stock auth does **not** include Jtools pages (for example `sms.html`) or Jtools API keys (for example `SmsApi`). The browser can show a menu line from cached or client-side data while **GET `/sms.html` is rejected server-side** — typically **redirect to `index.html`** — so the failure looks like a “dead” or “lost” page even when **`sms.html`**, **`sms.js`**, **`sms.css`**, and **`handler_0011.lua`** API routes are all present.

**Lesson:** before concluding a Jtools page bug is front-end-only, verify **server-side** menu and auth wiring in the **live** tree (or the payload that reapply will copy), not only the HTML and handler routes.

### Jtools page wiring checklist (all integration points)

A Jtools page is not done until **all** of these agree (trace a known-good page such as Speedtest or SMS):

- **`generatedMenuEntries.js`** — menu entry, URL, view groups
- **`top_menu_entries.lua`** — the page’s `*.html` name appears under the correct top menu key (usually `JtoolServices`)
- **`userGroupAuth.lua`** — auth for the **`*.html`** page **and** for **each** API object name returned by handlers’ `getUrl()` (for example `SmsApi`, `AtTerminalApi`, `OoklaSpeedtestApi`)
- **`handler_0011.lua`** — route patterns registered for any custom APIs
- **Page assets** — `www/<page>.html`, `www/js/`, `www/css/` as used by that page
- **`/usrdata/at-stock-ui`** helpers (scripts, extra Lua modules) if the page depends on them

Treat **`top_menu_entries.lua`** and **`userGroupAuth.lua`** as **critical shared stock wiring**. Partial syncs that update only `handler_0011.lua` or only `www/` **plus reapply** can otherwise **silently revert** live menu/auth toward stock and **drop** Jtools entries.

## Standalone AT Versus Stock UI Jtools

These are separate systems and should stay conceptually separate.

Standalone AT terminal:

- LAN tool on the router LAN IP at `:8088`
- no stock UI dependency
- useful fallback even if stock UI overlay work breaks

Stock UI Jtools overlay:

- authenticated pages inside the stock Casa web interface
- uses shared stock files plus Jtools-owned pages/assets
- talks to the modem using the same shared AT lock discipline

Important shared rule:

- standalone AT and stock UI AT share `/tmp/at-http.lock`
- that is intentional
- preserve fail-fast locking and safe lock release behavior

## Current Jtools Pages

At the time of writing, the Jtools tab has included pages such as:

- `Quick Overview`
- `General info`
- `AT terminal`
- `SMS`
- `Band / cell locking`
- `Ookla Speedtest`
- `TTL helper`
- `Tailscale` (when packaged)

Current top-level Jtools landing behavior:

- the shared Jtools redirect currently lands on `Quick Overview`, not `General info`
- `General info` is still an important reference page for wiring and mixed stock/RDB plus AT data usage, but it is no longer the default landing page

Quick Overview notes:

- Quick Overview has its own frontend assets and a screensaver integration path
- it is one of the main AT-polling pages, so changes there can affect the whole Jtools experience if they increase AT lock hold time

## Master Rule For New Page Work

If you are adding a new page or tab to Jtools, do not invent the wiring from scratch.

Study an existing working page first, especially:

- the Speedtest implementation
- the General info page
- the AT terminal page

Yesterday’s failure mode to avoid:

- trying to add a page to Jtools without really understanding how it ties into the stock UI menu/auth/handler flow

The right move is to trace a known-good page end to end before editing.

Hard rule:

- before adding any new Jtools tab or page, first inspect how an existing working page is tied into the stock UI
- Speedtest is the best first example because it is a full Jtools-owned page with menu wiring, auth wiring, route wiring, page assets, backend helpers, and install/uninstall-friendly packaging
- do not start a new tab/page implementation until you have traced a working page through:
  - `generatedMenuEntries.js`
  - `top_menu_entries.lua`
  - `userGroupAuth.lua`
  - `handler_0011.lua`
  - the page HTML
  - the page JS/CSS
  - any helper Lua or shell files under `/usrdata/at-stock-ui`
- if you skip this tracing step, you are likely to break stock UI behavior or build a page that exists on disk but is not correctly integrated

## Page Implementation Flow For Stock UI Jtools

When adding a new Jtools page, think in this order.

### 1. Decide if the page is Jtools-owned or shared-hook only

Most new features should be Jtools-owned pages, not deep stock-core rewrites.

Prefer:

- one new HTML page under `www/`
- one new page JS file under `www/js/`
- optional page CSS under `www/css/`
- one backend route family in `handler_0011.lua`
- optional helper Lua or shell files under `usrdata/at-stock-ui/`

Avoid:

- copying vendor stock HTML unless necessary
- deep Casa core surgery
- changing shared stock files unless the page cannot exist without it

### 2. Understand the stock UI integration points

The stock UI Jtools pages are tied in through a combination of:

- menu wiring
- auth wiring
- top-menu redirect/wiring
- route registration
- page-specific HTML/JS/CSS
- backend endpoints

The key shared stock files that Jtools patches are:

- [generatedMenuEntries.js](/c:/at_terminal/repo-public/router-files/stock-ui-at/www/js/generatedMenuEntries.js)
- [top_menu_entries.lua](/c:/at_terminal/repo-public/router-files/stock-ui-at/usr/share/lua/5.1/webif/top_menu_entries.lua)
- [userGroupAuth.lua](/c:/at_terminal/repo-public/router-files/stock-ui-at/usr/share/lua/5.1/webif/userGroupAuth.lua)
- [handler_0011.lua](/c:/at_terminal/repo-public/router-files/stock-ui-at/usr/share/lua/5.1/webif/handler_0011.lua)

These are high-risk files because mistakes there can affect stock UI render/auth flow.

### 3. Add the actual page files

Typical Jtools-owned page files live under:

- `www/<page>.html`
- `www/js/<page>.js`
- `www/css/<page>.css`

Examples worth studying:

- [ookla_speedtest.html](/c:/at_terminal/repo-public/router-files/stock-ui-at/www/ookla_speedtest.html)
- [ookla_speedtest.js](/c:/at_terminal/repo-public/router-files/stock-ui-at/www/js/ookla_speedtest.js)
- [general_dashboard.html](/c:/at_terminal/repo-public/router-files/stock-ui-at/www/general_dashboard.html)
- [at_terminal.html](/c:/at_terminal/repo-public/router-files/stock-ui-at/www/at_terminal.html)

### 4. Add backend logic in the right place

For stock UI overlay work:

- lightweight route wiring belongs in `handler_0011.lua`
- heavier helper logic should prefer Jtools-owned files under `/usrdata/at-stock-ui`

Examples:

- page-specific helpers
- runner scripts
- wrapper shells
- secondary Lua modules

Keep `handler_0011.lua` as thin as practical for new work, but do not force a big refactor unless needed.

### 5. Wire auth correctly

Jtools pages and APIs are protected.

Working pattern:

- add auth entries in `userGroupAuth.lua`
- keep allowed groups aligned with current Jtools behavior
- unauthenticated Jtools page/API access should redirect or return `401` as appropriate

Do not assume a page is wired correctly just because the file exists under `/www`.

### 6. Wire menu and route visibility

For a page to really exist in the stock UI, it usually needs:

- menu entry exposure in `generatedMenuEntries.js`
- top-menu or routing awareness in `top_menu_entries.lua`
- backend route handling in `handler_0011.lua`
- auth entries in `userGroupAuth.lua`

Do not skip one of these and assume the rest will “just work.”

### 7. Respect the page bootstrap style already used here

Some Jtools pages use stock page objects.

Some Jtools pages intentionally do not.

There is already a known trap here:

- pages with `pageObjects: []` must not blindly call `requestPageObjects()`
- otherwise you get stock `Invalid request` behavior

If you are editing page bootstrap logic, trace a current working page first.

### 8. Handle browser cache busting on purpose

The stock UI is stubborn about caching.

Jtools pages use their own versioned asset tokens.

If you change a shared or page-specific web asset and forget the token strategy, you can end up debugging stale browser code instead of the real live code.

Important note:

- `status.html` still references the stock menu token `1.1.79.0`
- Jtools pages use Jtools-specific page tokens

Treat cache/version tokens as part of release data.

### 8a. Be careful adding AT commands to polling endpoints

This project has already hit a real lock-contention trap here.

Important lesson:

- adding too many AT commands to a polling endpoint can make the shared AT lock stay held long enough to slow down multiple Jtools pages
- a previous jump from 6 to 9 AT commands per poll caused roughly 30 to 45 second page-load slowdowns across Jtools tabs because the lock was being held too long

Current known example:

- the shared general state path in `handler_0011.lua` keeps the extra signal crosscheck commands opt-in instead of running them every poll
- the extra commands are:
  - `AT+QRSRP`
  - `AT+QRSRQ`
  - `AT+QSINR`
- they are only requested when explicitly asked for, rather than always being part of the normal fast poll path

Rule for future work:

- before adding AT commands to any periodic endpoint, think about total lock hold time, not just whether the command is technically valid
- if a command is useful but not required every poll, make it opt-in, lower-frequency, or cached
- remember that Quick Overview, General info, the screensaver, and other open pages can multiply contention because they share the same AT lock discipline

### 8b. New pages must join the shared dark/light theme hook

The dark/light mode behavior is centralized through the shared stock UI header hook, not through one-off per-page theme logic.

Important rule for new pages:

- if a new Jtools page should participate in the dark/light toggle, wire it into the shared theme path
- do not hard-link a separate dark stylesheet into the page HTML as a one-off shortcut
- do not invent a second theme toggle just for one page

The key shared file to study is:

- [genHeader.js](/c:/at_terminal/repo-public/router-files/stock-ui-at/www/theme/js/genHeader.js)

Why this matters:

- the browser theme toggle uses shared injected logic
- Jtools pages were intentionally moved onto that shared path so one toggle controls both stock themed pages and Jtools pages
- a new page that is not added to the shared allowlist/hook can end up ignoring the toggle or behaving inconsistently

When adding a new themed page, verify:

- the page is covered by the shared `genHeader.js` theme-injection logic
- the page looks correct in both dark and light mode
- uninstall remains simple because the theme behavior still lives in the overlay/shared hook model

### 9. Keep install/uninstall friendliness in mind while building

Every new page/feature should preserve clean install/remove paths.

Preferred design:

- files live in the overlay package
- late-start units reapply the overlay
- uninstall can disable the units, unmount cleanly, restart `turbontc`, and remove payload if desired
- keep a dated stock snapshot baseline for `/overlay/pivot/www` and `/overlay/pivot/usr/share/lua/5.1/webif`

Avoid feature designs that require manual archaeology to remove.

## Installer And Uninstaller Expectations

This project should remain installer/uninstaller friendly.

That means:

- no hidden permanent mutations if avoidable
- no feature that only works after hand-editing random live files
- no feature that is impossible to remove cleanly
- no feature that silently downloads large things during overlay apply

Current expected installer responsibilities for stock UI overlay work:

- copy package payload into `/usrdata/at-stock-ui`
- install or refresh:
  - `jtools-stock-ui.service`
  - `jtools-stock-ui.timer`
- enable and start the timer
- run `apply_stock_ui_overlay.sh` once so the live trees update immediately

Current expected uninstaller responsibilities:

- disable and stop:
  - `jtools-stock-ui.timer`
  - `jtools-stock-ui.service`
- unmount active live trees if currently bound
- restart `turbontc.service`
- remove the payload under `/usrdata/at-stock-ui` if doing a full uninstall
- if the goal is full rollback, also remove optional runtimes installed by Qtooley such as Tailscale under `/usrdata/tailscale`

### 10. Keep a stock snapshot manifest current

For stock UI overlay work, maintain a local stock snapshot reference so uninstall and rollback work can be verified against something real.

Current policy:

- capture stock snapshots from the router's underlying stock paths, not the live bind-mounted trees:
  - `/overlay/pivot/www`
  - `/overlay/pivot/usr/share/lua/5.1/webif`
- SSH or ADB are both acceptable transport paths for snapshot capture on this router
- store them under `router-files/stock-ui-at/stock-snapshots/` in dated folders
- prefer tar archives as the authoritative artifact because stock trees can contain symlinks that do not round-trip cleanly on Windows
- include a `SNAPSHOT_INFO.md` file with capture time, source paths, hashes, and caveats
- when Codex or Claude captures, refreshes, or relies on a stock snapshot, update the snapshot manifest and this project truth if the workflow changes

When in doubt, choose the design that makes future packaging simpler.

## The Working Local Workflow

The current proven workflow is:

1. Edit local files first.
2. Validate the local package layout.
3. Commit the local repo checkpoint.
4. Save a fresh snapshot copy of the latest stock UI package to the rolling Windows snapshot roots.
5. Sync only the selected changed files to the live router.
6. Reapply the overlay on the router.
7. Verify carefully.
8. Update the notes/handoff docs.

This is important:

- local first
- live router second
- keep notes current

## Git Commit And Desktop Backup Workflow

For stock UI overlay work, use this as the default safe checkpoint pattern.

Git repo root:

- [repo-public](/c:/at_terminal/repo-public)

Current stock UI overlay branch:

- `qtooley-current`

Original pre-Qtooley baseline preserved locally:

- `cfw3212-stock-ui-jtools-overlay`
- `backup/original-pre-qtooley-20260323`

Desktop snapshot root already in use:

- `C:\Users\jbake\Desktop\qtooley-recovery-snapshots`

Recommended rhythm:

1. Make local changes under [router-files/stock-ui-at](/c:/at_terminal/repo-public/router-files/stock-ui-at)
2. Review diff carefully before any live sync
3. Create a local git commit in [repo-public](/c:/at_terminal/repo-public) for the checkpoint
4. Refresh the rolling Windows snapshots so they reflect the latest known-good package
5. Only then sync the selected files or package contents to the router

If the change is risky, make the desktop backup refresh happen before live testing, not after.

Known existing local backup snapshot examples found in notes:

- `C:\at_terminal\repo-public\router-files\stock-ui-at_backup_pre_darkmode_20260320`
- `C:\at_terminal\repo-public\router-files\stock-ui-at_backup_working_20260321`

## Checkpoint Commands Example

Use this as the default example flow before risky stock UI changes or before syncing a new feature live.

### 1. Review current git state

From [repo-public](/c:/at_terminal/repo-public):

```powershell
git status --short
git diff -- router-files/stock-ui-at
```

### 2. Commit the local checkpoint

From [repo-public](/c:/at_terminal/repo-public):

```powershell
git add router-files/stock-ui-at
git commit -m "Checkpoint stock-ui-at before live sync"
```

If the change also touched other intended project files, add them explicitly too.

### 3. Refresh the rolling Windows snapshots

This keeps the last-known-good package copies in:

- `C:\at_terminal\repo-public\recovery-snapshots\stock-ui-last-good`
- `C:\Users\jbake\Desktop\qtooley-recovery-snapshots`

Example PowerShell refresh:

```powershell
powershell -ExecutionPolicy Bypass -File C:\at_terminal\repo-public\scripts\update_last_good_stock_ui_snapshot.ps1 -Commit <hash> -Label <label>
```

### 4. Sync selected files or the package to the router

Do not assume plain modern `scp` works on this router.

Known good pattern from the notes:

- tar-over-SSH streaming

Documented safe default:

- use tar-over-SSH streaming unless and until another transfer method is explicitly re-verified in the project notes

Also verified live:

- `scp -O` works on this router and is valid for smaller direct file copies
- use `-O` explicitly because the router does not support the newer default SFTP-style path used by modern `scp`

Example package sync pattern:

```powershell
tar -cf - -C 'C:\at_terminal\repo-public\router-files\stock-ui-at' . | ssh root@<router-ip> "cd /usrdata/at-stock-ui && tar -xf -"
```

Example direct file copy pattern:

```powershell
scp -O 'C:\at_terminal\repo-public\router-files\stock-ui-at\www\js\some_page.js' root@<router-ip>:/usrdata/at-stock-ui/www/js/some_page.js
```

If you are only syncing selected files, keep the same principle:

- stream or copy only what you intend
- do not spray unrelated files into the live box

### 5. Reapply the overlay

On the router:

```sh
/bin/sh /usrdata/at-stock-ui/apply_stock_ui_overlay.sh
```

### 6. Verify before calling it good

On the router:

```sh
cat /proc/self/mountinfo | grep /usrdata/at-stock-ui/live
systemctl status turbontc.service 2>/dev/null | sed -n '1,20p'
```

In browser and access checks:

- verify stock login page still renders
- verify SSH still works
- verify the edited Jtools page works
- if shared files changed, spot-check another stock page too

If a risky shared-file change breaks the stock UI, stop and recover before stacking more edits.

## Cache Busting, Shared Assets, and Turbo Reload

After you edit **static** files (`www/css`, `www/js`, `www/theme/js`, HTML), assume the browser may still show the **old** copy until the URL changes.

**Query strings are the cache key**

- Stock and Jtools pages load CSS/JS as `/path/file.css?token`. The browser treats `?v1` and `?v2` as different resources.
- When you change a file, **bump the query string** on every **HTML** `<link>` / `<script>` that references that file. Tokens like `jtools-ui-v20260328c` are arbitrary; any **new** suffix works.

**Shared CSS/JS across pages**

- Some bundles (notably `at_terminal.css`) are linked from **multiple** HTML files. Bump the token on **each** of those pages when you change the shared file. Otherwise one page can look updated while another tab still uses a cached URL.

**`genHeader.js` is two layers**

- Dark mode loads `jtools_dark_mode.css?...` from **inside** `genHeader.js`. When you change that CSS, bump the URL **in genHeader.js** and bump the **`genHeader.js` `src=`** query on **every** Jtools page that includes it. Leaving `genHeader.js?1.1.79.0` while changing injected CSS is a common “stale theme” trap.

**Device 01 stock is not the canonical visual stock baseline**

- Device 01 can be returned to stock behavior for rollback/install-uninstall validation, but its stock appearance should not be treated as the cleanest Casa visual reference.
- Prior work intentionally widened shared stock dark-mode behavior through:
  - `www/theme/js/genHeader.js`
  - `www/css/jtools_dark_mode.css`
  - browser `localStorage["jtoolsThemeMode"]`
- That rollout affected shared stock-page theming through an allowlist in `genHeader.js`, not only Jtools-owned pages.
- Current rule:
  - keep dark-mode improvements where they are wanted in the overlay UI
  - keep the `genHeader.js` dark-mode allowlist scoped to Qtooley-owned overlay pages only
  - do **not** use Device 01 stock appearance as proof of what pristine stock should look like
  - use Device 02 protected stock pulls as the stronger visual stock baseline for comparisons

**Lua / Turbo (not cache)**

- Changes under `usr/share/lua/5.1/webif/` (e.g. `handler_0011.lua`) are not picked up reliably until the web stack reloads: `systemctl restart turbontc.service`. Plain HTML/CSS/JS edits do **not** require this.

**Still stale after deploy?**

- Confirm the file on the router under `/usrdata/at-stock-ui/www/...`, re-run `apply_stock_ui_overlay.sh`, then reload. If needed, bump tokens one more time and redeploy the HTML.

## Qtooley dashboard data sources (stock RDB vs AT)

- **Quick Overview** and the **General info** AT supplement both call **`GET /jtools_general_api/state`**, which already includes **`stock_signal`**: LTE and NR5G `rsrp` / `rsrq` / `snr` / **`cqi`** from the same RDB keys the stock CGI **`StsAdvStatus`** (`objStsAdvStatus.lua`) exposes. That snapshot is **read inside the existing locked transaction** with the AT commands — it does **not** add extra AT traffic.
- **General info** also uses stock **`PageObj`** polling (same objects as stock **status** / **field test**): **`StsCellularConnectionStatus`**, **`StsAdvStatus`**, **`StsWWanStatus`**, neighbor **`cellInfo`**, etc. Prefer surfacing those fields in the UI when they are **already fetched** rather than adding new periodic AT commands.

## Live Sync And Apply Workflow

The recorded working live path is:

- sync selected files to the router over SSH
- use tar-over-SSH streaming if needed
- do not assume SCP works
- then re-run:
  - `/bin/sh /usrdata/at-stock-ui/apply_stock_ui_overlay.sh`

After reapply:

- verify with `/proc/self/mountinfo`
- verify the target page loads correctly in the browser
- verify login still works
- verify SSH still works

If a change touches shared stock files, verify more than just the edited page.

## What To Study Before Building A New Jtools Page

Read these first:

- [MASTER_TRUTH.md](/c:/at_terminal/repo-public/docs/MASTER_TRUTH.md)
- [router-files/stock-ui-at/README.md](/c:/at_terminal/repo-public/router-files/stock-ui-at/README.md)
- [CFW3212_stock_ui_AT_integration_note.txt](/c:/at_terminal/notes/CFW3212_stock_ui_AT_integration_note.txt)
- [CFW3212_ookla_speedtest_page_plan.txt](/c:/at_terminal/notes/CFW3212_ookla_speedtest_page_plan.txt)
- [adb-and-ssh-persistence.md](/c:/at_terminal/repo-public/docs/adb-and-ssh-persistence.md)
- [CFW3212_proven_commands_cheatsheet.txt](/c:/at_terminal/notes/CFW3212_proven_commands_cheatsheet.txt)

Important note for new AI sessions:

- the `notes/` folder is not fluff
- it contains the real implementation history, proven traps, recovery details, and working deployment flow
- read it before proposing architecture changes

## Recommended AI Behavior On This Project

If you are a new AI session working on this project:

- read this file first
- then read the stock UI integration note and the Speedtest plan
- do not assume generic web-app patterns apply cleanly here
- do not assume a new Jtools page is “just HTML plus a route”
- trace a working page from menu -> auth -> route -> HTML -> JS -> backend helper -> overlay apply
- be conservative with shared stock files
- protect LAN, login, and SSH access
- keep install/uninstall friendliness in mind

## Agent Handoff Workflow

Current preferred multi-agent workflow for this project:

- Codex is the backbone for integration, risk control, deployment flow, rollback awareness, and end-to-end tracing
- Claude is preferred for higher-risk architecture work, shared bootstrap/theme/menu wiring, backend/API reshaping, and dependency untangling
- Composer is preferred for narrower and cheaper tasks such as small CSS polish, isolated page tweaks, token bumps, copy edits, and low-risk responsive cleanup

Practical handoff rule:

- if a task touches shared stock files, page bootstrap flow, menu/auth wiring, uninstall behavior, or backend contracts, prefer Claude or Codex
- if a task is isolated to one page and mostly visual/polish work, Composer is usually the better cost choice
- after any offloaded work, Codex should re-check integration assumptions before live deploy

Current user direction:

- preserve a clear uninstall path back to stock
- keep changes documented when stock UI overlay behavior or workflow changes
- call out when a task is a good candidate to pass to Claude or Composer

## Short Prompt Snippet You Can Reuse

Use this at the start of a new AI chat:

`Read /c:/at_terminal/repo-public/docs/MASTER_TRUTH.md first, then read /c:/at_terminal/notes/CFW3212_stock_ui_AT_integration_note.txt and /c:/at_terminal/notes/CFW3212_ookla_speedtest_page_plan.txt before suggesting or editing anything. This device is a Casa Systems CFW-3212 with a Quectel RG520N-NA, uses a stock UI overlay under /usrdata/at-stock-ui with late-boot bind mounts, and changes must be careful not to break LAN, stock login, or SSH.`

## Source Docs Behind This File

This file was consolidated from the current project docs and notes, especially:

- [repo-public/README.md](/c:/at_terminal/repo-public/README.md)
- [router-files/stock-ui-at/README.md](/c:/at_terminal/repo-public/router-files/stock-ui-at/README.md)
- [adb-and-ssh-persistence.md](/c:/at_terminal/repo-public/docs/adb-and-ssh-persistence.md)
- [CFW3212_stock_ui_AT_integration_note.txt](/c:/at_terminal/notes/CFW3212_stock_ui_AT_integration_note.txt)
- [CFW3212_ookla_speedtest_page_plan.txt](/c:/at_terminal/notes/CFW3212_ookla_speedtest_page_plan.txt)
- [CFW3212_proven_commands_cheatsheet.txt](/c:/at_terminal/notes/CFW3212_proven_commands_cheatsheet.txt)
- [CFW3212_jtools_overlay_wiring_SMS_lesson.txt](/c:/at_terminal/notes/CFW3212_jtools_overlay_wiring_SMS_lesson.txt)

If anything in this file conflicts with a newer detailed note, update this file so it stays the top-level truth.

## Installer Status Checkpoint

Date: 2026-03-30

- Current installer/uninstaller work is real and reusable, but not yet the final “public release done” state.
- Working pieces already validated on Device 01:
  - Windows-over-SSH install flow
  - update/reinstall flow
  - overlay-only uninstall
  - full uninstall with optional Ookla / Tailscale cleanup
  - first-install baseline capture from the router's live stock trees
  - bundled offline Ookla path
- Important current router state:
  - `jtools-stock-ui.timer` and `.service` are part of the package
  - a persistence failure was caught after reboot because the timer existed but was not enabled on Device 01
  - installer now needs to fail loudly if `jtools-stock-ui.timer` is not actually `enabled`
- Current known follow-up items before calling it a polished public first release:
  - finish UI cleanup/regression fixes from recent polish work
  - keep installer/uninstaller notes current while UI work continues
  - revisit the stock-side dark-mode cleanup boundary later so install-time overlay behavior and uninstall-time stock expectations stay honest
  - keep uninstall verification aligned with the real shared-file override set as stock-side dark-mode ownership evolves
- installer baseline recapture should stay a last-resort explicit action, not a default update behavior
- Practical handoff rule:
  - do not assume installer/uninstaller is “done done”
  - treat it as working infrastructure that should be resumed after the current UI polish pass
