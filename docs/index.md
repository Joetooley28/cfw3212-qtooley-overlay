# CFW-3212 Qtooley Overlay

> Feature status: cell locking is still under development and is not working yet.

Qtooley is a stock UI overlay for the Casa Systems `CFW-3212` with a Quectel `RG520N-NA`.

This is the public landing page for the current project direction: a top-level authenticated Qtooley tab inside the stock Casa Turbo web UI, with custom pages for modem visibility, control, and diagnostics.

It is not a generic web app and it is not a generic USB modem project.

## Contents

- [Download](#download)
- [What You Get](#what-you-get)
- [Install Flow](#install-flow)
- [Device Scope](#device-scope)
- [Platform Notes](#platform-notes)
- [Screenshots](#screenshots)
- [Project Tracks](#project-tracks)
- [Docs](#docs)

## Download

- [Latest Release](https://github.com/Joetooley28/cfw3212-qtooley-overlay/releases/latest)
- [Quick Must Read](quick-must-read.md)
- Install guide: [RELEASE_INSTALL.md](../router-files/stock-ui-at/RELEASE_INSTALL.md)
- Main repo README: [README.md](../README.md)
- Platform notes: [platform-notes.md](platform-notes.md)

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

- the shared dark mode toggle applies across themed stock UI pages and Qtooley pages, so the UI keeps one consistent light or dark presentation instead of separate theme modes per section

## Install Flow

**Normal Windows install (No internet on modem yet)**

- start with [Quick Must Read](quick-must-read.md)
- use the top ZIP in the `Assets` section of the latest [release page](https://github.com/Joetooley28/cfw3212-qtooley-overlay/releases/latest)
- do not use the auto-generated `Source code` download
- extract the ZIP
- follow the packaged `README.txt` for the exact Windows install, update, and uninstall commands
- the public Windows installer flow is SSH-only


**Direct router install/update/uninstall (Internet already working on modem)**

- use the direct router `wget` install/update and uninstall commands in [RELEASE_INSTALL.md](../router-files/stock-ui-at/RELEASE_INSTALL.md)

Prerequisites:

- rooted router
  Full credit to [@Luke](https://github.com/lukejenkins/cellular/tree/main/casasystems/cfw3212) for the root script and the broader `CFW-3212` platform research.
- if you need the root script itself, start in Luke's [`casasystems/cfw3212/tools`](https://github.com/lukejenkins/cellular/tree/main/casasystems/cfw3212/tools) folder
- if you are starting from a stock carrier-managed box, also read Luke's [`guide_block_carrier_remote_mgmt`](https://github.com/lukejenkins/cellular/blob/main/casasystems/cfw3212/guide_block_carrier_remote_mgmt.md) to block the carrier remote-management path
- read [Quick Must Read](quick-must-read.md) for the first-install snapshot behavior and space notes
- SSH already enabled and reachable
- Windows built-in `ssh` client available

## Device Scope

Target platform:

- router: Casa Systems `CFW-3212`
- modem: Quectel `RG520N-NA`
- tested router firmware: `USC_1.1.79.0`
- tested module firmware seen in notes: `RG520NNADAR03A03M4G`

Important platform truths:

- `/usrdata` is the writable persistent area
- the proven AT backend path is `/dev/smd7`
- shared AT lock path is `/tmp/at-http.lock`
- the proven persistence model is the stock UI overlay under `/usrdata/at-stock-ui`

## Platform Notes

The overlay is designed around the real behavior of this router:

- preserve LAN access
- preserve the stock login page and stock UI rendering
- preserve SSH reachability
- use the proven live-tree bind-mount model
- keep install and uninstall practical

Current proven model:

- keep payload under `/usrdata/at-stock-ui`
- build live trees under `/usrdata/at-stock-ui/live`
- bind-mount `live/www` onto `/www`
- bind-mount `live/usr/share/lua/5.1/webif` onto `/usr/share/lua/5.1/webif`
- restart `turbontc.service`
- reapply late after boot with `jtools-stock-ui.service` and `jtools-stock-ui.timer`

## Screenshots

### Quick Overview

![Quick Overview](images/qtooley/quick-overview.jpg)

### General Info

![General Info](images/qtooley/general-info.jpg)

### AT Terminal

![AT terminal](images/qtooley/at-terminal.jpg)

### SMS

![SMS](images/qtooley/sms.jpg)

### Settings

![Settings](images/qtooley/screensaver-settings.jpg)

### RAT / Band / Cell Locking

![RAT / band / cell locking](images/qtooley/rat-band.jpg)

### Ookla Speedtest

![Ookla Speedtest](images/qtooley/speedtest.jpg)

### Tailscale

![Tailscale](images/qtooley/tailscale.jpg)

### TTL Helper

![TTL helper](images/qtooley/ttl-helper.jpg)

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

## Docs

- [Quick Must Read](quick-must-read.md)
- [Release Install Guide](../router-files/stock-ui-at/RELEASE_INSTALL.md)
- [platform-notes.md](platform-notes.md)
