-- Copyright (C) 2026 Joe Tooley
-- SPDX-License-Identifier: GPL-2.0-or-later
-- See repository root LICENSE for full license text.

local bit = require("bit")
local ffi = require("ffi")

ffi.cdef[[
int open(const char *pathname, int flags);
int close(int fd);
int flock(int fd, int operation);
]]

local M = {}

local O_RDWR = 2

local LOCK_EX = 2
local LOCK_NB = 4
local LOCK_UN = 8

function M.acquire(lock_path)
    -- Phase 1 uses a fail-fast exclusive lock. The config does not expose a
    -- lock timeout because this implementation intentionally does not wait.
    local seed = io.open(lock_path, "ab")
    if not seed then
        return nil, "lock_open_failed"
    end
    seed:close()

    local fd = ffi.C.open(lock_path, O_RDWR)
    if fd < 0 then
        return nil, "lock_open_failed"
    end

    local rc = ffi.C.flock(fd, bit.bor(LOCK_EX, LOCK_NB))
    if rc ~= 0 then
        ffi.C.close(fd)
        return nil, "at_channel_busy"
    end

    return fd, nil
end

function M.release(fd)
    if fd == nil then
        return
    end
    ffi.C.flock(fd, LOCK_UN)
    ffi.C.close(fd)
end

return M
