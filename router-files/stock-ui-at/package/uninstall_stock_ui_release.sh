#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PACKAGE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
TARGET_BASE="/usrdata/at-stock-ui"
TARGET_UNITS="/etc/systemd/system"
INSTALL_BASELINE_DIR="$TARGET_BASE/installer-state/install-baseline"
REMOVE_TAILSCALE="${REMOVE_TAILSCALE:-0}"
REMOVE_PAYLOAD="${REMOVE_PAYLOAD:-1}"

log() {
    echo "$1"
}

detach_mount_if_needed() {
    target="$1"
    if grep -q " $target " /proc/self/mountinfo 2>/dev/null; then
        umount "$target" 2>/dev/null || umount -l "$target" 2>/dev/null || true
    fi
}

inline_overlay_cleanup() {
    systemctl disable --now jtools-stock-ui.timer 2>/dev/null || true
    systemctl disable jtools-stock-ui.service 2>/dev/null || true
    systemctl stop jtools-stock-ui.service 2>/dev/null || true

    detach_mount_if_needed "/usr/share/lua/5.1/webif"
    detach_mount_if_needed "/www"

    systemctl restart turbontc.service 2>/dev/null || true
}

cleanup_extra_overlay_state() {
    rm -f /tmp/ookla-speedtest-state.json /tmp/ookla-speedtest-state.json.tmp
    rm -f /tmp/ookla-speedtest.pid /tmp/ookla-speedtest.lock /tmp/ookla-speedtest-runner.log
    rm -f /tmp/ookla-speedtest-ca-snapshot.json /tmp/ookla-speedtest-ca-snapshot.json.tmp
    rm -rf /tmp/ookla-speedtest-home

    rm -f "$TARGET_BASE/quick_overview_settings.json"
    rm -f "$TARGET_BASE/screensaver_settings.json"
    rm -f "$TARGET_BASE/band_locking_config.json"
    rm -f "$TARGET_BASE/at_terminal_saved_commands.json"
    rm -f "$TARGET_BASE/ttl_config.json"
}

remove_installed_ookla() {
    if [ -x "$TARGET_BASE/remove_ookla_speedtest_cli.sh" ]; then
        /bin/sh "$TARGET_BASE/remove_ookla_speedtest_cli.sh" || true
    else
        rm -f "$TARGET_BASE/bin/speedtest" "$TARGET_BASE/bin/ookla_speedtest.url"
    fi
}

remove_tailscale_if_requested() {
    if [ "$REMOVE_TAILSCALE" != "1" ]; then
        log "Tailscale removal skipped."
        return 0
    fi

    if [ -x "$TARGET_BASE/remove_tailscale.sh" ]; then
        /bin/sh "$TARGET_BASE/remove_tailscale.sh" || true
    else
        systemctl stop tailscaled >/dev/null 2>&1 || true
        systemctl disable tailscaled >/dev/null 2>&1 || true
        rm -f /lib/systemd/system/tailscaled.service
        systemctl daemon-reload >/dev/null 2>&1 || true
        rm -rf /usrdata/tailscale
        rm -f /usrdata/root/bin/tailscale
    fi

}

remove_units() {
    rm -f "$TARGET_UNITS/jtools-stock-ui.service" "$TARGET_UNITS/jtools-stock-ui.timer"
    systemctl daemon-reload >/dev/null 2>&1 || true
}

remove_payload_if_requested() {
    if [ "$REMOVE_PAYLOAD" != "1" ]; then
        log "Qtooley payload retained at $TARGET_BASE"
        return 0
    fi

    if [ -d "$TARGET_BASE" ]; then
        rm -rf "$TARGET_BASE"
        log "Removed Qtooley payload and installer baseline from $TARGET_BASE"
    else
        log "Qtooley payload path already absent: $TARGET_BASE"
    fi
}

verify_install_baseline_if_present() {
    if [ -f "$PACKAGE_ROOT/usrdata/at-stock-ui/restore_install_baseline.sh" ] && [ -d "$INSTALL_BASELINE_DIR" ]; then
        /bin/sh "$PACKAGE_ROOT/usrdata/at-stock-ui/restore_install_baseline.sh" "$INSTALL_BASELINE_DIR"
        return 0
    fi

    log "Install baseline not present; relying on stock live trees after unmount."
}

verify_stock_state() {
    if grep -E '/at-stock-ui/live|/usrdata/at-stock-ui/live' /proc/self/mountinfo >/dev/null 2>&1; then
        echo "Live overlay mount still appears active after uninstall." >&2
        exit 1
    fi
}

if [ -x "$TARGET_BASE/remove_stock_ui_overlay.sh" ]; then
    /bin/sh "$TARGET_BASE/remove_stock_ui_overlay.sh" || true
else
    inline_overlay_cleanup
fi

verify_install_baseline_if_present
cleanup_extra_overlay_state
remove_installed_ookla
remove_tailscale_if_requested
remove_units

remove_payload_if_requested

systemctl restart turbontc.service 2>/dev/null || true
verify_stock_state

log "Qtooley stock UI uninstall complete."
