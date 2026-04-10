#!/bin/sh

# Copyright (C) 2026 Joe Tooley
# SPDX-License-Identifier: GPL-2.0-or-later
# See repository root LICENSE for full license text.

set -eu

BASE="/usrdata/at-stock-ui"
SNAP_ROOT="$BASE/recovery-snapshots"
LABEL="${1:-manual}"
TS="$(date +%Y%m%d_%H%M%S)"
SNAP_DIR="$SNAP_ROOT/${TS}_${LABEL}"
TRACKED_FILE_LIST="$BASE/tracked_stock_files.txt"
TRACKED_SNAPSHOT_DIR="$SNAP_DIR/tracked-live-files"
PAYLOAD_DIR="$SNAP_DIR/base-payload"

mkdir -p "$SNAP_DIR"

mkdir -p "$PAYLOAD_DIR"
for item in "$BASE"/*; do
    [ -e "$item" ] || continue
    name="$(basename "$item")"
    case "$name" in
        live|recovery-snapshots)
            continue
            ;;
    esac
    cp -a "$item" "$PAYLOAD_DIR/"
done

cp -a "$TRACKED_FILE_LIST" "$SNAP_DIR/tracked_stock_files.txt" 2>/dev/null || true

mkdir -p "$TRACKED_SNAPSHOT_DIR"
if [ -f "$TRACKED_FILE_LIST" ]; then
    while IFS= read -r live_path; do
        [ -n "$live_path" ] || continue
        case "$live_path" in
            \#*) continue ;;
        esac

        if [ -e "$live_path" ]; then
            rel_path="${live_path#/}"
            mkdir -p "$TRACKED_SNAPSHOT_DIR/$(dirname "$rel_path")"
            cp -a "$live_path" "$TRACKED_SNAPSHOT_DIR/$rel_path"
        fi
    done < "$TRACKED_FILE_LIST"
fi

LIVE_HANDLER_LINES="$(wc -l < /usr/share/lua/5.1/webif/handler_0011.lua 2>/dev/null || echo 0)"
LIVE_AUTH_LINES="$(wc -l < /usr/share/lua/5.1/webif/userGroupAuth.lua 2>/dev/null || echo 0)"
LIVE_HEADER_LINES="$(wc -l < /www/theme/js/genHeader.js 2>/dev/null || echo 0)"

{
    echo "captured_at=$TS"
    echo "label=$LABEL"
    echo "source=$BASE"
    echo "payload_dir=base-payload"
    echo "live_handler_lines=$LIVE_HANDLER_LINES"
    echo "live_userGroupAuth_lines=$LIVE_AUTH_LINES"
    echo "live_genHeader_lines=$LIVE_HEADER_LINES"
    echo "tracked_live_files_dir=tracked-live-files"
} > "$SNAP_DIR/SNAPSHOT_INFO.txt"

echo "$SNAP_DIR"
