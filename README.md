# CFW-3212 Qtooley Overlay

Qtooley is a stock UI overlay for the Casa Systems `CFW-3212` with a Quectel `RG520N-NA`.

This is the main project direction: a top-level authenticated Qtooley tab inside the stock Casa Turbo web UI, with custom pages for modem visibility, control, and diagnostics.

It is not a generic web app and it is not a generic USB modem project.

## Download

- [Latest Release](https://github.com/Joetooley28/cfw3212-qtooley-overlay/releases/latest)
- [Release Install Guide](router-files/stock-ui-at/RELEASE_INSTALL.md)
- [Emergency Stock Web Recovery](docs/fallback-stock-recovery.md)

## Contents

- [Download](#download)
- [What This Project Is](#what-this-project-is)
- [Device Scope](#device-scope)
- [Install Flow](#install-flow)
- [Platform Notes](#platform-notes)
- [Screenshots](#screenshots)
- [Project Tracks](#project-tracks)
- [Important Docs](#important-docs)
- [Current Version](#current-version)

## What This Project Is

Qtooley adds custom tools into the stock router UI while preserving the proven login flow, the stock page shell, and the current overlay persistence model.

The current feature set includes:

- Quick Overview
- General Info
- AT terminal
- RAT / band / cell locking
- Ookla Speedtest
- TTL helper
- optional Tailscale UI after base install

The preferred direction is the stock UI overlay, not the older standalone-only AT terminal branch.

## Device Scope

Tested and documented target:

- router: Casa Systems `CFW-3212`
- modem: Quectel `RG520N-NA`
- tested router firmware: `USC_1.1.79.0`
- tested module firmware seen in notes: `RG520NNADAR03A03M4G`

Important platform truths:

- `/usrdata` is the writable persistent area
- the proven AT backend path is `/dev/smd7`
- shared AT lock path is `/tmp/at-http.lock`
- the stock UI overlay uses live-tree bind mounts onto `/www` and `/usr/share/lua/5.1/webif`

## Install Flow

The public install path is a versioned Windows ZIP release for a rooted, SSH-reachable router:

1. download the latest release ZIP
2. run the PowerShell installer from a normal Windows PC
3. connect over SSH with the router IP, username, and password
4. let the installer place the Qtooley overlay and bundled Ookla base components
5. if you want Tailscale, install it afterward from the Qtooley UI as the optional extra

Important prerequisites:

- the router must already be rooted
- SSH must already be enabled and reachable
- password prompt is supported; SSH keys are optional

More install detail:

- [Latest Release](https://github.com/Joetooley28/cfw3212-qtooley-overlay/releases/latest)
- [Release Install Guide](router-files/stock-ui-at/RELEASE_INSTALL.md)
- [Emergency Stock Web Recovery](docs/fallback-stock-recovery.md)

## Platform Notes

The overlay is designed around the real behavior of this router and the real failure modes already seen during development:

- preserve LAN access
- preserve the stock login page and stock UI rendering
- preserve SSH reachability
- keep the proven stock UI overlay model under `/usrdata/at-stock-ui`
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

## Screenshots

![Quick Overview](docs/images/qtooley/quick-overview.jpg)

### General Info

![General Info](docs/images/qtooley/general-info.jpg)

### AT Terminal

![AT terminal](docs/images/qtooley/at-terminal.jpg)

### SMS

![SMS](docs/images/qtooley/sms.jpg)

### Screensaver Settings

![Screensaver Settings](docs/images/qtooley/screensaver-settings.jpg)

### RAT / Band / Cell Locking

![RAT / band / cell locking](docs/images/qtooley/rat-band.jpg)

### Ookla Speedtest

![Ookla Speedtest](docs/images/qtooley/speedtest.jpg)

### Tailscale

![Tailscale](docs/images/qtooley/tailscale.jpg)

### TTL Helper

![TTL helper](docs/images/qtooley/ttl-helper.jpg)

## Project Tracks

There are three branch roles in the current project layout:

- `main`: current Qtooley stock UI overlay release, primary and recommended branch
- `working-branch`: current overlay development branch
- `standalone-at-terminal-old`: older standalone LAN AT terminal, legacy fallback/reference branch

Important warning:

- both tracks share backend assumptions and modem access discipline
- both rely on the same platform-native AT path model
- both use the same shared lock concept around modem access
- do not casually install and run both as if they were isolated products
- if you are new to the project, use `main` rather than `working-branch` or the old standalone branch

## Important Docs

Public starting points:

- [Release Install Guide](router-files/stock-ui-at/RELEASE_INSTALL.md)
- [Emergency Stock Web Recovery](docs/fallback-stock-recovery.md)
- [platform-notes.md](docs/platform-notes.md)

## Current Version

- repo version: `v0.3.0-qtooley-2026-03-24`
- latest packaged release: [GitHub Releases](https://github.com/Joetooley28/cfw3212-qtooley-overlay/releases/latest)
