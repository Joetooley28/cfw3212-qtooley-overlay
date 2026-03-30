#!/bin/sh

set -eu

# --- Disable Jtools overlay reapply-on-boot ---
systemctl disable --now jtools-stock-ui.timer 2>/dev/null || true
systemctl disable jtools-stock-ui.service 2>/dev/null || true
systemctl stop jtools-stock-ui.service 2>/dev/null || true
echo "Jtools systemd units disabled"

# --- TTL: remove override rules if present ---
TTL_CONFIG="/usrdata/at-stock-ui/ttl_config.json"
if [ -f "$TTL_CONFIG" ]; then
    TTL_VALUE=$(cat "$TTL_CONFIG" 2>/dev/null | grep -o '"ttl_value"[[:space:]]*:[[:space:]]*[0-9]*' | grep -o '[0-9]*$' || true)
    if [ -n "$TTL_VALUE" ] && [ "$TTL_VALUE" -gt 0 ] 2>/dev/null; then
        iptables -t mangle -D POSTROUTING -o rmnet+ -j TTL --ttl-set "$TTL_VALUE" 2>/dev/null || true
        ip6tables -t mangle -D POSTROUTING -o rmnet+ -j HL --hl-set "$TTL_VALUE" 2>/dev/null || true
    fi
    rm -f "$TTL_CONFIG"
    echo "TTL override removed"
fi

# --- Speedtest: clean up temp files ---
rm -f /tmp/ookla-speedtest-state.json /tmp/ookla-speedtest-state.json.tmp
rm -f /tmp/ookla-speedtest.pid
rm -f /tmp/ookla-speedtest.lock /tmp/ookla-speedtest-runner.log
rm -f /tmp/ookla-speedtest-ca-snapshot.json /tmp/ookla-speedtest-ca-snapshot.json.tmp
rm -rf /tmp/ookla-speedtest-home

# --- Quick Overview: remove persisted settings ---
rm -f /usrdata/at-stock-ui/quick_overview_settings.json

# --- Screensaver: remove persisted settings ---
rm -f /usrdata/at-stock-ui/screensaver_settings.json

# --- RAT/Band: remove persisted settings ---
rm -f /usrdata/at-stock-ui/band_locking_config.json

# --- AT terminal: remove saved-command settings ---
rm -f /usrdata/at-stock-ui/at_terminal_saved_commands.json

# --- Detach overlay bind mounts (robust, matching apply script) ---
detach_mount_if_needed() {
    target="$1"
    if grep -q " $target " /proc/self/mountinfo 2>/dev/null; then
        umount "$target" 2>/dev/null || umount -l "$target" 2>/dev/null || true
    fi
}

detach_mount_if_needed "/usr/share/lua/5.1/webif"
detach_mount_if_needed "/www"

systemctl restart turbontc.service

echo "stock-ui AT live tree unbound"
