#!/bin/sh

set -eu

BASE="/usrdata/at-stock-ui"
RUNTIME="/usrdata/tailscale"
SYSTEMD_DST="/lib/systemd/system/tailscaled.service"
SYSTEMD_TEMPLATE="$BASE/tailscale-systemd/tailscaled.service"
DEFAULTS_TEMPLATE="$BASE/tailscale-systemd/tailscaled.defaults"
DEFAULTS_DST="$RUNTIME/systemd/tailscaled.defaults"
PKG_INDEX="https://pkgs.tailscale.com/stable/"
FORCE_REINSTALL=0

if [ "${1:-}" = "--force" ]; then
    FORCE_REINSTALL=1
fi

log() {
    echo "$1"
}

need_cmd() {
    command -v "$1" >/dev/null 2>&1
}

fetch_url() {
    if need_cmd curl; then
        curl --connect-timeout 8 --max-time 20 -fsSL "$1"
        return
    fi
    wget --timeout=20 -qO- "$1"
}

download_file() {
    if need_cmd curl; then
        curl --connect-timeout 8 --max-time 30 -fsSL "$1" -o "$2"
        return
    fi
    wget --timeout=30 -qO "$2" "$1"
}

remount_rw() {
    mount -o remount,rw / >/dev/null 2>&1 || true
}

remount_ro() {
    mount -o remount,ro / >/dev/null 2>&1 || true
}

log "Detecting latest stable Tailscale ARM build..."
if ! INDEX_HTML="$(fetch_url "$PKG_INDEX")"; then
    log "Could not reach the Tailscale package site. Check router internet access and DNS, then try again."
    exit 1
fi
TARBALL="$(printf '%s\n' "$INDEX_HTML" | grep -o 'tailscale_[0-9][0-9.]*_arm\.tgz' | sort -uV | tail -n 1 || true)"

if [ -z "$TARBALL" ]; then
    log "Failed to locate a stable 32-bit ARM Tailscale tarball."
    exit 1
fi

CURRENT_SOURCE=""
if [ -f "$RUNTIME/INSTALL_SOURCE.txt" ]; then
    CURRENT_SOURCE="$(cat "$RUNTIME/INSTALL_SOURCE.txt" 2>/dev/null || true)"
fi

if [ "$FORCE_REINSTALL" -ne 1 ] && [ -n "$CURRENT_SOURCE" ] && [ "$CURRENT_SOURCE" = "$TARBALL" ]; then
    log "QTOOLEY_TAILSCALE_ALREADY_CURRENT=1"
    log "Tailscale is already up to date: $TARBALL"
    exit 0
fi

TMPDIR="/usrdata/.qtooley-tailscale-install.$$"
ARCHIVE="$TMPDIR/$TARBALL"
mkdir -p "$TMPDIR"
trap 'remount_ro; rm -rf "$TMPDIR"' EXIT INT TERM

log "Downloading $TARBALL ..."
if ! download_file "${PKG_INDEX}${TARBALL}" "$ARCHIVE"; then
    log "Failed to download the Tailscale package. The router may not have working internet access."
    exit 1
fi

log "Extracting Tailscale runtime..."
tar -xzf "$ARCHIVE" -C "$TMPDIR"

BIN_PATH="$(find "$TMPDIR" -type f -name tailscale | head -n 1 || true)"
DAEMON_PATH="$(find "$TMPDIR" -type f -name tailscaled | head -n 1 || true)"

if [ -z "$BIN_PATH" ] || [ -z "$DAEMON_PATH" ]; then
    log "Downloaded archive did not contain both tailscale and tailscaled."
    exit 1
fi

mkdir -p "$RUNTIME" "$RUNTIME/state" "$RUNTIME/systemd"
systemctl stop tailscaled >/dev/null 2>&1 || true
cp "$BIN_PATH" "$RUNTIME/tailscale"
cp "$DAEMON_PATH" "$RUNTIME/tailscaled"
chmod 755 "$RUNTIME/tailscale" "$RUNTIME/tailscaled"
printf '%s\n' "$TARBALL" > "$RUNTIME/INSTALL_SOURCE.txt"

if [ ! -f "$SYSTEMD_TEMPLATE" ] || [ ! -f "$DEFAULTS_TEMPLATE" ]; then
    log "Missing packaged Tailscale systemd templates under $BASE."
    exit 1
fi

cp "$DEFAULTS_TEMPLATE" "$DEFAULTS_DST"

remount_rw
cp "$SYSTEMD_TEMPLATE" "$SYSTEMD_DST"
systemctl daemon-reload
systemctl enable tailscaled >/dev/null 2>&1 || true
systemctl restart tailscaled
remount_ro

mkdir -p /usrdata/root/bin >/dev/null 2>&1 || true
ln -sf "$RUNTIME/tailscale" /usrdata/root/bin/tailscale >/dev/null 2>&1 || true

if [ "$FORCE_REINSTALL" -eq 1 ]; then
    log "QTOOLEY_TAILSCALE_FORCED_REINSTALL=1"
else
    log "QTOOLEY_TAILSCALE_UPDATED=1"
fi
log "Tailscale installed/updated successfully."
