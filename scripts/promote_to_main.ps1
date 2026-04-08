param(
    [string]$SourceRepo = "C:\at_terminal\repo-public",
    [string]$DestinationRepo = "C:\at_terminal\repo-public-main",
    [switch]$Apply,
    [switch]$IncludeDocs = $true,
    [switch]$IncludeReleasePayload = $true,
    [switch]$IncludeReleaseScripts = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-GitRepo {
    param(
        [string]$Path
    )

    if (-not (Test-Path (Join-Path $Path ".git"))) {
        throw "Not a git worktree: $Path"
    }
}

function Get-TrackedFiles {
    param(
        [string]$RepoRoot
    )

    $output = & git -C $RepoRoot ls-files
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to list tracked files for $RepoRoot"
    }

    return $output | Where-Object { $_ -and $_.Trim() }
}

function Copy-TrackedFile {
    param(
        [string]$SourceRepoRoot,
        [string]$DestinationRepoRoot,
        [string]$RelativePath,
        [bool]$ApplyChanges
    )

    $sourcePath = Join-Path $SourceRepoRoot $RelativePath
    $destinationPath = Join-Path $DestinationRepoRoot $RelativePath

    if (-not (Test-Path $sourcePath)) {
        throw "Source file missing for tracked destination path: $RelativePath"
    }

    if (-not (Test-Path $destinationPath)) {
        throw "Destination tracked file is missing on disk: $RelativePath"
    }

    $sourceBytes = [System.IO.File]::ReadAllBytes($sourcePath)
    $destinationBytes = [System.IO.File]::ReadAllBytes($destinationPath)
    $sameLength = $sourceBytes.Length -eq $destinationBytes.Length
    $sameContent = $sameLength

    if ($sameContent) {
        for ($i = 0; $i -lt $sourceBytes.Length; $i++) {
            if ($sourceBytes[$i] -ne $destinationBytes[$i]) {
                $sameContent = $false
                break
            }
        }
    }

    if ($sameContent) {
        return $false
    }

    if ($ApplyChanges) {
        $parent = Split-Path -Parent $destinationPath
        if (-not (Test-Path $parent)) {
            New-Item -ItemType Directory -Force -Path $parent | Out-Null
        }
        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
    }

    return $true
}

Assert-GitRepo -Path $SourceRepo
Assert-GitRepo -Path $DestinationRepo

$destinationTracked = Get-TrackedFiles -RepoRoot $DestinationRepo
$allowedPrefixes = New-Object System.Collections.Generic.List[string]
$allowedExact = New-Object System.Collections.Generic.HashSet[string]([System.StringComparer]::OrdinalIgnoreCase)

if ($IncludeDocs) {
    $allowedPrefixes.Add("docs/")
    $null = $allowedExact.Add("README.md")
    $null = $allowedExact.Add("CHANGELOG.md")
    $null = $allowedExact.Add("VERSION.txt")
}

if ($IncludeReleasePayload) {
    $allowedPrefixes.Add("router-files/stock-ui-at/")
}

if ($IncludeReleaseScripts) {
    $allowedPrefixes.Add("scripts/")
}

$selected = foreach ($relativePath in $destinationTracked) {
    $normalized = $relativePath.Replace("\", "/")
    $include = $allowedExact.Contains($normalized)

    if (-not $include) {
        foreach ($prefix in $allowedPrefixes) {
            if ($normalized.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                $include = $true
                break
            }
        }
    }

    if ($include) {
        $normalized
    }
}

$selected = $selected | Sort-Object -Unique

if (-not $selected) {
    throw "No tracked public files matched the promotion rules."
}

$mode = if ($Apply) { "APPLY" } else { "DRY RUN" }
Write-Host "Promotion mode: $mode"
Write-Host "Source repo: $SourceRepo"
Write-Host "Destination repo: $DestinationRepo"
Write-Host "Tracked public files considered: $($selected.Count)"

$changed = New-Object System.Collections.Generic.List[string]

foreach ($relativePath in $selected) {
    if (Copy-TrackedFile -SourceRepoRoot $SourceRepo -DestinationRepoRoot $DestinationRepo -RelativePath $relativePath -ApplyChanges:$Apply) {
        $changed.Add($relativePath)
    }
}

if ($changed.Count -eq 0) {
    Write-Host "No destination files differ."
    exit 0
}

Write-Host ""
Write-Host "Files that differ:"
$changed | ForEach-Object { Write-Host " - $_" }

if (-not $Apply) {
    Write-Host ""
    Write-Host "Dry run only. Re-run with -Apply to copy these tracked public files into main."
}
