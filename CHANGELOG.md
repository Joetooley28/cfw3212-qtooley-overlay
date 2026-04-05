# Changelog

## v0.3.5-qtooley-2026-04-05

Public release documentation and release-flow polish for the Qtooley stock UI overlay.

Included:
- public GitHub docs reorganized to lead with the install-path choice and highest-signal project truths
- release install guide clarified around first-install baseline behavior, space planning, and the `upgrade.star` cleanup warning
- Windows ZIP path clearly labeled as the no-internet install and uninstall method
- Settings page can now launch the router-side GitHub updater directly with an `Update now` action
- public release metadata refreshed to align with the current release label

Key behavior:
- public readers now see the `No router internet yet` versus `Router already has internet` split earlier
- the installer still preserves the one-time first-install stock baseline model
- direct GitHub router install, update, and uninstall still point to the same packaged release flow
- routers that already have internet can now start the GitHub release update directly from the Settings page
- bundled Ookla remains part of the expected public release ZIP flow

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
