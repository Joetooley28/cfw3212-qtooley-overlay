#!/bin/sh

# Copyright (C) 2026 Joe Tooley
# SPDX-License-Identifier: GPL-2.0-or-later
# See repository root LICENSE for full license text.

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
BASELINE_DIR="${1:-/usrdata/at-stock-ui/installer-state/install-baseline}"
VERIFY_ROOT="/tmp/install-baseline-verify.$$"
BASELINE_TRACKED_FILE_LIST="$BASELINE_DIR/tracked_stock_files.txt"
PACKAGE_TRACKED_FILE_LIST="$SCRIPT_DIR/tracked_stock_files.txt"
MERGED_TRACKED_FILE_LIST="$VERIFY_ROOT/tracked_stock_files.merged.txt"

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

if [ ! -f "$BASELINE_TRACKED_FILE_LIST" ] && [ ! -f "$PACKAGE_TRACKED_FILE_LIST" ]; then
    echo "Missing tracked stock file list for uninstall verification." >&2
    exit 1
fi

{
    if [ -f "$BASELINE_TRACKED_FILE_LIST" ]; then
        cat "$BASELINE_TRACKED_FILE_LIST"
    fi
    if [ -f "$PACKAGE_TRACKED_FILE_LIST" ]; then
        cat "$PACKAGE_TRACKED_FILE_LIST"
    fi
} | awk '
    /^[[:space:]]*$/ { next }
    /^[[:space:]]*#/ { next }
    !seen[$0]++ { print }
' > "$MERGED_TRACKED_FILE_LIST"

if [ ! -s "$MERGED_TRACKED_FILE_LIST" ]; then
    echo "Tracked stock file list is empty; refusing uninstall verification." >&2
    exit 1
fi

while IFS= read -r live_path; do
    [ -n "$live_path" ] || continue

    rel_path="${live_path#/}"
    baseline_path="$VERIFY_ROOT/$rel_path"

    if [ -e "$baseline_path" ]; then
        if [ ! -e "$live_path" ]; then
            echo "Expected baseline file is missing after uninstall: $live_path" >&2
            exit 1
        fi
        if ! cmp -s "$live_path" "$baseline_path"; then
            echo "Install baseline verification failed for $live_path" >&2
            exit 1
        fi
    else
        if [ -e "$live_path" ]; then
            echo "Overlay file still present after uninstall: $live_path" >&2
            exit 1
        fi
    fi
done < "$MERGED_TRACKED_FILE_LIST"

echo "verified_install_baseline=$BASELINE_DIR"
