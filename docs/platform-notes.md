# Platform Notes

## Device

- Casa Systems CFW-3212
- Quectel RG520N-NA
- Casa / US Cellular firmware

## Important Architectural Note

This is **not** a normal host-PC + USB modem setup.

The modem/app processor is effectively the platform itself. The current AT terminal backend uses the platform-native AT path directly instead of assuming a normal external USB serial modem design.

## Proven AT Paths

The best-proven backend path remains:

- `/dev/smd7`

Additional paths answered bounded `ATI` probes in testing:

- `/dev/at_mdm0`
- `/dev/smd11`

Current backend order:

1. `smd7_direct`
2. `at_mdm0_direct`
3. `smd11_direct`

