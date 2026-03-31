#!/bin/sh

set -eu

BASELINE_DIR="${1:-/usrdata/at-stock-ui/installer-state/install-baseline}"
VERIFY_ROOT="/tmp/install-baseline-verify.$$"

for required in "$BASELINE_DIR/install_www.tar" "$BASELINE_DIR/install_webif.tar"; do
    if [ ! -f "$required" ]; then
        echo "Missing required install baseline file: $required" >&2
        exit 1
    fi
done

if grep -E '/at-stock-ui/live|/usrdata/at-stock-ui/live' /proc/self/mountinfo >/dev/null 2>&1; then
    echo "Refusing to restore stock baseline while live overlay mounts are still active." >&2
    exit 1
fi

rm -rf "$VERIFY_ROOT"
mkdir -p "$VERIFY_ROOT"
trap 'rm -rf "$VERIFY_ROOT"' EXIT INT TERM

tar -xf "$BASELINE_DIR/install_www.tar" -C "$VERIFY_ROOT"
tar -xf "$BASELINE_DIR/install_webif.tar" -C "$VERIFY_ROOT"

for pair in \
    "/www/theme/js/genHeader.js:$VERIFY_ROOT/www/theme/js/genHeader.js" \
    "/usr/share/lua/5.1/webif/top_menu_entries.lua:$VERIFY_ROOT/usr/share/lua/5.1/webif/top_menu_entries.lua" \
    "/usr/share/lua/5.1/webif/userGroupAuth.lua:$VERIFY_ROOT/usr/share/lua/5.1/webif/userGroupAuth.lua"
do
    live_path="${pair%%:*}"
    baseline_path="${pair##*:}"

    if [ ! -f "$live_path" ] || [ ! -f "$baseline_path" ]; then
        echo "Unable to verify install baseline file: $live_path" >&2
        exit 1
    fi

    if ! cmp -s "$live_path" "$baseline_path"; then
        echo "Install baseline verification failed for $live_path" >&2
        exit 1
    fi
done

if [ -e /usr/share/lua/5.1/webif/handler_0011.lua ]; then
    echo "Overlay file still present after uninstall: /usr/share/lua/5.1/webif/handler_0011.lua" >&2
    exit 1
fi

echo "verified_install_baseline=$BASELINE_DIR"
