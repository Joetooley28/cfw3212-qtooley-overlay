# CFW-3212 Qtooley Overlay

Qtooley is a stock UI overlay for the Casa Systems `CFW-3212` with a Quectel `RG520N-NA`.

This is the public landing page for the current project direction: a top-level authenticated Qtooley tab inside the stock Casa Turbo web UI, with custom pages for modem visibility, control, and diagnostics.

It is not a generic web app and it is not a generic USB modem project.

## Download

- Latest release ZIP: `[Placeholder: release link]`
- Install guide: [RELEASE_INSTALL.md](../router-files/stock-ui-at/RELEASE_INSTALL.md)
- Main repo README: [README.md](../README.md)

## What You Get

- Quick Overview
- General Info
- AT terminal
- RAT / band / cell locking
- Ookla Speedtest
- TTL helper
- optional Tailscale UI after base install

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

## Why This Project Is Different

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

- `[Placeholder: hero screenshot]`
- `[Placeholder: Quick Overview screenshot]`
- `[Placeholder: General Info screenshot]`
- `[Placeholder: RAT / band / cell locking screenshot]`
- `[Placeholder: Ookla Speedtest screenshot]`
- `[Placeholder: Tailscale screenshot]`

## Project Tracks

There are two related tracks in this project history:

- `main`: current Qtooley stock UI overlay, primary project
- `standalone-at-terminal`: legacy standalone LAN AT terminal, fallback/reference branch

Important warning:

- both tracks share backend assumptions and modem access discipline
- both rely on the same platform-native AT path model
- both use the same shared lock concept around modem access
- do not casually install and run both as if they were isolated products

Current legacy branch README draft:

- [standalone-at-terminal-readme-draft.md](standalone-at-terminal-readme-draft.md)

## Docs

- [Master Truth](MASTER_TRUTH.md)
- [Stock UI Package README](../router-files/stock-ui-at/README.md)
- [Release Install Guide](../router-files/stock-ui-at/RELEASE_INSTALL.md)
- [Publish Safety Checklist](publish-safety-checklist.md)
- [adb-and-ssh-persistence.md](adb-and-ssh-persistence.md)
- [platform-notes.md](platform-notes.md)
