# Changelog

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
