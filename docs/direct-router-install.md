# Direct Router Install Guide (Router already has internet)

Use this page only when the router already has working internet access.

If the router does not already have internet, use the [Windows ZIP Install Guide](windows-zip-install.md) instead.

## Before You Start

- the router must already be rooted
- SSH must already be enabled and reachable
- you need the router IP, SSH username, and SSH password
- the router needs working internet access for the GitHub download path

## Direct Router Install or Update

Run:

```sh
sh -c "$(wget -qO- https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/update_from_github_release.sh)"
```

If the router has `curl` instead of `wget`, use:

```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/update_from_github_release.sh)"
```

## Direct Router Uninstall

Run:

```sh
sh -c "$(wget -qO- https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/uninstall_from_github_release.sh)"
```

`curl` fallback:

```sh
sh -c "$(curl -fsSL https://raw.githubusercontent.com/Joetooley28/cfw3212-qtooley-overlay/main/router-files/stock-ui-at/usrdata/at-stock-ui/uninstall_from_github_release.sh)"
```

If Qtooley is already installed and you want non-interactive uninstall:

- keep Tailscale:

```sh
REMOVE_TAILSCALE=0 /bin/sh /usrdata/at-stock-ui/uninstall_from_github_release.sh
```

- remove Tailscale too:

```sh
REMOVE_TAILSCALE=1 /bin/sh /usrdata/at-stock-ui/uninstall_from_github_release.sh
```

## Notes

- the router-native GitHub install/update and uninstall paths download the latest release ZIP and run the same packaged router-side install or uninstall core used by the Windows ZIP flow
- first-time SSH connections to a new router IP are accepted automatically, so you should not need to type a blind `yes` for the host-key prompt
- bundled Ookla is part of the base Qtooley release package
- Tailscale remains optional
- for first-install baseline behavior, uninstall verification expectations, space notes, and the `upgrade.star` warning, read [Quick Must Read](quick-must-read.md)
