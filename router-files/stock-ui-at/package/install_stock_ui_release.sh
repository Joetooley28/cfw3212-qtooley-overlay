#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
PACKAGE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

TARGET_BASE="/usrdata/at-stock-ui"
TARGET_UNITS="/etc/systemd/system"
INSTALLER_STATE_DIR="$TARGET_BASE/installer-state"
BASELINE_INFO="$INSTALLER_STATE_DIR/installer-baseline-info.txt"
INSTALL_BASELINE_DIR="$INSTALLER_STATE_DIR/install-baseline"
UNIT_SRC="$PACKAGE_ROOT/etc/systemd/system"
DEFAULT_BUNDLED_OOKLA="$TARGET_BASE/bundles/ookla/ookla-speedtest-1.2.0-linux-armhf.tgz"
INSTALL_BUNDLED_OOKLA="${INSTALL_BUNDLED_OOKLA:-1}"
OOKLA_ARCHIVE_PATH="${OOKLA_ARCHIVE_PATH:-$DEFAULT_BUNDLED_OOKLA}"

log() {
    echo "$1"
}

require_path() {
    if [ ! -e "$1" ]; then
        echo "Missing required path: $1" >&2
        exit 1
    fi
}

get_free_kb() {
    df -k /usrdata 2>/dev/null | awk 'NR==2 {print $4}'
}

get_tree_kb() {
    du -sk "$1" 2>/dev/null | awk '{print $1}'
}

has_install_baseline() {
    [ -f "$INSTALL_BASELINE_DIR/install_www.tar" ] && [ -f "$INSTALL_BASELINE_DIR/install_webif.tar" ]
}

get_install_baseline_required_kb() {
    local total_kb

    total_kb="$(du -sk /overlay/pivot/www /overlay/pivot/usr/share/lua/5.1/webif 2>/dev/null | awk '{sum += $1} END {print sum+1024}')"
    echo "${total_kb:-0}"
}

has_existing_overlay_payload() {
    [ -d "$TARGET_BASE/www" ] || [ -d "$TARGET_BASE/usr" ] || [ -f "$TARGET_BASE/apply_stock_ui_overlay.sh" ]
}

capture_baseline_once() {
    local free_kb required_kb snapshot_path existing_payload captured_baseline

    if [ -f "$BASELINE_INFO" ] && has_install_baseline; then
        log "Installer baseline already recorded."
        return 0
    fi

    mkdir -p "$INSTALLER_STATE_DIR"
    free_kb="$(get_free_kb)"
    existing_payload="no"
    snapshot_path=""

    if has_existing_overlay_payload; then
        existing_payload="yes"
    fi

    if [ "$existing_payload" = "yes" ] && [ -x "$TARGET_BASE/capture_overlay_recovery_snapshot.sh" ]; then
        required_kb=$(get_tree_kb "$TARGET_BASE")
        required_kb=$((required_kb + 2048))
        if [ -n "$free_kb" ] && [ "$free_kb" -gt "$required_kb" ]; then
            snapshot_path=$(/bin/sh "$TARGET_BASE/capture_overlay_recovery_snapshot.sh" installer_baseline_payload 2>/dev/null || true)
        else
            log "Skipping one-time baseline payload snapshot: not enough free space."
        fi
    fi

    captured_baseline="no"
    if has_install_baseline; then
        captured_baseline="yes"
    else
        mkdir -p "$INSTALL_BASELINE_DIR"
        /bin/sh "$PACKAGE_ROOT/usrdata/at-stock-ui/capture_install_baseline.sh" "$INSTALL_BASELINE_DIR" >/dev/null
        captured_baseline="yes"
    fi

    {
        echo "created_at=$(date -Iseconds 2>/dev/null || date)"
        echo "package_root=$PACKAGE_ROOT"
        echo "existing_overlay_payload=$existing_payload"
        echo "install_baseline_dir=$INSTALL_BASELINE_DIR"
        echo "install_baseline_captured=$captured_baseline"
        echo "baseline_payload_snapshot=${snapshot_path:-}"
        echo "free_kb_at_install=${free_kb:-unknown}"
    } > "$BASELINE_INFO"
}

verify_prerequisites() {
    local free_kb required_kb baseline_required_kb

    require_path "$PACKAGE_ROOT/www"
    require_path "$PACKAGE_ROOT/usr"
    require_path "$PACKAGE_ROOT/usrdata/at-stock-ui/apply_stock_ui_overlay.sh"
    require_path "$PACKAGE_ROOT/usrdata/at-stock-ui/capture_install_baseline.sh"
    require_path "$PACKAGE_ROOT/usrdata/at-stock-ui/restore_install_baseline.sh"
    require_path "$UNIT_SRC/jtools-stock-ui.service"
    require_path "$UNIT_SRC/jtools-stock-ui.timer"
    require_path "/overlay/pivot/www"
    require_path "/overlay/pivot/usr/share/lua/5.1/webif"

    if ! command -v systemctl >/dev/null 2>&1; then
        echo "systemctl is required on the router." >&2
        exit 1
    fi

    free_kb="$(get_free_kb)"
    required_kb="$(get_tree_kb "$PACKAGE_ROOT")"
    required_kb=$((required_kb + 4096))

    if ! has_install_baseline; then
        baseline_required_kb="$(get_install_baseline_required_kb)"
        required_kb=$((required_kb + baseline_required_kb))
    fi

    if [ -z "$free_kb" ] || [ "$free_kb" -le "$required_kb" ]; then
        echo "Not enough free space under /usrdata for install/update and first-install baseline capture." >&2
        echo "free_kb=${free_kb:-unknown} required_kb=$required_kb" >&2
        exit 1
    fi
}

sync_payload() {
    local item name

    mkdir -p "$TARGET_BASE"
    rm -rf "$TARGET_BASE/www" "$TARGET_BASE/usr" "$TARGET_BASE/overlay" "$TARGET_BASE/stock-snapshots"

    cp -a "$PACKAGE_ROOT/www" "$TARGET_BASE/"
    cp -a "$PACKAGE_ROOT/usr" "$TARGET_BASE/"

    if [ -d "$PACKAGE_ROOT/overlay" ]; then
        cp -a "$PACKAGE_ROOT/overlay" "$TARGET_BASE/"
    fi

    for item in "$PACKAGE_ROOT/usrdata/at-stock-ui"/*; do
        [ -e "$item" ] || continue
        name="$(basename "$item")"
        rm -rf "$TARGET_BASE/$name"
        cp -a "$item" "$TARGET_BASE/"
    done
}

normalize_shell_scripts() {
    local script tmp

    find "$TARGET_BASE" -type f -name '*.sh' | while read -r script; do
        tmp="${script}.tmp"
        tr -d '\r' < "$script" > "$tmp"
        mv "$tmp" "$script"
        chmod 755 "$script"
    done
}

install_units() {
    cp -a "$UNIT_SRC/jtools-stock-ui.service" "$TARGET_UNITS/jtools-stock-ui.service"
    cp -a "$UNIT_SRC/jtools-stock-ui.timer" "$TARGET_UNITS/jtools-stock-ui.timer"
    systemctl daemon-reload
    systemctl enable jtools-stock-ui.timer >/dev/null 2>&1
    systemctl start jtools-stock-ui.timer >/dev/null 2>&1

    if [ "$(systemctl is-enabled jtools-stock-ui.timer 2>/dev/null || true)" != "enabled" ]; then
        echo "Failed to enable jtools-stock-ui.timer during install." >&2
        exit 1
    fi
}

install_bundled_ookla_if_requested() {
    if [ "$INSTALL_BUNDLED_OOKLA" != "1" ]; then
        log "Bundled Ookla install skipped by request."
        return 0
    fi

    if [ -f "$OOKLA_ARCHIVE_PATH" ]; then
        /bin/sh "$TARGET_BASE/install_ookla_speedtest_cli.sh" "$OOKLA_ARCHIVE_PATH"
        return 0
    fi

    log "Bundled Ookla archive not present; leaving Ookla CLI install unchanged."
}

apply_overlay_now() {
    /bin/sh "$TARGET_BASE/apply_stock_ui_overlay.sh"
}

verify_result() {
    if ! grep -E '(/at-stock-ui/live|/usrdata/at-stock-ui/live).*[[:space:]]/www[[:space:]]' /proc/self/mountinfo >/dev/null 2>&1; then
        echo "Expected live /www bind mount was not found after apply." >&2
        exit 1
    fi

    if ! grep -E '(/at-stock-ui/live|/usrdata/at-stock-ui/live).*[[:space:]]/usr/share/lua/5.1/webif[[:space:]]' /proc/self/mountinfo >/dev/null 2>&1; then
        echo "Expected live /usr/share/lua/5.1/webif bind mount was not found after apply." >&2
        exit 1
    fi
}

verify_prerequisites
capture_baseline_once
sync_payload
normalize_shell_scripts
install_units
install_bundled_ookla_if_requested
apply_overlay_now
verify_result

log "Qtooley stock UI install/update complete."
