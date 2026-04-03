# Publish Safety Checklist

Use this before pushing `repo-public` to GitHub or building a public release from it.

## Safe Default Rule

If a file came from a live router pull, stock export, recovery snapshot, or device capture, do not publish it unless it has been intentionally reviewed and scrubbed.

## Keep Out Of Public GitHub

- raw stock-pull artifacts
- raw RDB dumps
- router metadata exports
- low-level metadata exports
- unpacked stock backup/config exports
- recovery snapshots
- any file containing real SSH public keys or `authorized_keys`
- any screenshot that still shows secrets, account details, serials, or other device-unique data

Examples of sensitive strings worth checking for:

- `service.ssh.clientkey.root.0`
- `service.ssh.clientkey`
- `authorized_keys`
- `ssh-ed25519`
- `ssh-rsa`

## Current Project-Specific Reminder

The public Qtooley release ZIP does not package router SSH keys as part of the current installer baseline flow.

The current install baseline only captures:

- `/www`
- `/usr/share/lua/5.1/webif`

Even so, local notes and stock-capture folders outside the release package can still contain real router SSH key material and should stay out of public GitHub unless scrubbed first.

## Before Public Push

Run a quick search in the repo for:

- `service.ssh.clientkey`
- `authorized_keys`
- `ssh-ed25519`
- `ssh-rsa`
- your own key comment string if you use one

Also review:

- new screenshots
- imported stock reference files
- exported config files
- any newly added docs copied from live router captures

## Current Safer Publishing Boundary

Generally safe to publish:

- `README.md`
- `CHANGELOG.md`
- `docs/`
- `scripts/`
- `router-files/stock-ui-at/`

But only when those files are project-authored package content and not copied live-capture artifacts.
