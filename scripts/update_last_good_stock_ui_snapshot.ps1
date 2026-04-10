# Copyright (C) 2026 Joe Tooley
# SPDX-License-Identifier: GPL-2.0-or-later
# See repository root LICENSE for full license text.

param(
    [string]$RepoRoot = "C:\at_terminal\repo-public",
    [string]$SourcePath = "",
    [string]$RepoSnapshotRoot = "C:\at_terminal\repo-public\recovery-snapshots\stock-ui-last-good",
    [string]$DesktopSnapshotRoot = "C:\Users\jbake\Desktop\qtooley-recovery-snapshots",
    [string]$Commit = "",
    [string]$Label = "",
    [string]$Note = "",
    [int]$KeepLast = 3
)

$ErrorActionPreference = "Stop"

function New-SnapshotName {
    param(
        [string]$CommitText,
        [string]$LabelText
    )

    $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $safeCommit = if ($CommitText) { $CommitText -replace "[^A-Za-z0-9._-]", "-" } else { "working-tree" }
    $safeLabel = if ($LabelText) { ($LabelText -replace "[^A-Za-z0-9._-]", "-").Trim("-") } else { "" }
    if ($safeLabel) {
        return "$stamp" + "_" + $safeCommit + "_" + $safeLabel
    }
    return "$stamp" + "_" + $safeCommit
}

function Write-SnapshotInfo {
    param(
        [string]$InfoPath,
        [string]$RepoRootPath,
        [string]$Source,
        [string]$CommitText,
        [string]$LabelText,
        [string]$NoteText
    )

    @(
        "captured_at=$(Get-Date -Format s)"
        "repo_root=$RepoRootPath"
        "source=$Source"
        "commit=$CommitText"
        "label=$LabelText"
        "note=$NoteText"
    ) | Set-Content -Path $InfoPath
}

function Save-TreeSnapshot {
    param(
        [string]$Source,
        [string]$DestinationRoot,
        [string]$SnapshotName,
        [string]$RepoRootPath,
        [string]$CommitText,
        [string]$LabelText,
        [string]$NoteText,
        [int]$KeepCount
    )

    New-Item -ItemType Directory -Force -Path $DestinationRoot | Out-Null

    $snapshotDir = Join-Path $DestinationRoot $SnapshotName
    if (Test-Path $snapshotDir) {
        Remove-Item -Recurse -Force $snapshotDir
    }
    New-Item -ItemType Directory -Force -Path $snapshotDir | Out-Null

    $payloadDir = Join-Path $snapshotDir "stock-ui-at"
    New-Item -ItemType Directory -Force -Path $payloadDir | Out-Null
    Copy-Item -Recurse -Force (Join-Path $Source "*") $payloadDir

    Write-SnapshotInfo -InfoPath (Join-Path $snapshotDir "SNAPSHOT_INFO.txt") `
        -RepoRootPath $RepoRootPath `
        -Source $Source `
        -CommitText $CommitText `
        -LabelText $LabelText `
        -NoteText $NoteText

    Set-Content -Path (Join-Path $DestinationRoot "LATEST.txt") -Value $SnapshotName

    $snapshots = Get-ChildItem -Path $DestinationRoot -Directory |
        Where-Object { $_.Name -ne "stock-ui-at" } |
        Sort-Object Name -Descending

    if ($snapshots.Count -gt $KeepCount) {
        $snapshots | Select-Object -Skip $KeepCount | ForEach-Object {
            Remove-Item -Recurse -Force $_.FullName
        }
    }
}

if (-not $SourcePath) {
    $SourcePath = Join-Path $RepoRoot "router-files\stock-ui-at"
}

if (-not (Test-Path $SourcePath)) {
    throw "Source path not found: $SourcePath"
}

if (-not $Commit) {
    try {
        $Commit = (git -C $RepoRoot rev-parse --short HEAD).Trim()
    } catch {
        $Commit = "working-tree"
    }
}

$snapshotName = New-SnapshotName -CommitText $Commit -LabelText $Label

Save-TreeSnapshot -Source $SourcePath `
    -DestinationRoot $RepoSnapshotRoot `
    -SnapshotName $snapshotName `
    -RepoRootPath $RepoRoot `
    -CommitText $Commit `
    -LabelText $Label `
    -NoteText $Note `
    -KeepCount $KeepLast

Save-TreeSnapshot -Source $SourcePath `
    -DestinationRoot $DesktopSnapshotRoot `
    -SnapshotName $snapshotName `
    -RepoRootPath $RepoRoot `
    -CommitText $Commit `
    -LabelText $Label `
    -NoteText $Note `
    -KeepCount $KeepLast

Write-Output "Repo snapshot saved: $(Join-Path $RepoSnapshotRoot $snapshotName)"
Write-Output "Desktop snapshot saved: $(Join-Path $DesktopSnapshotRoot $snapshotName)"
