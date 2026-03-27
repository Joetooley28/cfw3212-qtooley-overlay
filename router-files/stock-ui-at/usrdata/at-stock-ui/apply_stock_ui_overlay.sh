#!/bin/sh

set -eu

BASE="/usrdata/at-stock-ui"
STOCK_WWW="/www"
STOCK_WEBIF="/usr/share/lua/5.1/webif"
STOCK_BASE_WWW="/overlay/pivot/www"
STOCK_BASE_WEBIF="/overlay/pivot/usr/share/lua/5.1/webif"
LIVE="$BASE/live"
LIVE_WWW="$LIVE/www"
LIVE_WEBIF="$LIVE/usr/share/lua/5.1/webif"

detach_mount_if_needed() {
    local target="$1"
    if grep -q " $target " /proc/self/mountinfo 2>/dev/null; then
        umount "$target" 2>/dev/null || umount -l "$target" 2>/dev/null || true
    fi
}

build_live_tree() {
    rm -rf "$LIVE"
    mkdir -p "$LIVE_WWW" "$LIVE_WEBIF"

    cp -a "$STOCK_BASE_WWW/." "$LIVE_WWW/"
    cp -a "$STOCK_BASE_WEBIF/." "$LIVE_WEBIF/"

    cp -a "$BASE/www/." "$LIVE_WWW/"
    cp -a "$BASE/usr/share/lua/5.1/webif/." "$LIVE_WEBIF/"

    if [ -f "$BASE/overlay/www/js/generatedMenuEntries.js" ]; then
        cp "$BASE/overlay/www/js/generatedMenuEntries.js" "$LIVE_WWW/js/generatedMenuEntries.js"
    fi

    if [ -f "$BASE/overlay/usr/share/lua/5.1/webif/top_menu_entries.lua" ]; then
        cp "$BASE/overlay/usr/share/lua/5.1/webif/top_menu_entries.lua" "$LIVE_WEBIF/top_menu_entries.lua"
    fi

    if [ -f "$BASE/overlay/usr/share/lua/5.1/webif/userGroupAuth.lua" ]; then
        cp "$BASE/overlay/usr/share/lua/5.1/webif/userGroupAuth.lua" "$LIVE_WEBIF/userGroupAuth.lua"
    fi
}

detach_mount_if_needed "$STOCK_WEBIF"
detach_mount_if_needed "$STOCK_WWW"

build_live_tree

mount --bind "$LIVE_WWW" "$STOCK_WWW"
mount --bind "$LIVE_WEBIF" "$STOCK_WEBIF"

# --- Speedtest: initialize clean state for reliable post-boot startup ---
SPEEDTEST_STATE="/tmp/ookla-speedtest-state.json"
SPEEDTEST_HOME="/tmp/ookla-speedtest-home"
SPEEDTEST_BINARY="$BASE/bin/speedtest"
rm -f /tmp/ookla-speedtest.pid
mkdir -p "$SPEEDTEST_HOME"
IFACE=$(ip route 2>/dev/null | grep '^default' | head -1 | awk '{print $5}' || true)
if [ -f "$SPEEDTEST_BINARY" ]; then
    cat > "$SPEEDTEST_STATE" <<STEOF
{"ok":true,"phase":"idle","running":false,"binary_present":true,"binary_path":"$SPEEDTEST_BINARY","install_script":"$BASE/install_ookla_speedtest_cli.sh","remove_script":"$BASE/remove_ookla_speedtest_cli.sh","default_interface":"${IFACE:-}","status_text":"Ready to run Ookla Speedtest from the router."}
STEOF
else
    cat > "$SPEEDTEST_STATE" <<STEOF
{"ok":true,"phase":"idle","running":false,"binary_present":false,"binary_path":"$SPEEDTEST_BINARY","install_script":"$BASE/install_ookla_speedtest_cli.sh","remove_script":"$BASE/remove_ookla_speedtest_cli.sh","default_interface":"","status_text":"Ookla CLI is not installed."}
STEOF
fi
echo "speedtest state initialized"

# --- TTL: reapply override if configured ---
TTL_CONFIG="$BASE/ttl_config.json"
if [ -f "$TTL_CONFIG" ]; then
    TTL_VALUE=$(cat "$TTL_CONFIG" 2>/dev/null | grep -o '"ttl_value"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$' || true)
    if [ -n "$TTL_VALUE" ] && [ "$TTL_VALUE" -gt 0 ] 2>/dev/null; then
        iptables -t mangle -D POSTROUTING -o rmnet+ -j TTL --ttl-set "$TTL_VALUE" 2>/dev/null || true
        ip6tables -t mangle -D POSTROUTING -o rmnet+ -j HL --hl-set "$TTL_VALUE" 2>/dev/null || true
        iptables -t mangle -I POSTROUTING -o rmnet+ -j TTL --ttl-set "$TTL_VALUE"
        ip6tables -t mangle -I POSTROUTING -o rmnet+ -j HL --hl-set "$TTL_VALUE"
        echo "TTL override reapplied: $TTL_VALUE"
    fi
fi

# --- RAT/Band settings: reapply persisted safe radio preferences ---
if [ -f "$BASE/band_locking_config.json" ]; then
    /usr/bin/lua - <<'LUA' || true
package.path = package.path .. ";/usrdata/at-stock-ui/?.lua"
local settings = require("band_locking_settings")
local ok, err = settings.reapply_saved()
if ok then
    print("RAT/band settings reapplied")
else
    print("RAT/band reapply skipped: " .. tostring(err))
end
LUA
fi

systemctl restart turbontc.service

echo "stock-ui AT live tree bound"
