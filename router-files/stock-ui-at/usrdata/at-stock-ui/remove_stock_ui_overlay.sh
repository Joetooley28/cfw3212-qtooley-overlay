#!/bin/sh

set -eu

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

umount /usr/share/lua/5.1/webif 2>/dev/null || true
umount /www 2>/dev/null || true

systemctl restart turbontc.service

echo "stock-ui AT live tree unbound"
