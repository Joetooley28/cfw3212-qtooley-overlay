# CFW-3212 Qtooley Overlay

Qtooley is a stock UI overlay for the Casa Systems `CFW-3212` with a Quectel `RG520N-NA`.

This branch is the main project direction: a top-level authenticated Qtooley tab inside the stock Casa Turbo web UI, with custom pages for modem visibility, control, and diagnostics.

It is not a generic web app and it is not a generic USB modem project.

## Contents

- [What This Project Is](#what-this-project-is)
- [Device Scope](#device-scope)
- [Main Features](#main-features)
- [Project Tracks](#project-tracks)
- [Safety Notes](#safety-notes)
- [How The Overlay Works](#how-the-overlay-works)
- [Repo Layout](#repo-layout)
- [Current Pages](#current-pages)
- [Important Docs](#important-docs)
- [Install Model](#install-model)
- [Current Version](#current-version)

## What This Project Is

This repo contains the current Qtooley stock UI overlay work for the `CFW-3212`.

The overlay adds Qtooley pages into the stock Casa interface while preserving:

- LAN access
- stock login flow
- stock page rendering
- SSH reachability
- standalone AT access discipline through the shared modem lock

The current preferred direction is the stock UI overlay, not the older standalone-only web terminal.

## Device Scope

Tested / documented project target:

- router: Casa Systems `CFW-3212`
- modem: Quectel `RG520N-NA`
- tested router firmware: `USC_1.1.79.0`
- tested module firmware seen in notes: `RG520NNADAR03A03M4G`

Important platform truths:

- `/usrdata` is the writable persistent area
- the proven AT backend path is `/dev/smd7`
- shared AT lock path is `/tmp/at-http.lock`
- the stock UI overlay uses live-tree bind mounts onto `/www` and `/usr/share/lua/5.1/webif`

## Main Features

- authenticated Qtooley tab inside the stock Casa UI
- Quick Overview page with screensaver path
- General Info dashboard
- AT terminal page
- RAT / band / cell locking page
- Ookla Speedtest page
- TTL helper page
- shared Qtooley color-key system across custom pages
- shared dark/light theming path through stock header integration

## Project Tracks

There are two related tracks in this project history:

1. `main`

This branch is the current Qtooley stock UI overlay and should be treated as the primary project.

2. `standalone-at-terminal`

This will be the legacy standalone LAN AT terminal branch.

Important:

- both tracks share backend assumptions and modem access discipline
- both rely on the same platform-native AT path model
- both use the same shared lock concept around modem access
- do not casually install and run both as if they were isolated products

If both are kept published, the stock UI overlay should be the recommended path and the standalone branch should be clearly marked as legacy / fallback / reference.

## Safety Notes

Be careful not to break:

- LAN access
- the stock web login page
- SSH
- stock Casa Turbo rendering
- shared page bootstrap files

High-risk areas include:

- `handler_0011.lua`
- `genHeader.js`
- menu injection
- auth wiring
- shared stock JS/CSS includes
- overlay mount/apply logic

Use the smallest safe change.

## How The Overlay Works

Current proven model:

- keep payload under `/usrdata/at-stock-ui`
- build live trees under `/usrdata/at-stock-ui/live`
- bind-mount `live/www` onto `/www`
- bind-mount `live/usr/share/lua/5.1/webif` onto `/usr/share/lua/5.1/webif`
- restart `turbontc.service`
- reapply late after boot with:
  - `jtools-stock-ui.service`
  - `jtools-stock-ui.timer`

Verification note:

- plain `mount` output is misleading on this device
- use `/proc/self/mountinfo`

## Repo Layout

Main stock UI overlay package:

- [router-files/stock-ui-at](/c:/at_terminal/repo-public/router-files/stock-ui-at)

Important areas:

- [router-files/stock-ui-at/www](/c:/at_terminal/repo-public/router-files/stock-ui-at/www)
- [router-files/stock-ui-at/usr/share/lua/5.1/webif](/c:/at_terminal/repo-public/router-files/stock-ui-at/usr/share/lua/5.1/webif)
- [router-files/stock-ui-at/usrdata/at-stock-ui](/c:/at_terminal/repo-public/router-files/stock-ui-at/usrdata/at-stock-ui)
- [docs](/c:/at_terminal/repo-public/docs)

## Current Pages

- Quick Overview
- General Info
- AT terminal
- RAT / band / cell locking
- Ookla Speedtest
- TTL helper

## Important Docs

Start here:

- [Master Truth](docs/MASTER_TRUTH.md)
- [Stock UI Integration Note](/c:/at_terminal/notes/CFW3212_stock_ui_AT_integration_note.txt)
- [Speedtest Page Plan](/c:/at_terminal/notes/CFW3212_ookla_speedtest_page_plan.txt)
- [Stock UI Package README](router-files/stock-ui-at/README.md)

Useful supporting docs:

- [adb-and-ssh-persistence.md](docs/adb-and-ssh-persistence.md)
- [platform-notes.md](docs/platform-notes.md)
- [validator-policy.md](docs/validator-policy.md)

## Install Model

This repo is currently organized around local-first development and router-side overlay deployment.

The current expected flow is:

- make changes locally
- verify package structure under `router-files/stock-ui-at`
- sync only the intended files to the router
- reapply the overlay
- verify the live bind mounts and actual in-browser behavior

## Current Version

- repo version: `v0.3.0-qtooley-2026-03-24`
- current local checkpoint branch: `qtooley-current`

## Publish Notes

Before pushing to GitHub:

- keep this branch as the main project landing page
- create a separate legacy branch for the standalone AT terminal
- add a branch-specific legacy README there warning users not to blindly install both tracks together
