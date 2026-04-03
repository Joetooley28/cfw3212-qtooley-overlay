# CFW-3212 Qtooley Overlay

Qtooley is a stock UI overlay for the Casa Systems `CFW-3212` with a Quectel `RG520N-NA`.

This is the main project direction: a top-level authenticated Qtooley tab inside the stock Casa Turbo web UI, with custom pages for modem visibility, control, and diagnostics.

It is not a generic web app and it is not a generic USB modem project.

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

- [Release Install Guide](router-files/stock-ui-at/RELEASE_INSTALL.md)

## Why This Overlay Exists

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

![Qtooley General Info](docs/images/qtooley/general-info.jpg)

Key pages in the current overlay:

### Quick Overview

![Quick Overview](docs/images/qtooley/quick-overview.jpg)

### General Info

![General Info](docs/images/qtooley/general-info.jpg)

### RAT / Band / Cell Locking

![RAT / band / cell locking](docs/images/qtooley/rat-band.jpg)

### Ookla Speedtest

![Ookla Speedtest](docs/images/qtooley/speedtest.jpg)

### Tailscale

![Tailscale](docs/images/qtooley/tailscale.jpg)

## Project Tracks

There are two related tracks in this project history:

1. `main`

This branch is the current Qtooley stock UI overlay and should be treated as the primary project.

2. `standalone-at-terminal`

This is the legacy standalone LAN AT terminal branch.

Important:

- both tracks share backend assumptions and modem access discipline
- both rely on the same platform-native AT path model
- both use the same shared lock concept around modem access
- do not casually install and run both as if they were isolated products

If both are published, the stock UI overlay should be the recommended path and the standalone branch should be clearly marked as legacy / fallback / reference.

## Repo Layout

Main stock UI overlay package root:

- [router-files/stock-ui-at](/c:/at_terminal/repo-public/router-files/stock-ui-at)

Important areas:

- [router-files/stock-ui-at/www](/c:/at_terminal/repo-public/router-files/stock-ui-at/www)
- [router-files/stock-ui-at/usr/share/lua/5.1/webif](/c:/at_terminal/repo-public/router-files/stock-ui-at/usr/share/lua/5.1/webif)
- [router-files/stock-ui-at/usrdata/at-stock-ui](/c:/at_terminal/repo-public/router-files/stock-ui-at/usrdata/at-stock-ui)
- [docs](/c:/at_terminal/repo-public/docs)

## Important Docs

Recommended starting points:

- [Master Truth](docs/MASTER_TRUTH.md)
- [Stock UI Package README](router-files/stock-ui-at/README.md)
- [Release Install Guide](router-files/stock-ui-at/RELEASE_INSTALL.md)
- [Stock UI Integration Note](/c:/at_terminal/notes/CFW3212_stock_ui_AT_integration_note.txt)
- [Speedtest Page Plan](/c:/at_terminal/notes/CFW3212_ookla_speedtest_page_plan.txt)

Useful supporting docs:

- [adb-and-ssh-persistence.md](docs/adb-and-ssh-persistence.md)
- [platform-notes.md](docs/platform-notes.md)
- [validator-policy.md](docs/validator-policy.md)

## Current Version

- repo version: `v0.3.0-qtooley-2026-03-24`
- current local checkpoint branch: `qtooley-current`

## Publishing Notes

Before pushing to GitHub:

- keep this branch as the main project landing page
- create a separate legacy branch for the standalone AT terminal
- add a branch-specific legacy README there warning users not to blindly install both tracks together
