#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
BASELINE_DIR="${1:-/usrdata/at-stock-ui/installer-state/install-baseline}"
LIVE_WWW="/www"
LIVE_WEBIF="/usr/share/lua/5.1/webif"
TRACKED_FILE_LIST="$SCRIPT_DIR/tracked_stock_files.txt"

mkdir -p "$BASELINE_DIR"

for required in "$LIVE_WWW" "$LIVE_WEBIF"; do
    if [ ! -d "$required" ]; then
        echo "Missing required stock path: $required" >&2
        exit 1
    fi
done

if grep -E '/at-stock-ui/live|/usrdata/at-stock-ui/live' /proc/self/mountinfo >/dev/null 2>&1; then
    echo "Refusing to capture install baseline while Qtooley live overlay mounts are active." >&2
    exit 1
fi

rm -f "$BASELINE_DIR/install_www.tar" "$BASELINE_DIR/install_webif.tar" "$BASELINE_DIR/BASELINE_INFO.txt" "$BASELINE_DIR/tracked_stock_files.txt"

tar -cf "$BASELINE_DIR/install_www.tar" -C / www
tar -cf "$BASELINE_DIR/install_webif.tar" -C / usr/share/lua/5.1/webif

if [ -f "$TRACKED_FILE_LIST" ]; then
    cp "$TRACKED_FILE_LIST" "$BASELINE_DIR/tracked_stock_files.txt"
fi

{
    echo "captured_at=$(date -Iseconds 2>/dev/null || date)"
    echo "source_www=$LIVE_WWW"
    echo "source_webif=$LIVE_WEBIF"
    echo "overlay_mounts_active=no"
    echo "install_www_tar=install_www.tar"
    echo "install_webif_tar=install_webif.tar"
    echo "tracked_file_list=tracked_stock_files.txt"
} > "$BASELINE_DIR/BASELINE_INFO.txt"

echo "$BASELINE_DIR"
