# CFW-3212 Standalone AT Terminal (Old)

This branch preserves the older standalone LAN AT terminal for the Casa Systems `CFW-3212` with a Quectel `RG520N-NA`.

This is the old project track. If you are new to the project, use the Qtooley stock UI overlay on the `main` branch instead.

## Recommended Branch

- `main` = current `CFW-3212 Qtooley Overlay`
- `standalone-at-terminal-old` = older standalone AT terminal branch

The stock UI overlay on `main` is the primary and recommended project direction.

## What This Branch Is

This branch keeps the earlier standalone AT terminal workflow that serves a LAN-accessible page at:

- `http://192.168.1.1:8088/`

It is still useful as:

- a legacy project track
- a fallback tool
- a reference for the earlier direct LAN terminal work

It is not the primary maintained direction anymore.

![CFW-3212 AT Terminal screenshot](docs/images/at-terminal-screenshot.png)

## Important Warning

Do not casually install and run this branch alongside the stock UI overlay as if they are separate products.

Important overlap:

- both tracks target the same router and modem platform
- both use the same platform-native AT backend model
- both depend on the same shared lock discipline around modem access
- both can affect the same modem state and router behavior

Shared lock path:

- `/tmp/at-http.lock`

If you want the current primary project, use the Qtooley overlay on `main`.

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

## Additional Docs

- [AT Terminal Notes](docs/at-terminal-notes.md)
- [AT Terminal Usage](docs/at-terminal-usage.md)
- [Installing AT Terminal](docs/installing-at-terminal.md)
- [Validator Policy](docs/validator-policy.md)
- [General Notes](docs/general-notes.md)
