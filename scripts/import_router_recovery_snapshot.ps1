# Copyright (C) 2026 Joe Tooley
# SPDX-License-Identifier: GPL-2.0-or-later
# See repository root LICENSE for full license text.

param(
    [string]$RouterSnapshotPath,
    [string]$RepoRoot = "C:\at_terminal\repo-public",
    [string]$RepoSnapshotRoot = "C:\at_terminal\repo-public\recovery-snapshots\stock-ui-last-good",
    [string]$DesktopSnapshotRoot = "C:\Users\jbake\Desktop\qtooley-recovery-snapshots",
    [int]$KeepLast = 3
)

$ErrorActionPreference = "Stop"

if (-not $RouterSnapshotPath) {
    throw "RouterSnapshotPath is required."
}

$snapshotName = Split-Path -Path $RouterSnapshotPath -Leaf
$tempRoot = Join-Path $env:TEMP ("router-snapshot-import-" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

try {
    $pulledPath = Join-Path $tempRoot $snapshotName
    & adb pull $RouterSnapshotPath $pulledPath | Out-Host
    if (-not (Test-Path $pulledPath)) {
        throw "ADB pull did not create expected path: $pulledPath"
    }

    $payloadPath = Join-Path $pulledPath "www"
    if (-not (Test-Path $payloadPath)) {
        throw "Pulled snapshot does not look like a router recovery snapshot: $pulledPath"
    }

    & powershell -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "scripts\update_last_good_stock_ui_snapshot.ps1") `
        -RepoRoot $RepoRoot `
        -SourcePath $pulledPath `
        -RepoSnapshotRoot $RepoSnapshotRoot `
        -DesktopSnapshotRoot $DesktopSnapshotRoot `
        -Commit "router-snapshot" `
        -Label $snapshotName `
        -Note ("Imported exact on-box snapshot from " + $RouterSnapshotPath) `
        -KeepLast $KeepLast
} finally {
    if (Test-Path $tempRoot) {
        Remove-Item -Recurse -Force $tempRoot
    }
}
