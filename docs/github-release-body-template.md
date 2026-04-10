Quick Must Read

- [Quick Must Read](https://github.com/Joetooley28/cfw3212-qtooley-overlay/blob/main/docs/quick-must-read.md)
- [Windows ZIP Install Guide](https://github.com/Joetooley28/cfw3212-qtooley-overlay/blob/main/docs/windows-zip-install.md)
- [Direct Router Install Guide](https://github.com/Joetooley28/cfw3212-qtooley-overlay/blob/main/docs/direct-router-install.md)

Prerequisite

- your router must already be rooted before Qtooley can be installed
- SSH must already be enabled and reachable on the router
- you need the router IP, SSH username (`root`), and SSH password
- for the normal Windows path, Windows needs the built-in ssh client available

Does your modem have an active internet connection?

If NO:
- download the top file in the Assets section at the bottom of this release page
- do not use Source code
- extract the ZIP
- follow the packaged README.txt or [Windows ZIP Install Guide](https://github.com/Joetooley28/cfw3212-qtooley-overlay/blob/main/docs/windows-zip-install.md) for the exact Windows install, update, and uninstall commands

If YES:
- you can install or update directly on the router over SSH with:

```sh
sh -c "$(wget -qO- {{RAW_BASE_URL}}/router-files/stock-ui-at/usrdata/at-stock-ui/update_from_github_release.sh)"
```

- you can uninstall directly on the router over SSH with:

```sh
sh -c "$(wget -qO- {{RAW_BASE_URL}}/router-files/stock-ui-at/usrdata/at-stock-ui/uninstall_from_github_release.sh)"
```

Notable fixes in this release:
{{RELEASE_NOTES_BLOCK}}

Full changelog:
- [CHANGELOG.md]({{FULL_CHANGELOG_URL}})
