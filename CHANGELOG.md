# Changelog

## v0.1.0

Initial shareable standalone AT terminal release for the Casa Systems CFW-3212.

Included:
- standalone Lua AT backend
- standalone browser UI
- LAN bind on `192.168.1.1:8088`
- validator policy for practical admin use
- dark mode toggle
- copy-all buttons
- late boot auto-start via systemd timer

Key behavior:
- default backend is `smd7_direct`
- uses the platform-native `smd` AT path directly
- separate from Casa Turbo
- no stock port_bridge replacement
