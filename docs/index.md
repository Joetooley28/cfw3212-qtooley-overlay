# CFW-3212 Qtooley Overlay

> TESTING ONLY: this branch is not ready for public release yet. Cell locking is still under development and not working yet.

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
- Install guide: [RELEASE_INSTALL.md](../router-files/stock-ui-at/RELEASE_INSTALL.md)
- Emergency recovery: [fallback-stock-recovery.md](fallback-stock-recovery.md)
- Main repo README: [README.md](../README.md)

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

1. Download the latest Windows release ZIP.
2. Run the PowerShell installer from a normal Windows PC.
3. Connect over SSH with the router IP, username, and password.
4. Let the installer place the Qtooley overlay and bundled Ookla base components.
5. If you want Tailscale, install it afterward from the Qtooley UI as the optional extra.

Prerequisites:

- rooted router
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

- [Release Install Guide](../router-files/stock-ui-at/RELEASE_INSTALL.md)
- [Emergency Stock Web Recovery](fallback-stock-recovery.md)
- [platform-notes.md](platform-notes.md)
