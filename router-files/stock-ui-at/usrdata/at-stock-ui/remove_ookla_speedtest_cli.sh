#!/bin/sh

# Copyright (C) 2026 Joe Tooley
# SPDX-License-Identifier: GPL-2.0-or-later
# See repository root LICENSE for full license text.

set -eu

BASE="/usrdata/at-stock-ui"
BIN_DIR="$BASE/bin"

rm -f \
    "$BIN_DIR/speedtest" \
    "$BIN_DIR/ookla_speedtest.url"

echo "Removed Ookla Speedtest CLI from $BIN_DIR"
