#!/bin/sh

set -eu

echo "[units]"
systemctl status jtools-stock-ui.timer --no-pager -l | sed -n '1,12p'
echo "---"
systemctl status jtools-stock-ui.service --no-pager -l | sed -n '1,12p'

echo "[mountinfo]"
grep -E ' /www | /usr/share/lua/5.1/webif ' /proc/self/mountinfo || true

echo "[listeners]"
netstat -tulpn 2>/dev/null | grep -E '(:80|:8088)' || true

echo "[key files]"
sha256sum \
  /usrdata/at-stock-ui/apply_stock_ui_overlay.sh \
  /usrdata/at-stock-ui/remove_stock_ui_overlay.sh \
  /www/general_dashboard.html \
  /www/js/general_dashboard.js \
  /www/css/at_terminal.css \
  /usr/share/lua/5.1/webif/handler_0011.lua 2>/dev/null || true

echo "[cache tokens]"
grep -n 'generatedMenuEntries.js\|jtools-menu-v20260320\|jtools-ui-v20260320\|jtools-general-core-v20260320\|jtools-general-v20260320\|jtools-at-v20260320\|jtools-bandlock-core-v20260320\|jtools-bandlock-v20260320' \
  /www/status.html \
  /www/general_dashboard.html \
  /www/at_terminal.html \
  /www/band_cell_locking.html 2>/dev/null || true
