# Changelog

## v0.3.9-qtooley-2026-04-10

Shared theme/header cleanup for the Qtooley stock UI overlay, plus the licensing clarification work already present on `working-branch`.

Included:
- promoted the approved shared Qtooley header and tab styling work from the side branch into `working-branch`
- fixed dark-header hit areas so the `Qtooley` top tab and logout icon both keep the right click targets
- made Qtooley light and dark mode share one tab shape/spacing system while keeping theme-specific tab colors
- restored stock Casa dark-mode sidebar readability and expandable arrow behavior on non-Qtooley pages
- kept the newer mixed-license notice and licensing clarifications already added on `working-branch`

Key behavior:
- Qtooley header now keeps the accepted dark header look without the earlier broken click/hit-area behavior
- Qtooley left tabs now keep one shared shape between light and dark mode instead of falling back to the older stock light-tab look
- stock dark-mode sidebars keep readable text and dropdown arrows instead of regressing during the Qtooley tab-sharing work
- the release still includes the licensing clarification files already added on this branch:
  - `LICENSE`
  - `LICENSE-docs.md`
  - `NOTICE.md`

## v0.3.8-qtooley-2026-04-08

Box 2 stock-page compatibility and release-flow hardening for the Qtooley stock UI overlay.

Included:
- restored stock auth coverage for `LoginTimeCheck`, `lteCellInfo`, and `nr5gCellInfo` in the shared `userGroupAuth.lua` overlay
- removed the older temporary `status.html` invalid-request suppression from shared `genHeader.js` after the authenticated Box 2 retest passed
- refreshed the shared `genHeader.js` cache token across the Jtools page shells
- fixed release packaging so `JTOOLS_RELEASE.txt` token lines are retokenized to match the packaged asset versions
- fixed offline Tailscale install/update handling so failed downloads stay on the error path without reintroducing the Tailscale tab flash

Key behavior:
- clean-stock Box 2 no longer throws the broad post-install `Invalid request` banner across many stock Networking / Services / System pages
- `status.html` now succeeds using the real stock auth objects instead of relying on the earlier hide/suppress workaround
- install and update packages now carry the Box 2 auth fix
- no-internet Tailscale install attempts now return the failure banner instead of a false installed-success modal
- the tested non-flashing Tailscale page assets remain intact
- uninstall still restores the tracked shared stock files back to the saved baseline
- local release builds in the safe `main` worktree now keep `dist/` untracked

## v0.3.3-qtooley-2026-04-04

Public release cleanup for the Qtooley stock UI overlay.

Included:
- direct GitHub install/update/uninstall now bootstrap from the published release ZIP instead of separate router-package assets
- release packaging now returns to a single public Windows ZIP asset model
- release/install wording now leads with the `router has internet` versus `router does not` choice

Key behavior:
- the router-side GitHub helpers discover the newest versioned release ZIP from GitHub release metadata and then run the same packaged install/uninstall core
- this keeps the public release assets cleaner while preserving the shared install/update/uninstall flow
- the public release page can now emphasize one downloadable ZIP plus copy/paste SSH commands

## v0.3.2-qtooley-2026-04-04

Release usability follow-up for the Qtooley stock UI overlay.

Included:
- direct GitHub uninstall helper to match the router-native install/update path
- clearer README and release guide wording for when to use the ZIP vs direct GitHub commands
- direct uninstall command documentation, including optional Tailscale removal

Key behavior:
- internet-connected routers can now install, update, and uninstall from SSH using the same release-package flow
- uninstall still runs through the packaged uninstall core and keeps the first-install baseline verification model intact
- release docs now point users more clearly to the Windows ZIP as the primary download asset

## v0.3.1-qtooley-2026-04-04

Release packaging and install-path update for the Qtooley stock UI overlay.

Included:
- router-native GitHub install/update entrypoint for connected routers
- router-friendly release tarball output alongside the Windows installer ZIP
- SHA256 release files for the router package
- release docs updated to cover the direct-from-GitHub router install path

Key behavior:
- normal GitHub-driven install/update reuses the same router-side install core as the Windows ZIP flow
- first-install uninstall baseline capture remains one-time by default and is not recaptured during normal updates
- explicit version/date tracking now starts from the GitHub release flow

## v0.3.0-qtooley-2026-03-24

Current Qtooley stock UI checkpoint on branch `qtooley-current`.

Included:
- shared cross-page Qtooley color key for carrier, RAT, band, signal, and temperature states
- upgraded 2026-style buttons, badges, and dropdowns across custom pages
- stabilized sequential Ookla Speedtest gauge flow and simplified details UI
- General Info, Quick Overview, screensaver, and Speedtest consistency pass
- Band / cell locking UI cleanup plus safer acquisition-order handling
- RG520 module card asset packaged in-repo instead of depending on router leftovers

Key behavior:
- current local checkpoint commit is `71863c8`
- desktop snapshot label is `current-qtooley-2026-03-24`
- stock UI overlay backend remains rooted in the Casa bind-mount live-tree model
- shared AT access still uses `/tmp/at-http.lock`

## v0.1.0

Initial shareable standalone AT terminal release for the Casa Systems CFW-3212.

Included:
- standalone Lua AT backend
- standalone browser UI
- LAN bind on `192.168.1.1:8088`
- validator policy for practical admin use
- dark mode toggle
- copy-all buttons
- late boot auto-start via systemd timer

Key behavior:
- default backend is `smd7_direct`
- uses the platform-native `smd` AT path directly
- separate from Casa Turbo
- no stock port_bridge replacement
