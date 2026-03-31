#!/bin/sh

set -eu

BASELINE_DIR="${1:-/usrdata/at-stock-ui/installer-state/install-baseline}"
PIVOT_WWW="/overlay/pivot/www"
PIVOT_WEBIF="/overlay/pivot/usr/share/lua/5.1/webif"

mkdir -p "$BASELINE_DIR"

for required in "$PIVOT_WWW" "$PIVOT_WEBIF"; do
    if [ ! -d "$required" ]; then
        echo "Missing required stock path: $required" >&2
        exit 1
    fi
done

rm -f "$BASELINE_DIR/install_www.tar" "$BASELINE_DIR/install_webif.tar" "$BASELINE_DIR/BASELINE_INFO.txt"

tar -cf "$BASELINE_DIR/install_www.tar" -C /overlay/pivot www
tar -cf "$BASELINE_DIR/install_webif.tar" -C /overlay/pivot usr/share/lua/5.1/webif

{
    echo "captured_at=$(date -Iseconds 2>/dev/null || date)"
    echo "source_www=$PIVOT_WWW"
    echo "source_webif=$PIVOT_WEBIF"
    echo "install_www_tar=install_www.tar"
    echo "install_webif_tar=install_webif.tar"
} > "$BASELINE_DIR/BASELINE_INFO.txt"

echo "$BASELINE_DIR"
