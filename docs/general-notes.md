# General Notes

This section collects the public-facing notes that are useful for the broader device project but are not specific to daily AT terminal operation.

## Sections

- [Device and Platform Notes](#device-and-platform-notes)
- [ADB and SSH Persistence](#adb-and-ssh-persistence)
- [RG520N-NA Supported Bands](#rg520n-na-supported-bands)

## Device and Platform Notes

### Device

- Casa Systems CFW-3212
- Quectel RG520N-NA
- Casa / US Cellular firmware

### Important Architectural Note

This is **not** a normal host-PC + USB modem setup.

The modem/app processor is effectively the platform itself. The current AT terminal backend uses the platform-native AT path directly instead of assuming a normal external USB serial modem design.

### Proven AT Paths

The best-proven backend path remains:

- `/dev/smd7`

Additional paths answered bounded `ATI` probes in testing:

- `/dev/at_mdm0`
- `/dev/smd11`

Current backend order:

1. `smd7_direct`
2. `at_mdm0_direct`
3. `smd11_direct`

The AT terminal remains separate from stock Casa Turbo and does not replace stock web services.

## ADB and SSH Persistence

### Summary

Two useful persistence results were confirmed on this platform:

- SSH client key persistence can work
- ADB persistence can work

Both required setting the correct RDB persist flag.

### SSH Key Persistence

The SSH client-key path did not initially survive reboot because the relevant RDB variables were not marked persistent.

The working fix was to set the persist flag on:

- `service.ssh.clientkey.root.0`
- `service.ssh.clientkey`

After that, key-based SSH survived reboot.

### ADB Persistence

ADB did not initially survive reboot either.

The working fix was to set the persist flag on:

- `service.adb.enable`

After that, the following survived reboot:

- `service.adb.enable = 1`
- `boot_hsusb_comp = Casa`
- `adbd.service` active

### Important Practical Note

Persistent ADB here means the router comes back in the stock Casa USB composition with ADB available when the physical USB/debug connection is present.

It does **not** mean ADB becomes available over Ethernet by itself.

## RG520N-NA Supported Bands

Source:
- `Quectel_RG520N_Series_5G_Module_Specification_V1.7.pdf`

This is the module-level band list for the `RG520N-NA` variant used in the Casa Systems `CFW-3212` project.

Important:
- this is Quectel module capability information
- Casa firmware, carrier policy, certification scope, RF path population, and board implementation can narrow what is actually exposed or usable on a given unit

### 5G NR NSA

`n2, n5, n7, n12, n13, n14, n25, n26, n29, n30, n38, n41, n48, n66, n70, n71, n77, n78`

### 5G NR SA

`n2, n5, n7, n12, n13, n14, n25, n26, n29, n30, n38, n41, n48, n66, n70, n71, n77, n78`

### LTE-FDD

`B2, B4, B5, B7, B12, B13, B14, B17, B25, B26, B29, B30, B66, B71`

### LTE-TDD

`B38, B41, B42, B43, B48`

### WCDMA

`B1, B5, B8`

### MIMO Notes From The Spec

- 5G NR DL 4x4 MIMO list matches the NR band list above
- the spec notes that `n13` and `n26` currently support only DL `2x2 MIMO`
- LTE DL 4x4 MIMO is listed for `B2, B4, B5, B7, B12, B13, B14, B17, B25, B26, B29, B30, B38, B41, B42, B43, B48, B66, B71`
