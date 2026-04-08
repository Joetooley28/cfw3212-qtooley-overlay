<#
Usage:
  Dry run:
    powershell -ExecutionPolicy Bypass -File C:\at_terminal\repo-public\scripts\promote_to_main.ps1

  Apply promotion into main:
    powershell -ExecutionPolicy Bypass -File C:\at_terminal\repo-public\scripts\promote_to_main.ps1 -Apply

  Apply promotion and verify a release ZIP with bundled Ookla:
    powershell -ExecutionPolicy Bypass -File C:\at_terminal\repo-public\scripts\promote_to_main.ps1 -Apply -VerifyReleaseBuild
#>

param(
    [string]$SourceRepo = "C:\at_terminal\repo-public",
    [string]$DestinationRepo = "C:\at_terminal\repo-public-main",
    [switch]$Apply,
    [switch]$VerifyReleaseBuild,
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

function Get-ReleaseLabel {
    param(
        [string]$RepoRoot
    )

    $releaseInfoPath = Join-Path $RepoRoot "router-files\stock-ui-at\usrdata\at-stock-ui\JTOOLS_RELEASE.txt"
    if (-not (Test-Path $releaseInfoPath)) {
        throw "Release metadata file not found: $releaseInfoPath"
    }

    $line = Get-Content $releaseInfoPath | Where-Object { $_ -match '^Release label:' } | Select-Object -First 1
    if (-not $line) {
        throw "Release label not found in: $releaseInfoPath"
    }

    return ($line -replace '^Release label:\s*', '').Trim()
}

function Get-VersionText {
    param(
        [string]$RepoRoot
    )

    $versionPath = Join-Path $RepoRoot "VERSION.txt"
    if (-not (Test-Path $versionPath)) {
        throw "VERSION.txt not found: $versionPath"
    }

    return (Get-Content $versionPath | Select-Object -First 1).Trim()
}

function Assert-ReleaseVersionAligned {
    param(
        [string]$RepoRoot,
        [string]$Label
    )

    $version = Get-VersionText -RepoRoot $RepoRoot
    if ($version -ne $Label) {
        throw "Version mismatch in $Label. VERSION.txt has '$version' but JTOOLS_RELEASE.txt has '$Label'."
    }
}

function Assert-BuildScriptSupportsOokla {
    param(
        [string]$RepoRoot
    )

    $buildScriptPath = Join-Path $RepoRoot "scripts\build_stock_ui_at_release.ps1"
    if (-not (Test-Path $buildScriptPath)) {
        throw "Release build script not found: $buildScriptPath"
    }

    $content = [System.IO.File]::ReadAllText($buildScriptPath)
    foreach ($needle in @("Ensure-OoklaBundle", "Assert-OoklaBundlePresent", "ookla-speedtest-1.2.0-linux-armhf.tgz")) {
        if ($content -notmatch [regex]::Escape($needle)) {
            throw "Release build script does not clearly enforce bundled Ookla: missing '$needle'."
        }
    }
}

function Test-ZipContainsOoklaBundle {
    param(
        [string]$ZipPath,
        [string]$ExpectedVersion
    )

    $expandRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("qtooley-promote-check-" + [System.Guid]::NewGuid().ToString("N"))
    try {
        Expand-Archive -LiteralPath $ZipPath -DestinationPath $expandRoot -Force

        $bundlePath = Join-Path $expandRoot "router-files\stock-ui-at\usrdata\at-stock-ui\bundles\ookla\ookla-speedtest-1.2.0-linux-armhf.tgz"
        if (-not (Test-Path $bundlePath)) {
            throw "Built ZIP is missing bundled Ookla archive: $bundlePath"
        }

        $releaseInfoPath = Join-Path $expandRoot "router-files\stock-ui-at\usrdata\at-stock-ui\JTOOLS_RELEASE.txt"
        if (-not (Test-Path $releaseInfoPath)) {
            throw "Built ZIP is missing JTOOLS_RELEASE.txt"
        }

        $releaseLabel = Get-Content $releaseInfoPath | Where-Object { $_ -match '^Release label:' } | Select-Object -First 1
        $releaseLabel = ($releaseLabel -replace '^Release label:\s*', '').Trim()
        if ($releaseLabel -ne $ExpectedVersion) {
            throw "Built ZIP release label mismatch. Expected '$ExpectedVersion' but found '$releaseLabel'."
        }
    }
    finally {
        if (Test-Path $expandRoot) {
            Remove-Item -LiteralPath $expandRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Invoke-ReleaseBuildVerification {
    param(
        [string]$RepoRoot
    )

    $version = Get-VersionText -RepoRoot $RepoRoot
    $outputRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("qtooley-promote-build-" + [System.Guid]::NewGuid().ToString("N"))
    $buildScriptPath = Join-Path $RepoRoot "scripts\build_stock_ui_at_release.ps1"

    try {
        & powershell -ExecutionPolicy Bypass -File $buildScriptPath -RepoRoot $RepoRoot -ReleaseVersion $version -OutputRoot $outputRoot
        if ($LASTEXITCODE -ne 0) {
            throw "Release build verification failed."
        }

        $zipPath = Join-Path $outputRoot ("stock-ui-at-installer-" + $version + ".zip")
        if (-not (Test-Path $zipPath)) {
            throw "Expected release ZIP not found after build verification: $zipPath"
        }

        Test-ZipContainsOoklaBundle -ZipPath $zipPath -ExpectedVersion $version
        Write-Host "Verified release ZIP contains bundled Ookla and matching release metadata."
    }
    finally {
        if (Test-Path $outputRoot) {
            Remove-Item -LiteralPath $outputRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
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

    $sourceBytes = [System.IO.File]::ReadAllBytes($sourcePath)
    $sameContent = $false

    if (Test-Path $destinationPath) {
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

function Test-PublicPathAllowed {
    param(
        [string]$RelativePath,
        [string[]]$AllowedPrefixes,
        [System.Collections.Generic.HashSet[string]]$AllowedExact
    )

    $normalized = $RelativePath.Replace("\", "/")
    if ($AllowedExact.Contains($normalized)) {
        return $true
    }

    foreach ($prefix in $AllowedPrefixes) {
        if ($normalized.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }

    return $false
}

Assert-GitRepo -Path $SourceRepo
Assert-GitRepo -Path $DestinationRepo

$sourceReleaseLabel = Get-ReleaseLabel -RepoRoot $SourceRepo
Assert-ReleaseVersionAligned -RepoRoot $SourceRepo -Label $sourceReleaseLabel
Assert-BuildScriptSupportsOokla -RepoRoot $SourceRepo

$destinationTracked = Get-TrackedFiles -RepoRoot $DestinationRepo
$sourceTracked = Get-TrackedFiles -RepoRoot $SourceRepo
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
    foreach ($scriptPath in @(
        "scripts/build_stock_ui_at_release.ps1",
        "scripts/stock_ui_at_release_common.ps1",
        "scripts/promote_to_main.ps1"
    )) {
        $null = $allowedExact.Add($scriptPath)
    }
}

$selected = foreach ($relativePath in ($destinationTracked + $sourceTracked | Sort-Object -Unique)) {
    $normalized = $relativePath.Replace("\", "/")
    if (Test-PublicPathAllowed -RelativePath $normalized -AllowedPrefixes $allowedPrefixes -AllowedExact $allowedExact) {
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
} else {
    $destinationReleaseLabel = Get-ReleaseLabel -RepoRoot $DestinationRepo
    Assert-ReleaseVersionAligned -RepoRoot $DestinationRepo -Label $destinationReleaseLabel
    Assert-BuildScriptSupportsOokla -RepoRoot $DestinationRepo

    if ($VerifyReleaseBuild) {
        Invoke-ReleaseBuildVerification -RepoRoot $DestinationRepo
    }
}
