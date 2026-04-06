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

remove_ttl_rule_if_present() {
    local table_name="$1"
    local chain_name="$2"
    shift 2
    while iptables -t "$table_name" -C "$chain_name" "$@" 2>/dev/null; do
        iptables -t "$table_name" -D "$chain_name" "$@" 2>/dev/null || break
    done
}

remove_ttl_rule_if_present_v6() {
    local table_name="$1"
    local chain_name="$2"
    shift 2
    while ip6tables -t "$table_name" -C "$chain_name" "$@" 2>/dev/null; do
        ip6tables -t "$table_name" -D "$chain_name" "$@" 2>/dev/null || break
    done
}

bind_mount_checked() {
    local source="$1"
    local target="$2"
    if ! mount --bind "$source" "$target"; then
        echo "Failed to bind-mount $source onto $target" >&2
        return 1
    fi
    if ! grep -q " $target " /proc/self/mountinfo 2>/dev/null; then
        echo "Bind mount did not appear in mountinfo for $target" >&2
        return 1
    fi
}

resolve_stock_source_www() {
    if [ -d "$STOCK_BASE_WWW" ]; then
        echo "$STOCK_BASE_WWW"
        return 0
    fi
    if [ -d "$STOCK_WWW" ]; then
        echo "$STOCK_WWW"
        return 0
    fi
    return 1
}

resolve_stock_source_webif() {
    if [ -d "$STOCK_BASE_WEBIF" ]; then
        echo "$STOCK_BASE_WEBIF"
        return 0
    fi
    if [ -d "$STOCK_WEBIF" ]; then
        echo "$STOCK_WEBIF"
        return 0
    fi
    return 1
}

build_live_tree() {
    local source_www source_webif

    source_www="$(resolve_stock_source_www || true)"
    source_webif="$(resolve_stock_source_webif || true)"

    if [ -z "$source_www" ] || [ -z "$source_webif" ]; then
        echo "Unable to resolve stock source trees for overlay rebuild." >&2
        exit 1
    fi

    rm -rf "$LIVE"
    mkdir -p "$LIVE_WWW" "$LIVE_WEBIF"

    cp -a "$source_www/." "$LIVE_WWW/"
    cp -a "$source_webif/." "$LIVE_WEBIF/"

    cp -a "$BASE/www/." "$LIVE_WWW/"
    cp -a "$BASE/usr/share/lua/5.1/webif/." "$LIVE_WEBIF/"

    # Menu + auth must land in the live webif even when /usrdata/at-stock-ui/overlay/ is missing
    # (e.g. partial sync of handler + www only). Stock pivot userGroupAuth has no Jtools pages -> /sms.html redirects to index.
    if [ -f "$BASE/overlay/www/js/generatedMenuEntries.js" ]; then
        cp "$BASE/overlay/www/js/generatedMenuEntries.js" "$LIVE_WWW/js/generatedMenuEntries.js"
    elif [ -f "$BASE/www/js/generatedMenuEntries.js" ]; then
        cp "$BASE/www/js/generatedMenuEntries.js" "$LIVE_WWW/js/generatedMenuEntries.js"
    fi

    if [ -f "$BASE/overlay/usr/share/lua/5.1/webif/top_menu_entries.lua" ]; then
        cp "$BASE/overlay/usr/share/lua/5.1/webif/top_menu_entries.lua" "$LIVE_WEBIF/top_menu_entries.lua"
    elif [ -f "$BASE/usr/share/lua/5.1/webif/top_menu_entries.lua" ]; then
        cp "$BASE/usr/share/lua/5.1/webif/top_menu_entries.lua" "$LIVE_WEBIF/top_menu_entries.lua"
    fi

    if [ -f "$BASE/overlay/usr/share/lua/5.1/webif/userGroupAuth.lua" ]; then
        cp "$BASE/overlay/usr/share/lua/5.1/webif/userGroupAuth.lua" "$LIVE_WEBIF/userGroupAuth.lua"
    elif [ -f "$BASE/usr/share/lua/5.1/webif/userGroupAuth.lua" ]; then
        cp "$BASE/usr/share/lua/5.1/webif/userGroupAuth.lua" "$LIVE_WEBIF/userGroupAuth.lua"
    fi
}

detach_mount_if_needed "$STOCK_WEBIF"
detach_mount_if_needed "$STOCK_WWW"

build_live_tree

if ! bind_mount_checked "$LIVE_WWW" "$STOCK_WWW"; then
    exit 1
fi

if ! bind_mount_checked "$LIVE_WEBIF" "$STOCK_WEBIF"; then
    detach_mount_if_needed "$STOCK_WWW"
    exit 1
fi

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
        remove_ttl_rule_if_present mangle POSTROUTING -o rmnet+ -j TTL --ttl-set "$TTL_VALUE"
        remove_ttl_rule_if_present_v6 mangle POSTROUTING -o rmnet+ -j HL --hl-set "$TTL_VALUE"
        if ! iptables -t mangle -C POSTROUTING -o rmnet+ -j TTL --ttl-set "$TTL_VALUE" 2>/dev/null; then
            iptables -t mangle -I POSTROUTING -o rmnet+ -j TTL --ttl-set "$TTL_VALUE"
        fi
        if ! ip6tables -t mangle -C POSTROUTING -o rmnet+ -j HL --hl-set "$TTL_VALUE" 2>/dev/null; then
            ip6tables -t mangle -I POSTROUTING -o rmnet+ -j HL --hl-set "$TTL_VALUE"
        fi
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

if ! systemctl restart turbontc.service; then
    echo "Failed to restart turbontc.service after overlay apply" >&2
    exit 1
fi

echo "stock-ui AT live tree bound"
