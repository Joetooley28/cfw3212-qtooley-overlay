#!/bin/sh

set -eu

BASE="/usrdata/at-stock-ui"
BIN_DIR="$BASE/bin"
TMP_DIR="/tmp/ookla-speedtest-install.$$"
URL="${1:-https://install.speedtest.net/app/cli/ookla-speedtest-1.2.0-linux-armhf.tgz}"

cleanup() {
    rm -rf "$TMP_DIR"
}

trap cleanup EXIT INT TERM

mkdir -p "$BIN_DIR" "$TMP_DIR"

ARCHIVE="$TMP_DIR/speedtest.tgz"

if command -v wget >/dev/null 2>&1; then
    wget -O "$ARCHIVE" "$URL"
elif command -v curl >/dev/null 2>&1; then
    curl -L -o "$ARCHIVE" "$URL"
else
    echo "Neither wget nor curl is available."
    exit 1
fi

tar -xzf "$ARCHIVE" -C "$TMP_DIR"

if [ ! -f "$TMP_DIR/speedtest" ]; then
    echo "speedtest binary not found in archive."
    exit 1
fi

cp "$TMP_DIR/speedtest" "$BIN_DIR/speedtest"
chmod 0755 "$BIN_DIR/speedtest"
echo "$URL" > "$BIN_DIR/ookla_speedtest.url"

echo "Installed Ookla Speedtest CLI to $BIN_DIR/speedtest"
