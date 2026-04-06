param(
    [string]$SnapshotRoot = "C:\at_terminal\repo-public\recovery-snapshots\stock-ui-last-good",
    [string]$SnapshotName = "",
    [string]$RepoRoot = "C:\at_terminal\repo-public"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $SnapshotRoot)) {
    throw "Snapshot root not found: $SnapshotRoot"
}

if (-not $SnapshotName) {
    $latestPath = Join-Path $SnapshotRoot "LATEST.txt"
    if (Test-Path $latestPath) {
        $SnapshotName = (Get-Content -Path $latestPath -Raw).Trim()
    } else {
        $SnapshotName = (Get-ChildItem -Path $SnapshotRoot -Directory | Sort-Object Name -Descending | Select-Object -First 1).Name
    }
}

if (-not $SnapshotName) {
    throw "No snapshot found in $SnapshotRoot"
}

$snapshotDir = Join-Path $SnapshotRoot $SnapshotName
$source = Join-Path $snapshotDir "stock-ui-at"

if (-not (Test-Path $source)) {
    throw "Snapshot payload not found: $source"
}

$target = Join-Path $RepoRoot "router-files\stock-ui-at"
if (-not (Test-Path $target)) {
    throw "Target path not found: $target"
}

$backupRoot = "C:\at_terminal\snapshots\repo-working-backups"
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
$backup = Join-Path $backupRoot ("stock-ui-at-" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Force -Path $backup | Out-Null
Copy-Item -Recurse -Force (Join-Path $target "*") $backup

Get-ChildItem -Force $target | Remove-Item -Recurse -Force
Copy-Item -Recurse -Force (Join-Path $source "*") $target

Write-Output "Restored router-files\\stock-ui-at from $snapshotDir"
Write-Output "Working copy backup saved to $backup"
