# CFW-3212 Standalone AT Terminal

Legacy branch draft README for the standalone LAN AT terminal track.

Suggested branch name:

- `standalone-at-terminal`

## What This Branch Is

This branch preserves the older standalone AT terminal for the Casa Systems `CFW-3212` with a Quectel `RG520N-NA`.

It serves a LAN-accessible AT terminal at:

- `http://192.168.1.1:8088/`

This branch is useful as:

- a legacy project track
- a fallback tool
- a reference for the earlier direct LAN terminal work

It is not the primary project direction anymore.

## Current Project Direction

The main project has moved to the Qtooley stock UI overlay on the `main` branch.

If you are new to the project, start there first.

Suggested wording:

- primary branch: Qtooley stock UI overlay
- legacy branch: standalone AT terminal

## Important Warning

Do not casually install and run this branch alongside the stock UI overlay as if they are separate products.

Important overlap:

- both tracks target the same router and modem platform
- both use the same platform-native AT backend model
- both depend on the same shared lock discipline around modem access
- both can affect the same modem state and router behavior

The shared lock path is:

- `/tmp/at-http.lock`

If both tracks are kept published, this branch should be clearly marked as:

- legacy
- fallback
- reference

## Device Scope

Target platform:

- router: Casa Systems `CFW-3212`
- modem: Quectel `RG520N-NA`
- tested router firmware: `USC_1.1.79.0`
- tested module firmware seen in notes: `RG520NNADAR03A03M4G`

Important platform truths:

- this is not a generic host-PC plus USB modem project
- the proven backend path is `/dev/smd7`
- the standalone service binds to `192.168.1.1:8088`
- `/usrdata` is the writable persistent area

## What This Branch Provides

- standalone Lua AT backend
- standalone browser UI
- late-boot timer/service start model
- direct modem access through the platform-native AT path

## What It Does Not Try To Be

It does not:

- modify Casa Turbo
- replace stock Casa web services
- replace stock `port_bridge`
- act like a generic USB serial modem manager

## Recommended Use

Use this branch if you specifically want:

- the older standalone terminal workflow
- a simpler fallback tool outside the stock UI overlay
- a historical/reference branch for early project behavior

If you want the current primary project, use the Qtooley overlay on `main`.

## Suggested Links

For the standalone branch README, include links like:

- `docs/installing-at-terminal.md`
- `docs/at-terminal-usage.md`
- `docs/validator-policy.md`

And include a pointer back to the main branch:

- `main` = current Qtooley overlay

## Suggested Title Options

Pick one of these:

1. `CFW-3212 Standalone AT Terminal`
2. `CFW-3212 Legacy Standalone AT Terminal`
3. `CFW-3212 AT Terminal (Legacy Branch)`
