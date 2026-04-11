# Copyright (C) 2026 Joe Tooley
# SPDX-License-Identifier: GPL-2.0-or-later
# See repository root LICENSE for full license text.

param(
    [string]$SourceRepo = "C:\at_terminal\repo-public",
    [string]$DestinationRepo = "C:\at_terminal\repo-public-main",
    [string]$RepoSlug = "Joetooley28/cfw3212-qtooley-overlay",
    [string]$ReleaseVersion = "",
    [string]$TemplatePath = "",
    [string]$ReleaseNotesPath = "",
    [string]$BodyOutputPath = "",
    [string]$OutputRoot = "",
    [string]$CommitMessage = "",
    [switch]$SkipPushWorking,
    [switch]$SkipPushMain,
    [switch]$SkipGitHubRelease
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
if ($PSVersionTable.PSVersion.Major -ge 7) {
    $PSNativeCommandUseErrorActionPreference = $false
}

function Invoke-Git {
    param(
        [string]$RepoRoot,
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$Arguments
    )

    $output = & git -C $RepoRoot @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        if ($output) {
            throw ($output -join [Environment]::NewLine)
        }
        throw "git failed in $RepoRoot with arguments: $($Arguments -join ' ')"
    }

    return $output
}

function Invoke-CommandChecked {
    param(
        [string]$CommandName,
        [string[]]$Arguments
    )

    $output = & $CommandName @Arguments 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        if ($output) {
            throw ($output -join [Environment]::NewLine)
        }
        throw "$CommandName failed with arguments: $($Arguments -join ' ')"
    }

    return $output
}

function Get-VersionText {
    param(
        [string]$RepoRoot,
        [string]$Requested
    )

    if ($Requested) {
        return $Requested.Trim()
    }

    $versionPath = Join-Path $RepoRoot "VERSION.txt"
    if (-not (Test-Path $versionPath)) {
        throw "VERSION.txt not found: $versionPath"
    }

    $version = (Get-Content $versionPath | Select-Object -First 1).Trim()
    if (-not $version) {
        throw "VERSION.txt is empty: $versionPath"
    }

    return $version
}

function Assert-Branch {
    param(
        [string]$RepoRoot,
        [string]$ExpectedBranch
    )

    $branch = (Invoke-Git -RepoRoot $RepoRoot rev-parse --abbrev-ref HEAD | Select-Object -First 1).Trim()
    if ($branch -ne $ExpectedBranch) {
        throw "Expected branch '$ExpectedBranch' in $RepoRoot but found '$branch'."
    }
}

function Assert-CleanWorktree {
    param(
        [string]$RepoRoot,
        [string]$Label
    )

    $status = @(Invoke-Git -RepoRoot $RepoRoot status --porcelain)
    if ($status.Count -gt 0) {
        throw "$Label worktree is not clean:`n$($status -join [Environment]::NewLine)"
    }
}

function Get-ReleaseNotesBlock {
    param(
        [string]$NotesPath
    )

    if (-not (Test-Path $NotesPath)) {
        throw "Release notes file not found: $NotesPath"
    }

    $bulletLines = @(Get-Content $NotesPath | Where-Object { $_ -match '^\s*-\s+' } | ForEach-Object { $_.TrimEnd() })
    if ($bulletLines.Count -eq 0) {
        return "- Release notes were not found in bullet form. See the full changelog below."
    }

    return ($bulletLines -join [Environment]::NewLine)
}

function Render-ReleaseBody {
    param(
        [string]$TemplateFile,
        [string]$Version,
        [string]$RepoSlugValue,
        [string]$ReleaseNotesBlock
    )

    if (-not (Test-Path $TemplateFile)) {
        throw "GitHub release body template not found: $TemplateFile"
    }

    $body = [System.IO.File]::ReadAllText($TemplateFile)
    $rawBaseUrl = "https://raw.githubusercontent.com/$RepoSlugValue/main"
    $changelogUrl = "https://github.com/$RepoSlugValue/blob/main/CHANGELOG.md"
    $replacements = @{
        "{{RELEASE_VERSION}}" = $Version
        "{{RAW_BASE_URL}}" = $rawBaseUrl
        "{{FULL_CHANGELOG_URL}}" = $changelogUrl
        "{{RELEASE_NOTES_BLOCK}}" = $ReleaseNotesBlock
    }

    foreach ($key in $replacements.Keys) {
        $body = $body.Replace($key, $replacements[$key])
    }

    return $body
}

function Write-Utf8NoBom {
    param(
        [string]$Path,
        [string]$Content
    )

    $parent = Split-Path -Parent $Path
    if ($parent -and -not (Test-Path $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }

    [System.IO.File]::WriteAllText($Path, $Content, (New-Object System.Text.UTF8Encoding($false)))
}

function Test-ReleaseExists {
    param(
        [string]$RepoSlugValue,
        [string]$Tag
    )

    & gh release view $Tag -R $RepoSlugValue *> $null
    return ($LASTEXITCODE -eq 0)
}

Assert-Branch -RepoRoot $SourceRepo -ExpectedBranch "working-branch"
Assert-Branch -RepoRoot $DestinationRepo -ExpectedBranch "main"
Assert-CleanWorktree -RepoRoot $SourceRepo -Label "Source repo"
Assert-CleanWorktree -RepoRoot $DestinationRepo -Label "Destination repo"

$version = Get-VersionText -RepoRoot $SourceRepo -Requested $ReleaseVersion
if (-not $TemplatePath) {
    $TemplatePath = Join-Path $SourceRepo "docs\github-release-body-template.md"
}
if (-not $OutputRoot) {
    $OutputRoot = Join-Path $DestinationRepo "dist"
}
if (-not $ReleaseNotesPath) {
    $ReleaseNotesPath = Join-Path $OutputRoot ("release-notes-" + $version + ".txt")
}
if (-not $BodyOutputPath) {
    $BodyOutputPath = Join-Path $OutputRoot ("github-release-body-" + $version + ".md")
}
if (-not $CommitMessage) {
    $CommitMessage = "Release $version"
}

$promoteScript = Join-Path $SourceRepo "scripts\promote_to_main.ps1"
$buildScript = Join-Path $SourceRepo "scripts\build_stock_ui_at_release.ps1"
$zipPath = Join-Path $OutputRoot ("stock-ui-at-installer-" + $version + ".zip")

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw "GitHub CLI 'gh' is not available in PATH."
}

if (-not $SkipPushWorking) {
    Write-Host "Pushing working-branch..."
    Invoke-Git -RepoRoot $SourceRepo push origin working-branch | Out-Host
}

Write-Host "Promoting public release files into main..."
Invoke-CommandChecked -CommandName "powershell" -Arguments @(
    "-ExecutionPolicy", "Bypass",
    "-File", $promoteScript,
    "-SourceRepo", $SourceRepo,
    "-DestinationRepo", $DestinationRepo,
    "-Apply"
) | Out-Host

Write-Host "Building release ZIP from main..."
Invoke-CommandChecked -CommandName "powershell" -Arguments @(
    "-ExecutionPolicy", "Bypass",
    "-File", $buildScript,
    "-RepoRoot", $DestinationRepo,
    "-ReleaseVersion", $version,
    "-OutputRoot", $OutputRoot
) | Out-Host

$releaseNotesBlock = Get-ReleaseNotesBlock -NotesPath $ReleaseNotesPath
$releaseBody = Render-ReleaseBody -TemplateFile $TemplatePath -Version $version -RepoSlugValue $RepoSlug -ReleaseNotesBlock $releaseNotesBlock
Write-Utf8NoBom -Path $BodyOutputPath -Content $releaseBody
Write-Host "GitHub release body written to: $BodyOutputPath"

$destinationStatus = @(Invoke-Git -RepoRoot $DestinationRepo status --porcelain)
if ($destinationStatus.Count -gt 0) {
    Write-Host "Committing main release state..."
    Invoke-Git -RepoRoot $DestinationRepo add README.md CHANGELOG.md VERSION.txt LICENSE LICENSE-docs.md NOTICE.md docs scripts router-files/stock-ui-at | Out-Null
    $postAddStatus = @(Invoke-Git -RepoRoot $DestinationRepo status --porcelain)
    if ($postAddStatus.Count -gt 0) {
        Invoke-Git -RepoRoot $DestinationRepo commit -m $CommitMessage | Out-Host
    }
}

if (-not $SkipPushMain) {
    Write-Host "Pushing main..."
    Invoke-Git -RepoRoot $DestinationRepo push origin main | Out-Host
}

if (-not $SkipGitHubRelease) {
    $target = (Invoke-Git -RepoRoot $DestinationRepo rev-parse HEAD | Select-Object -First 1).Trim()
    if (Test-ReleaseExists -RepoSlugValue $RepoSlug -Tag $version) {
        Write-Host "Updating existing GitHub release..."
        Invoke-CommandChecked -CommandName "gh" -Arguments @(
            "release", "upload", $version, $zipPath,
            "-R", $RepoSlug,
            "--clobber"
        ) | Out-Host
        Invoke-CommandChecked -CommandName "gh" -Arguments @(
            "release", "edit", $version,
            "-R", $RepoSlug,
            "--title", $version,
            "--notes-file", $BodyOutputPath
        ) | Out-Host
    } else {
        Write-Host "Creating new GitHub release..."
        Invoke-CommandChecked -CommandName "gh" -Arguments @(
            "release", "create", $version, $zipPath,
            "-R", $RepoSlug,
            "--target", $target,
            "--title", $version,
            "--notes-file", $BodyOutputPath,
            "--latest"
        ) | Out-Host
    }
}

Write-Host ""
Write-Host "Release workflow complete."
Write-Host "Version: $version"
Write-Host "ZIP: $zipPath"
Write-Host "Release body: $BodyOutputPath"
