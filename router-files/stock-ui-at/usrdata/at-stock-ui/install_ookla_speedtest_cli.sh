#!/bin/sh

# Copyright (C) 2026 Joe Tooley
# SPDX-License-Identifier: GPL-2.0-or-later
# See repository root LICENSE for full license text.

set -eu

BASE="/usrdata/at-stock-ui"
BIN_DIR="$BASE/bin"
TMP_DIR="/tmp/ookla-speedtest-install.$$"
DEFAULT_URL="https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-armhf.tgz"
BUNDLED_ARCHIVE="$BASE/bundles/ookla/ookla-speedtest-1.2.0-linux-armhf.tgz"
SOURCE="${1:-}"

cleanup() {
    rm -rf "$TMP_DIR"
}

trap cleanup EXIT INT TERM

mkdir -p "$BIN_DIR" "$TMP_DIR"

ARCHIVE="$TMP_DIR/speedtest.tgz"
SOURCE_LABEL=""

if [ -z "$SOURCE" ] && [ -f "$BUNDLED_ARCHIVE" ]; then
    SOURCE="$BUNDLED_ARCHIVE"
fi

if [ -n "$SOURCE" ] && [ -f "$SOURCE" ]; then
    cp "$SOURCE" "$ARCHIVE"
    SOURCE_LABEL="$SOURCE"
else
    URL="${SOURCE:-$DEFAULT_URL}"
    if command -v wget >/dev/null 2>&1; then
        wget -O "$ARCHIVE" "$URL"
    elif command -v curl >/dev/null 2>&1; then
        curl -L -o "$ARCHIVE" "$URL"
    else
        echo "Neither wget nor curl is available."
        exit 1
    fi
    SOURCE_LABEL="$URL"
fi

tar -xzf "$ARCHIVE" -C "$TMP_DIR"

if [ ! -f "$TMP_DIR/speedtest" ]; then
    echo "speedtest binary not found in archive."
    exit 1
fi

cp "$TMP_DIR/speedtest" "$BIN_DIR/speedtest"
chmod 0755 "$BIN_DIR/speedtest"
echo "$SOURCE_LABEL" > "$BIN_DIR/ookla_speedtest.url"

echo "Installed Ookla Speedtest CLI to $BIN_DIR/speedtest"
echo "Source: $SOURCE_LABEL"
