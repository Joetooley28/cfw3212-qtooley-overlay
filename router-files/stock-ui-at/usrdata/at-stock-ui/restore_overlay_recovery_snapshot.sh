#!/bin/sh

# Copyright (C) 2026 Joe Tooley
# SPDX-License-Identifier: GPL-2.0-or-later
# See repository root LICENSE for full license text.

set -eu

if [ $# -ne 1 ]; then
    echo "usage: $0 /usrdata/at-stock-ui/recovery-snapshots/<snapshot_dir>" >&2
    exit 1
fi

BASE="/usrdata/at-stock-ui"
SNAP_DIR="$1"
PAYLOAD_DIR="$SNAP_DIR/base-payload"

if [ ! -d "$SNAP_DIR" ]; then
    echo "snapshot not found: $SNAP_DIR" >&2
    exit 1
fi

for required in "$PAYLOAD_DIR" "$PAYLOAD_DIR/www" "$PAYLOAD_DIR/usr" "$PAYLOAD_DIR/apply_stock_ui_overlay.sh"; do
    if [ ! -e "$required" ]; then
        echo "snapshot is missing required content: $required" >&2
        exit 1
    fi
done

ROLLBACK_DIR="/tmp/overlay-rollback-$(date +%Y%m%d_%H%M%S)"
mkdir -p "$ROLLBACK_DIR"

for item in "$BASE"/*; do
    [ -e "$item" ] || continue
    name="$(basename "$item")"
    case "$name" in
        live|recovery-snapshots)
            continue
            ;;
    esac
    cp -a "$item" "$ROLLBACK_DIR/" 2>/dev/null || true
done

for item in "$BASE"/*; do
    [ -e "$item" ] || continue
    name="$(basename "$item")"
    case "$name" in
        live|recovery-snapshots)
            continue
            ;;
    esac
    rm -rf "$item"
done

for item in "$PAYLOAD_DIR"/*; do
    [ -e "$item" ] || continue
    cp -a "$item" "$BASE/"
done

tr -d '\r' < "$BASE/apply_stock_ui_overlay.sh" > /tmp/apply_stock_ui_overlay.sh
mv /tmp/apply_stock_ui_overlay.sh "$BASE/apply_stock_ui_overlay.sh"
chmod +x "$BASE/apply_stock_ui_overlay.sh"

/bin/sh "$BASE/apply_stock_ui_overlay.sh"
systemctl restart turbontc.service
systemctl restart da_authenticate.service

echo "restored_from=$SNAP_DIR"
echo "rollback_copy=$ROLLBACK_DIR"
