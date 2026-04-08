# Quick Must Read

If you are about to install Qtooley for the first time, read this page first.

## Rooting Prerequisite

- the router must already be rooted before Qtooley can be installed
- full credit to [@Luke](https://github.com/lukejenkins/cellular/tree/main/casasystems/cfw3212) for the root script and broader `CFW-3212` platform research
- if you need the root script itself, start in Luke's [`casasystems/cfw3212/tools`](https://github.com/lukejenkins/cellular/tree/main/casasystems/cfw3212/tools) folder
- if you are starting from a stock carrier-managed box, also read Luke's [`guide_block_carrier_remote_mgmt`](https://github.com/lukejenkins/cellular/blob/main/casasystems/cfw3212/guide_block_carrier_remote_mgmt.md) to block the carrier remote-management path

## First Install Snapshot

- on the first normal install, Qtooley captures a compact router-specific stock baseline from the live stock `/www` and `/usr/share/lua/5.1/webif` trees before the overlay mounts go live
- that saved first-install baseline is what uninstall uses later to verify the router is back on its install-time stock web files
- normal updates reuse that saved baseline
- do not force a recapture unless the saved baseline is missing or known bad and the router is already showing the stock state you want to preserve

Important behavior:

- if you fully uninstall Qtooley and remove `/usrdata/at-stock-ui`, the on-router saved baseline is removed too
- the next fresh install will capture a new first-install baseline from whatever stock state the router is in at that time

## Space Quick Check

Real project measurements from Box 2:

- Qtooley with bundled Ookla installed used about `13.7 MB` under `/usrdata/at-stock-ui`
- the bundled Ookla `speedtest` binary itself was about `2.2 MB`
- optional Tailscale should be treated as a separate extra runtime and can add about `60 MB` under `/usrdata/tailscale`

Practical advice:

- make sure `/usrdata` has comfortable free space before first install
- leave extra headroom if you plan to add Tailscale later

## Important Space Warning: `upgrade.star`

- on one unit, the biggest hidden space consumer was a staged firmware file named `upgrade.star`
- the copy found on-box was about `104 MB`
- check:
  - `/cache/upgrade.star`
  - `/usrdata/cache/upgrade.star`
- if you find one, pull and save an off-box copy before deleting anything
- it may be a very useful stock firmware artifact later

## Install Paths

If the modem does not already have working internet:

- use the Windows ZIP from the release `Assets` section
- extract the ZIP first
- follow the packaged `README.txt`

If the modem already has working internet:

- you can use the direct router `wget` install/update and uninstall commands from the release page
