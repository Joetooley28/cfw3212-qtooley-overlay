#!/bin/sh

set -eu

BASE="/usrdata/at-stock-ui"
SNAP_ROOT="$BASE/recovery-snapshots"
LABEL="${1:-manual}"
TS="$(date +%Y%m%d_%H%M%S)"
SNAP_DIR="$SNAP_ROOT/${TS}_${LABEL}"

mkdir -p "$SNAP_DIR"

cp -a "$BASE/www" "$SNAP_DIR/"
cp -a "$BASE/usr" "$SNAP_DIR/"
cp -a "$BASE/overlay" "$SNAP_DIR/" 2>/dev/null || true
cp -a "$BASE/apply_stock_ui_overlay.sh" "$SNAP_DIR/"
cp -a "$BASE/remove_stock_ui_overlay.sh" "$SNAP_DIR/" 2>/dev/null || true
cp -a "$BASE/verify_stock_ui_overlay.sh" "$SNAP_DIR/" 2>/dev/null || true

LIVE_HANDLER_LINES="$(wc -l < /usr/share/lua/5.1/webif/handler_0011.lua 2>/dev/null || echo 0)"
LIVE_AUTH_LINES="$(wc -l < /usr/share/lua/5.1/webif/userGroupAuth.lua 2>/dev/null || echo 0)"
LIVE_HEADER_LINES="$(wc -l < /www/theme/js/genHeader.js 2>/dev/null || echo 0)"

{
    echo "captured_at=$TS"
    echo "label=$LABEL"
    echo "source=$BASE"
    echo "live_handler_lines=$LIVE_HANDLER_LINES"
    echo "live_userGroupAuth_lines=$LIVE_AUTH_LINES"
    echo "live_genHeader_lines=$LIVE_HEADER_LINES"
} > "$SNAP_DIR/SNAPSHOT_INFO.txt"

echo "$SNAP_DIR"
