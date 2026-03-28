# Stock UI AT Package

Local stock UI integration package for the Casa Turbo web interface on the Casa Systems CFW-3212.

## Current Truth

This is the current proven model on the tested CFW-3212. Do not casually redesign it.

- Keep the standalone `:8088` AT terminal separate.
- Keep the stock UI payload under `/usrdata/at-stock-ui`.
- Build the live trees under `/usrdata/at-stock-ui/live`.
- Bind-mount:
  - `/usrdata/at-stock-ui/live/www` -> `/www`
  - `/usrdata/at-stock-ui/live/usr/share/lua/5.1/webif` -> `/usr/share/lua/5.1/webif`
- Restart `turbontc.service` after the bind mounts are in place.
- Reapply the overlay late after boot with:
  - `/etc/systemd/system/jtools-stock-ui.service`
  - `/etc/systemd/system/jtools-stock-ui.timer`

## Design Guardrails

- Do not replace the late timer with an early boot service unless a better model is actually proven.
- Do not move away from the live-tree plus bind-mount model unless a better model is actually proven.
- Do not remove the shared AT lock path at `/tmp/at-http.lock`.
- Do not over-normalize connection state around one source.
- Do not try to fix browser/cache quirks by patching deep Casa core files unless lighter options fail.

## What This Package Adds

- A top-level authenticated `Jtools` tab in the stock UI.
- Pages under that tab:
  - `Quick Overview`
  - `General info`
  - `AT terminal`
  - `SMS`
  - `Band / cell locking`
  - `Ookla Speedtest`
  - `TTL helper`
  - `Tailscale` (when packaged)
- Shared stock patches for:
  - `generatedMenuEntries.js`
  - `top_menu_entries.lua`
  - `userGroupAuth.lua`
  - `handler_0011.lua`
- Jtools-owned shared styling, including an optional Jtools-page dark-mode override:
  - `www/css/at_terminal.css`
  - `www/css/jtools_dark_mode.css`
  - `www/css/ookla_speedtest.css`

## Important Platform Notes

- On the tested firmware, direct writes to `/www` and `/usr/share/lua/5.1/webif` are not a reliable persistence method.
- `/usrdata` is writable and persistent.
- Plain `mount` output is misleading for this setup. Use `/proc/self/mountinfo` when verifying active bind mounts.
- The standalone AT service binds to `192.168.1.1:8088`, not `127.0.0.1:8088`.

## Current Auth Model

- Jtools pages require login.
- Jtools backend routes require login.
- Allowed groups are `root` and `admin`.
- `status.html` remains publicly viewable pre-login per stock behavior.

## Known Verification Traps

- Protected Jtools pages can show pre-auth or login-wrapper behavior when fetched without a valid session.
- `status.html` still references the stock menu token:
  - `/js/generatedMenuEntries.js?1.1.79.0`
- Jtools pages use Jtools-specific cache tokens instead:
  - `jtools-menu-v20260320`
  - `jtools-ui-v20260320`
  - `jtools-general-core-v20260320`
  - `jtools-general-v20260320`
  - `jtools-at-v20260320`
  - `jtools-bandlock-core-v20260320`
  - `jtools-bandlock-v20260320`

## Operational Trap To Document

Cellular health and user experience can diverge because of stock LAN behavior.

- Stock IP passthrough / DHCP behavior can hand out `192.0.0.2`.
- That can look like a bad modem or bad cellular session from the user side.
- In practice, the WAN/modem side may be fine while LAN/DHCP behavior is the real problem.

## Useful Package Files

- `/usrdata/at-stock-ui/apply_stock_ui_overlay.sh`
- `/usrdata/at-stock-ui/remove_stock_ui_overlay.sh`
- `/usrdata/at-stock-ui/verify_stock_ui_overlay.sh`
- `/usrdata/at-stock-ui/JTOOLS_RELEASE.txt`
- `/etc/systemd/system/jtools-stock-ui.service`
- `/etc/systemd/system/jtools-stock-ui.timer`
