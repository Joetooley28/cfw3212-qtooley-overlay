# Copyright (C) 2026 Joe Tooley
# SPDX-License-Identifier: GPL-2.0-or-later
# See repository root LICENSE for full license text.

param(
    [string]$RepoRoot = ""
)

if (-not $RepoRoot) {
    $candidates = @(
        $PSScriptRoot,
        (Split-Path -Parent $PSScriptRoot),
        (Get-Location).Path
    ) | Where-Object { $_ } | Select-Object -Unique

    foreach ($candidate in $candidates) {
        if ((Test-Path (Join-Path $candidate "scripts\stock_ui_at_release_common.ps1")) -and
            (Test-Path (Join-Path $candidate "router-files\stock-ui-at"))) {
            $RepoRoot = $candidate
            break
        }
    }
}

if (-not $RepoRoot) {
    throw "Unable to resolve RepoRoot automatically from the extracted installer folder. Open PowerShell in the extracted ZIP root and run this script there, or pass -RepoRoot explicitly for local dev use."
}

. (Join-Path $RepoRoot "scripts\stock_ui_at_release_common.ps1")

$packageRoot = Get-StockUiPackageRoot -RepoRoot $RepoRoot
$remoteStageRoot = "/tmp/qtooley-stock-ui-at-package"
$remoteScriptPath = "$remoteStageRoot/package/install_stock_ui_release.sh"

Write-Host "Qtooley stock UI install / update"
Show-OoklaInstallMode -PackageRoot $packageRoot

$transport = Select-SshTransport
Write-Host "Note: on a normal first install, the stock uninstall baseline is captured automatically. You do not need forced recapture."
$forceRecaptureBaseline = Read-YesNo -Prompt "Last-resort only: force recapture of the uninstall stock baseline from this router right now?" -DefaultYes $false

if ($forceRecaptureBaseline) {
    Write-Host "WARNING: forced baseline recapture should only be used when the saved uninstall baseline is missing or known-bad."
    Write-Host "WARNING: do this only on a box that is currently showing the stock UI you want uninstall to restore later."
    if (-not (Read-YesNo -Prompt "Proceed with FORCE_RECAPTURE_BASELINE=1?" -DefaultYes $false)) {
        Write-Host "Forced baseline recapture cancelled. Continuing with normal install/update."
        $forceRecaptureBaseline = $false
    }
}

if (-not (Read-YesNo -Prompt "Proceed with install/update?" -DefaultYes $false)) {
    Write-Host "Install cancelled."
    exit 0
}

Invoke-RemotePackageScriptViaSsh `
    -PackageRoot $packageRoot `
    -Target $transport.Target `
    -RemoteStageRoot $remoteStageRoot `
    -RemoteScriptPath $remoteScriptPath `
    -RemoteEnvPrefix "FORCE_RECAPTURE_BASELINE=$([int]$forceRecaptureBaseline)"

Write-Host "Install/update finished."
