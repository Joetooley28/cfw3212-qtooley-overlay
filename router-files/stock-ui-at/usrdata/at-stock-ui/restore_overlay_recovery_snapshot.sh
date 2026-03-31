#!/bin/sh

set -eu

if [ $# -ne 1 ]; then
    echo "usage: $0 /usrdata/at-stock-ui/recovery-snapshots/<snapshot_dir>" >&2
    exit 1
fi

BASE="/usrdata/at-stock-ui"
SNAP_DIR="$1"

if [ ! -d "$SNAP_DIR" ]; then
    echo "snapshot not found: $SNAP_DIR" >&2
    exit 1
fi

for required in "$SNAP_DIR/www" "$SNAP_DIR/usr" "$SNAP_DIR/apply_stock_ui_overlay.sh"; do
    if [ ! -e "$required" ]; then
        echo "snapshot is missing required content: $required" >&2
        exit 1
    fi
done

ROLLBACK_DIR="/tmp/overlay-rollback-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$ROLLBACK_DIR"

cp -a "$BASE/www" "$ROLLBACK_DIR/" 2>/dev/null || true
cp -a "$BASE/usr" "$ROLLBACK_DIR/" 2>/dev/null || true
cp -a "$BASE/overlay" "$ROLLBACK_DIR/" 2>/dev/null || true
cp -a "$BASE/apply_stock_ui_overlay.sh" "$ROLLBACK_DIR/" 2>/dev/null || true

rm -rf "$BASE/www" "$BASE/usr" "$BASE/overlay"

cp -a "$SNAP_DIR/www" "$BASE/"
cp -a "$SNAP_DIR/usr" "$BASE/"
if [ -d "$SNAP_DIR/overlay" ]; then
    cp -a "$SNAP_DIR/overlay" "$BASE/"
fi
cp -a "$SNAP_DIR/apply_stock_ui_overlay.sh" "$BASE/apply_stock_ui_overlay.sh"
cp -a "$SNAP_DIR/remove_stock_ui_overlay.sh" "$BASE/remove_stock_ui_overlay.sh" 2>/dev/null || true
cp -a "$SNAP_DIR/verify_stock_ui_overlay.sh" "$BASE/verify_stock_ui_overlay.sh" 2>/dev/null || true

tr -d '\r' < "$BASE/apply_stock_ui_overlay.sh" > /tmp/apply_stock_ui_overlay.sh
mv /tmp/apply_stock_ui_overlay.sh "$BASE/apply_stock_ui_overlay.sh"
chmod +x "$BASE/apply_stock_ui_overlay.sh"

/bin/sh "$BASE/apply_stock_ui_overlay.sh"
systemctl restart turbontc.service
systemctl restart da_authenticate.service

echo "restored_from=$SNAP_DIR"
echo "rollback_copy=$ROLLBACK_DIR"
