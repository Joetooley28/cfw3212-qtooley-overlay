#!/bin/sh

set -eu

BASE="/usrdata/at-stock-ui"
BIN_DIR="$BASE/bin"

rm -f \
    "$BIN_DIR/speedtest" \
    "$BIN_DIR/ookla_speedtest.url"

echo "Removed Ookla Speedtest CLI from $BIN_DIR"
