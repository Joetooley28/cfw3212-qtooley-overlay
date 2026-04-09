# CFW-3212 Qtooley Overlay

> [!IMPORTANT]
> Now ready for public testing.
> Confirmed working so far on router firmware `USC_1.1.79.0` and `USC_1.1.99.0`.
> I still have one more box on `USC_1.2.24.0` that needs testing.
> Other router firmware versions still need to be confirmed.
> Cell locking is still under development and not working yet.

Qtooley is a stock UI overlay for the Casa Systems `CFW-3212` with a Quectel `RG520N-NA`.

It adds a top-level authenticated `Qtooley` tab inside the stock Casa Turbo web UI for modem visibility, control, and diagnostics.

A lot of time and effort went into the uninstall path so the router can return as closely as possible to a clean stock UI state after Qtooley is removed. The install process captures a router-specific stock baseline on first install, and uninstall uses that saved baseline plus tracked stock-file verification to restore shared stock UI files cleanly.

This is not a generic web app and it is not a generic USB modem project.

## Start Here

- [Quick Must Read](docs/quick-must-read.md)
- [Latest Release](https://github.com/Joetooley28/cfw3212-qtooley-overlay/releases/latest)
- [Windows ZIP Install Guide](docs/windows-zip-install.md)
- [Screenshots](#screenshots)
- [Platform Notes](docs/platform-notes.md)

## What You Get

- Quick Overview
- General Info
- AT terminal
- Settings page with screensaver controls and release/update status
- RAT / band / cell locking
- Ookla Speedtest
- TTL helper
- optional Tailscale UI after base install

Dark mode note:

- the shared dark mode toggle applies across themed stock UI pages and Qtooley pages

## Install Summary

- start with [Quick Must Read](docs/quick-must-read.md)
- for normal Windows install, update, or uninstall:
  - use the top ZIP in the `Assets` section of the latest [release page](https://github.com/Joetooley28/cfw3212-qtooley-overlay/releases/latest)
  - extract the ZIP
  - follow the packaged `README.txt`
- for the direct router `wget` install/update and uninstall commands:
  - use [Release Install Guide](router-files/stock-ui-at/RELEASE_INSTALL.md)

## Before You Install

- the router must already be rooted
  Full credit to [@Luke](https://github.com/lukejenkins/cellular/tree/main/casasystems/cfw3212) for the root script and the broader `CFW-3212` platform research.
- if you need the root script itself, start in Luke's [`casasystems/cfw3212/tools`](https://github.com/lukejenkins/cellular/tree/main/casasystems/cfw3212/tools) folder
- if you are starting from a stock carrier-managed box, also read Luke's [`guide_block_carrier_remote_mgmt`](https://github.com/lukejenkins/cellular/blob/main/casasystems/cfw3212/guide_block_carrier_remote_mgmt.md) to block the carrier remote-management path
- read [Quick Must Read](docs/quick-must-read.md) for the first-install snapshot behavior and space notes
- SSH must already be enabled and reachable
- the normal public release asset is the Windows ZIP
- bundled Ookla is expected in public release ZIPs
- Tailscale is optional and is installed later from the Qtooley UI

## Device Scope

Tested and documented target:

- router: Casa Systems `CFW-3212`
- modem: Quectel `RG520N-NA`
- tested so far on router firmware: `USC_1.1.79.0` and `USC_1.1.99.0`
- `USC_1.2.24.0` appears in the stock comparison notes, but Qtooley release testing on that version still needs confirmation
- other router firmware versions may work, but still need confirmation
- tested module firmware seen in notes: `RG520NNADAR03A03M4G`

Important platform truths:

- `/usrdata` is the writable persistent area
- the proven AT backend path is `/dev/smd7`
- the shared AT lock path is `/tmp/at-http.lock`
- the proven persistence model is the stock UI overlay under `/usrdata/at-stock-ui`

## Platform Notes

The overlay is built around the real behavior of this router:

- preserve LAN access
- preserve the stock login page and stock UI shell
- preserve SSH reachability
- keep the proven `/usrdata/at-stock-ui` overlay model
- avoid redesigning the project around generic USB modem assumptions

Current proven overlay model:

- keep payload under `/usrdata/at-stock-ui`
- build live trees under `/usrdata/at-stock-ui/live`
- bind-mount `live/www` onto `/www`
- bind-mount `live/usr/share/lua/5.1/webif` onto `/usr/share/lua/5.1/webif`
- restart `turbontc.service`
- reapply late after boot with `jtools-stock-ui.service` and `jtools-stock-ui.timer`

Verification note:

- plain `mount` output is misleading on this device
- use `/proc/self/mountinfo`

## Project Tracks

There are three branch roles in the current project layout:

- `main`: public-facing release and docs branch
- `working-branch`: active source and development branch
- `standalone-at-terminal-old`: legacy older branch

If you are new to the project, use `main`.

## Screenshots

![Quick Overview](docs/images/qtooley/quick-overview.jpg)

### General Info

![General Info](docs/images/qtooley/general-info.jpg)

### AT Terminal

![AT terminal](docs/images/qtooley/at-terminal.jpg)

### SMS

![SMS](docs/images/qtooley/sms.jpg)

### Settings

![Settings](docs/images/qtooley/screensaver-settings.jpg)

### RAT / Band / Cell Locking

![RAT / band / cell locking](docs/images/qtooley/rat-band.jpg)

### Ookla Speedtest

![Ookla Speedtest](docs/images/qtooley/speedtest.jpg)

### Tailscale

![Tailscale](docs/images/qtooley/tailscale.jpg)

### TTL Helper

![TTL helper](docs/images/qtooley/ttl-helper.jpg)

## More Docs

- [Quick Must Read](docs/quick-must-read.md)
- [Windows ZIP Install Guide](docs/windows-zip-install.md)
- [Release Install Guide](router-files/stock-ui-at/RELEASE_INSTALL.md)
- [Docs Index](docs/index.md)
- [Platform Notes](docs/platform-notes.md)
