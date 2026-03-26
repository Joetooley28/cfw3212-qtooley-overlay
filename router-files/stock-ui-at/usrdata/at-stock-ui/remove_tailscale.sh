#!/bin/sh

set -eu

RUNTIME="/usrdata/tailscale"
SYSTEMD_DST="/lib/systemd/system/tailscaled.service"

remount_rw() {
    mount -o remount,rw / >/dev/null 2>&1 || true
}

remount_ro() {
    mount -o remount,ro / >/dev/null 2>&1 || true
}

trap 'remount_ro' EXIT INT TERM

systemctl stop tailscaled >/dev/null 2>&1 || true
systemctl disable tailscaled >/dev/null 2>&1 || true

remount_rw
rm -f "$SYSTEMD_DST"
systemctl daemon-reload >/dev/null 2>&1 || true
remount_ro

rm -rf "$RUNTIME"
rm -f /usrdata/root/bin/tailscale
rm -f /tmp/qtooley-tailscale-last-output.txt
rm -f /tmp/qtooley-tailscale-last-action.txt

echo "Tailscale removed successfully."
