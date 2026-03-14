# ADB and SSH Persistence

## Summary

Two useful persistence results were confirmed on this platform:

- SSH client key persistence can work
- ADB persistence can work

Both required setting the correct RDB persist flag.

## SSH Key Persistence

The SSH client-key path did not initially survive reboot because the relevant RDB variables were not marked persistent.

The working fix was to set the persist flag on:

- `service.ssh.clientkey.root.0`
- `service.ssh.clientkey`

After that, key-based SSH survived reboot.

## ADB Persistence

ADB did not initially survive reboot either.

The working fix was to set the persist flag on:

- `service.adb.enable`

After that, the following survived reboot:

- `service.adb.enable = 1`
- `boot_hsusb_comp = Casa`
- `adbd.service` active

## Important Practical Note

Persistent ADB here means the router comes back in the stock Casa USB composition with ADB available when the physical USB/debug connection is present.

It does **not** mean ADB becomes available over Ethernet by itself.
