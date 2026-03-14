#!/bin/sh

set -eu

AT_DIR="/usrdata/at-http"
AT_CMD="lua /usrdata/at-http/at_http.lua /usrdata/at-http/config.json"

if ps | grep '[l]ua /usrdata/at-http/at_http.lua /usrdata/at-http/config.json' >/dev/null 2>&1; then
    logger -t at-http-start "AT terminal already running"
    exit 0
fi

cd "$AT_DIR"
nohup $AT_CMD >/tmp/at-http.out 2>/tmp/at-http.err < /dev/null &

sleep 1

if ps | grep '[l]ua /usrdata/at-http/at_http.lua /usrdata/at-http/config.json' >/dev/null 2>&1; then
    logger -t at-http-start "AT terminal started"
    exit 0
fi

logger -t at-http-start "AT terminal failed to start"
exit 1
